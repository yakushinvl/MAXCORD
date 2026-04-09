import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Socket } from 'socket.io-client';
import axios from 'axios';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useVoice, useVoiceLevels } from '../contexts/VoiceContext';
import { SOUNDS, soundManager } from '../utils/sounds';
import { useDialog } from '../contexts/DialogContext';
import { PhoneIcon, MicIcon, MicMutedIcon, CameraIcon, VideoIcon, CloseIcon, CheckIcon, MonitorIcon } from './Icons';
import ScreenSourceSelector from './ScreenSourceSelector';
import UserAvatar from './UserAvatar';
import { nativeAudioManager } from '../utils/nativeAudio';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteParticipant,
  Track,
  VideoPresets
} from 'livekit-client';
import './VoiceCall.css';

interface VoiceCallProps {
  socket: Socket | null;
  otherUser: User;
  dmId: string;
  isGroup?: boolean;
  dmName?: string;
  onEndCall: () => void;
  initialIncomingCall?: boolean;
}

const RemoteAudioPlayer: React.FC<{
  participant: RemoteParticipant;
  volume: number;
  muted: boolean;
}> = ({ participant, volume, muted }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<RemoteTrack | null>(null);

  useEffect(() => {
    const handleTrackSubscribed = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        console.log('[Audio] Subscribed to remote audio track:', track.sid);
        trackRef.current = track;
        if (audioRef.current) {
          track.attach(audioRef.current);
          
          const audioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (audioCtx) {
            const ctx = new audioCtx();
            if (ctx.state === 'suspended') ctx.resume();
          }

          audioRef.current.play().catch(e => {
            console.warn('[Audio] Autoplay blocked, waiting for click:', e);
            const playOnDocClick = () => {
              audioRef.current?.play();
              window.removeEventListener('click', playOnDocClick);
            };
            window.addEventListener('click', playOnDocClick);
          });
        }
      }
    };

    participant.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    participant.getTrackPublications().forEach(pub => {
      if (pub.track && pub.kind === Track.Kind.Audio) {
        handleTrackSubscribed(pub.track as RemoteTrack);
      }
    });

    return () => {
      participant.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      if (trackRef.current && audioRef.current) {
        trackRef.current.detach(audioRef.current);
      }
    };
  }, [participant]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

const VideoRenderer: React.FC<{
  participant: any;
  isMe?: boolean;
}> = ({ participant, isMe }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoRef.current || !participant) return;
    const el = videoRef.current;
    
    const attachTrack = () => {
      const track = participant.getTrackPublication(Track.Source.Camera)?.track 
                 || participant.getTrackPublication(Track.Source.ScreenShare)?.track;
      if (track && track.kind === Track.Kind.Video) {
        track.attach(el);
      }
    };

    attachTrack();
    participant.on(RoomEvent.TrackSubscribed, attachTrack);
    participant.on(RoomEvent.TrackPublished, attachTrack);
    participant.on(RoomEvent.TrackUnsubscribed, attachTrack);

    return () => {
      participant.off(RoomEvent.TrackSubscribed, attachTrack);
      participant.off(RoomEvent.TrackPublished, attachTrack);
      participant.off(RoomEvent.TrackUnsubscribed, attachTrack);
      const track = participant.getTrackPublication(Track.Source.Camera)?.track 
                 || participant.getTrackPublication(Track.Source.ScreenShare)?.track;
      if (track) track.detach(el);
    };
  }, [participant]);

  return <video ref={videoRef} autoPlay playsInline muted={isMe} className="participant-video" />;
};

const VoiceCall: React.FC<VoiceCallProps> = ({
  socket, otherUser, dmId, isGroup = false, dmName, onEndCall, initialIncomingCall = false
}) => {
  const { user } = useAuth();
  const { alert } = useDialog();
  const { userVolumes, isDeafened: isGlobalDeafened, isNoiseSuppressionEnabled } = useVoice();
  const { speakingUsers = new Set<string>() } = useVoiceLevels() || {};
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [isIncomingCall, setIsIncomingCall] = useState(initialIncomingCall);
  const [isRinging, setIsRinging] = useState(!initialIncomingCall);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showScreenSelector, setShowScreenSelector] = useState(false);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participantsMetadata, setParticipantsMetadata] = useState<Map<string, User>>(new Map());
  const [focusedParticipant, setFocusedParticipant] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const ringTimeoutRef = useRef<any>(null);
  const wasCallEstablishedRef = useRef(false);
  const notificationSentRef = useRef(false);
  const mountedAtRef = useRef<number>(Date.now());
  const hasInitRef = useRef(false);
  const isMountedRef = useRef(false);

  const fetchMetadata = useCallback(async (userId: string) => {
    if (participantsMetadata.has(userId)) return;
    try {
      const { data } = await axios.get(`/api/users/${userId}`);
      setParticipantsMetadata(prev => new Map(prev).set(userId, data));
    } catch (e) { }
  }, [participantsMetadata]);

  useEffect(() => {
    if (!socket || !dmId) return;
    isMountedRef.current = true;

    if (!hasInitRef.current && !initialIncomingCall) {
      hasInitRef.current = true;
      socket.emit('join-dm-call', { dmId });
      socket.emit('call-offer', {
        targetUserId: isGroup ? null : String(otherUser._id),
        dmId: String(dmId),
        offer: null
      });
      ringTimeoutRef.current = setTimeout(() => endCall(), 45000);
    }

    const handleOtherUserJoined = (data: { userId: string }) => {
      if (isGroup || String(data.userId) === String(otherUser._id)) {
        setIsRinging(false);
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        joinLiveKitRoom();
        if (isGroup) fetchMetadata(data.userId);
      }
    };

    const handleExistingUsers = (users: string[]) => {
      if (users.length > 0) {
        setIsRinging(false);
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        joinLiveKitRoom();
        if (isGroup) users.forEach(uid => fetchMetadata(uid));
      }
    };

    const handleUserLeft = (data: { userId: string }) => {
      if (isGroup) {
        setRemoteParticipants(prev => prev.filter(p => p.identity !== data.userId));
      } else if (String(data.userId) === String(otherUser._id)) {
        endCall();
      }
    };

    const handleCallEnd = () => { if (!isGroup) endCall(); };
    const handleIncomingOffer = () => { if (!isCallActive) setIsIncomingCall(true); };

    socket.on('call-offer', handleIncomingOffer);
    socket.on('call-end', handleCallEnd);
    socket.on('dm-call-user-joined', handleOtherUserJoined);
    socket.on('dm-call-existing-users', handleExistingUsers);
    socket.on('dm-call-user-left', handleUserLeft);

    return () => {
      socket.off('call-offer', handleIncomingOffer);
      socket.off('call-end', handleCallEnd);
      socket.off('dm-call-user-joined', handleOtherUserJoined);
      socket.off('dm-call-existing-users', handleExistingUsers);
      socket.off('dm-call-user-left', handleUserLeft);
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);

      const wasInit = hasInitRef.current;
      isMountedRef.current = false;
      setTimeout(() => {
        if (!isMountedRef.current && wasInit) {
          const duration = Date.now() - mountedAtRef.current;
          if (!initialIncomingCall && !wasCallEstablishedRef.current && !notificationSentRef.current && dmId && duration > 3000 && !isGroup) {
            notificationSentRef.current = true;
            axios.post(`/api/direct-messages/${dmId}/messages`, { content: 'Пропущенный звонок', type: 'missed-call' }).catch(() => { });
          }
          socket.emit('leave-dm-call', { dmId });
          cleanupStreams();
        }
      }, 50);
    };
  }, [socket, dmId, isGroup, otherUser._id]);

  const joinLiveKitRoom = async () => {
    if (roomRef.current) {
       console.log('[LiveKit] Room already exists, cleaning up before reconnect...');
       await roomRef.current.disconnect();
       roomRef.current = null;
    }

    try {
      console.log(`[LiveKit] Requesting token for room call-${dmId}...`);
      const { data } = await axios.get('/api/livekit/token', {
        params: { roomName: `call-${dmId}`, identity: user?._id?.toString() }
      });

      const { token, serverUrl } = data;
      console.log('[LiveKit] Token received. Server URL:', serverUrl);

      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token received from server');
      }

      // Smarter protocol handling
      let connectUrl = serverUrl;
      if (!connectUrl.startsWith('ws')) {
         const isLocal = connectUrl.includes('localhost') || connectUrl.includes('127.0.0.1');
         const isSecureOrigin = window.location.protocol === 'https:' || window.location.protocol === 'file:';
         const protocol = (isSecureOrigin && !isLocal) ? 'wss://' : 'ws://';
         connectUrl = protocol + connectUrl;
         console.log('[LiveKit] Formatted connect URL:', connectUrl);
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          dtx: true,
          simulcast: true,
          red: true,
          screenShareEncoding: {
            maxBitrate: 5_000_000,
            maxFramerate: 30,
          },
          stopMicTrackOnMute: false,
        }
      });

      roomRef.current = room;
      wasCallEstablishedRef.current = true;

      setRemoteParticipants(Array.from(room.remoteParticipants.values()));
      if (isGroup) {
         room.remoteParticipants.forEach(p => fetchMetadata(p.identity));
      }

      room
        .on(RoomEvent.ParticipantConnected, (p) => {
          console.log('[LiveKit] Participant connected:', p.identity);
          setRemoteParticipants(prev => [...prev.filter(x => x.identity !== p.identity), p]);
          if (isGroup) fetchMetadata(p.identity);
        })
        .on(RoomEvent.ParticipantDisconnected, (p) => {
          console.log('[LiveKit] Participant disconnected:', p.identity);
          setRemoteParticipants(prev => prev.filter(x => x.identity !== p.identity));
        })
        .on(RoomEvent.Disconnected, (reason) => {
          console.log('[LiveKit] Disconnected:', reason);
          if (reason !== undefined) {
             setIsCallActive(false);
          }
        })
        .on(RoomEvent.ConnectionStateChanged, (state) => {
           console.log('[LiveKit] Connection state:', state);
        })
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('[LiveKit] Track subscribed:', track.kind, 'from', participant.identity);
          if (publication.source === Track.Source.ScreenShare) {
            soundManager.play(SOUNDS.SCREENSHARE_ON, 0.4);
            setRemoteScreenStreams(prev => {
              const next = new Map(prev);
              const stream = next.get(participant.identity) || new MediaStream();
              stream.addTrack(track.mediaStreamTrack!);
              next.set(participant.identity, stream);
              return next;
            });
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
          if (publication.source === Track.Source.ScreenShare) {
            soundManager.play(SOUNDS.SCREENSHARE_OFF, 0.4);
            setRemoteScreenStreams(prev => {
              const next = new Map(prev);
              const stream = next.get(participant.identity);
              if (stream) {
                const remaining = stream.getTracks().filter(t => t.id !== track.mediaStreamTrack?.id);
                if (remaining.length === 0) next.delete(participant.identity);
                else next.set(participant.identity, new MediaStream(remaining));
              }
              return next;
            });
          }
        });

      console.log('[LiveKit] Connecting to:', connectUrl);
      await room.connect(connectUrl, token);
      console.log('[LiveKit] Successfully connected to room');
      
      setIsCallActive(true);
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));

      await room.localParticipant.setMicrophoneEnabled(true);
      if (isVideoEnabled) await room.localParticipant.setCameraEnabled(true);
    } catch (e) { 
      setIsCallActive(false);
      alert('Ошибка подключения: ' + (e as Error).message); 
    }
  };

  const acceptCall = async () => {
    setIsIncomingCall(false); setIsRinging(false);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (!hasInitRef.current) {
      hasInitRef.current = true;
      socket?.emit('join-dm-call', { dmId });
    }
    await joinLiveKitRoom();
  };

  const endCall = async () => {
    cleanupStreams();
    soundManager.play(SOUNDS.CALL_LEAVE, 0.4);
    if (socket) {
      if (isGroup) socket.emit('leave-dm-call', { dmId });
      else socket.emit('call-end', { targetUserId: otherUser._id, dmId });
    }
    setIsCallActive(false); onEndCall();
  };

  const cleanupStreams = () => { if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; } };
  const toggleMute = () => { setIsMuted(!isMuted); roomRef.current?.localParticipant.setMicrophoneEnabled(isMuted); };
  const toggleVideo = async () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    if (roomRef.current) await roomRef.current.localParticipant.setCameraEnabled(newState);
  };

  const toggleScreenShare = async (sourceId?: string, options?: { resolution: string, frameRate: string }) => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      soundManager.play(SOUNDS.SCREENSHARE_OFF, 0.4);
      if (roomRef.current) await roomRef.current.localParticipant.setScreenShareEnabled(false);
    } else if (sourceId && roomRef.current) {
      try {
        await roomRef.current.localParticipant.setScreenShareEnabled(true, {
           resolution: VideoPresets.h720,
        });
        setIsScreenSharing(true);
        soundManager.play(SOUNDS.SCREENSHARE_ON, 0.4);
      } catch (e) { alert('Ошибка: ' + (e as Error).message); }
    }
  };

  const allParticipants = useMemo(() => {
    const list = [{ identity: user?._id || 'me', isMe: true, p: roomRef.current?.localParticipant as any }];
    
    if (isGroup) {
      remoteParticipants.forEach(p => {
        if (!list.find(x => x.identity === p.identity)) {
          list.push({ identity: p.identity, isMe: false, p });
        }
      });
    } else {
      // For 1:1, always ensure the other user is in the list to show their placeholder
      const rp = remoteParticipants.find(p => String(p.identity) === String(otherUser._id));
      list.push({ identity: String(otherUser._id), isMe: false, p: rp || null });
    }
    return list;
  }, [user?._id, remoteParticipants, isGroup, otherUser._id, isCallActive]);

  if (isIncomingCall) {
    return (
      <div className="voice-call-notification">
        <div className="notification-content">
          <div className="notification-avatar"><UserAvatar user={isGroup ? null : otherUser} size={48} /></div>
          <div className="notification-info">
            <div className="notification-name">{isGroup ? (dmName || 'Групповой звонок') : otherUser.username}</div>
            <div className="notification-status">Входящий звонок...</div>
          </div>
          <div className="notification-actions">
            <button className="accept-btn" onClick={acceptCall}><CheckIcon color="black" /></button>
            <button className="reject-btn" onClick={endCall}><CloseIcon color="white" size={20} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`voice-call-full-view ${isGroup ? 'group-mode' : ''}`}>
      <header className="call-topbar">
        <div className="call-topbar-left">
          <button className="back-to-app-btn" onClick={onEndCall} title="Свернуть">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <div className="call-title">{isGroup ? (dmName || 'Групповой звонок') : `Звонок: ${otherUser.username}`}</div>
        </div>
        <div className="call-duration">{isCallActive ? 'В эфире' : 'Подключение...'}</div>
      </header>

      <main className="call-main">
        <div className={`video-grid count-${allParticipants.length}`}>
          {allParticipants.map((p: any) => {
            const hasVideo = p.isMe ? isVideoEnabled : p.p?.isCameraEnabled;
            const userMeta = p.isMe ? user : (isGroup ? participantsMetadata.get(p.identity) : otherUser);
            const isSpeaking = speakingUsers.has(p.identity);
            const screenShare = p.isMe ? isScreenSharing : p.p?.isScreenShareEnabled;
            const isFocused = focusedParticipant === p.identity;

            return (
              <div key={p.identity} className={`participant-slot ${isFocused ? 'focused' : ''}`}>
                {hasVideo && p.p ? (
                  <VideoRenderer participant={p.p} isMe={p.isMe} />
                ) : (
                  <div className="participant-avatar-container">
                    <div className={`call-avatar-frame ${isSpeaking ? 'is-speaking' : ''}`}>
                      <UserAvatar 
                        user={userMeta || (p.isMe ? user : null)} 
                        size={160} 
                        className="call-inner-avatar"
                      />
                    </div>
                    <div className="participant-details">
                       <h3 className="participant-name">{userMeta?.username || (p.isMe ? 'Вы' : 'Загрузка...')}</h3>
                       {isSpeaking ? (
                          <div className="speaking-status">ГОВОРИТ</div>
                       ) : (
                          !p.isMe && !p.p && isRinging && <div className="ringing-status">ВЫЗОВ...</div>
                       )}
                    </div>
                  </div>
                )}
                
                {screenShare && (
                   <div className="remote-screen-slot">
                      <video autoPlay playsInline className="remote-screen-video-full" ref={el => {
                        if (!el) return;
                        if (p.isMe) {
                           const track = roomRef.current?.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track;
                           if (track && (track as any).mediaStreamTrack) {
                              const s = new MediaStream([(track as any).mediaStreamTrack]);
                              if (el.srcObject !== s) el.srcObject = s;
                           }
                        } else {
                           const s = remoteScreenStreams.get(p.identity);
                           if (s && el.srcObject !== s) el.srcObject = s;
                        }
                      }} />
                      <div className="screen-share-overlay-controls">
                         <button className="expand-stream-btn" onClick={() => setFocusedParticipant(focusedParticipant === p.identity ? null : p.identity)}>
                            {focusedParticipant === p.identity ? 'Свернуть' : 'Развернуть эфир'}
                         </button>
                      </div>
                   </div>
                )}
                <div className="participant-label">{userMeta?.username || p.identity} {p.isMe && '(Вы)'}</div>
              </div>
            );
          })}
        </div>
      </main>

      <div className="call-controls-bar">
        <button className={`control-circle ${isMuted ? 'muted' : ''}`} onClick={toggleMute} title="Микрофон">
          {isMuted ? <MicMutedIcon /> : <MicIcon />}
        </button>
        <button className={`control-circle ${isVideoEnabled ? 'active' : ''}`} onClick={toggleVideo} title="Камера">
          <CameraIcon />
        </button>
        <button className={`control-circle ${isScreenSharing ? 'active' : ''}`} onClick={() => isScreenSharing ? toggleScreenShare() : setShowScreenSelector(true)} title="Экран">
          <MonitorIcon size={24} />
        </button>
        <button className="control-divider" disabled />
        <button className="control-circle end-call-circle" onClick={endCall} title="Завершить">
          <span style={{ display: 'flex', transform: 'rotate(135deg)' }}><PhoneIcon size={28} /></span>
        </button>
      </div>

      {remoteParticipants.map(participant => (
        <RemoteAudioPlayer
          key={participant.identity}
          participant={participant}
          volume={userVolumes.get(participant.identity) ?? 1}
          muted={isGlobalDeafened}
        />
      ))}

      {showScreenSelector && (
        <ScreenSourceSelector
          onClose={() => setShowScreenSelector(false)}
          onSelect={(id, opts) => { toggleScreenShare(id, opts); setShowScreenSelector(false); }}
        />
      )}
    </div>
  );
};

export default VoiceCall;

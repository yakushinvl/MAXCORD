import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import axios from 'axios';
import { User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useVoice, useVoiceLevels } from '../contexts/VoiceContext';
import { getAvatarUrl } from '../utils/avatar';
import { setupNoiseSuppression } from '../utils/audioProcessing';
import { SOUNDS, soundManager } from '../utils/sounds';
import { useDialog } from '../contexts/DialogContext';
import { PhoneIcon, MicIcon, MicMutedIcon, VideoIcon, CameraIcon, CloseIcon, CheckIcon, MonitorIcon } from './Icons';
import ScreenSourceSelector from './ScreenSourceSelector';
import UserAvatar from './UserAvatar';
import { nativeAudioManager } from '../utils/nativeAudio';
import {
  Room,
  RoomEvent,
  RemoteTrack,
  RemoteTrackPublication,
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
  initialOffer?: any;
}

const RemoteAudioPlayer: React.FC<{
  stream: MediaStream;
  volume: number;
  muted: boolean;
}> = ({ stream, volume, muted }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    if (!stream) return;
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();

      source.connect(gain);
      gain.connect(dest);
      gainNodeRef.current = gain;

      audio.srcObject = dest.stream;
      audio.play().catch(() => { });
    } catch (e) {
      audio.srcObject = stream;
      audio.play().catch(() => { });
    }

    return () => {
      audioCtxRef.current?.close().catch(() => { });
      audioCtxRef.current = null;
    };
  }, [stream]);

  useEffect(() => {
    if (gainNodeRef.current) {
      const v = muted ? 0 : volume;
      // Use 0.05s ramp for smoothness
      gainNodeRef.current.gain.setTargetAtTime(v, audioCtxRef.current?.currentTime || 0, 0.05);
      if (audioRef.current) audioRef.current.volume = 1;
    } else if (audioRef.current) {
      audioRef.current.volume = Math.min(Math.max(muted ? 0 : volume, 0), 1);
    }
  }, [volume, muted]);

  return <audio ref={audioRef} autoPlay playsInline />;
};

const VoiceCall: React.FC<VoiceCallProps> = ({
  socket, otherUser, dmId, isGroup = false, dmName, onEndCall, initialIncomingCall = false
}) => {
  const { user } = useAuth();
  const { alert } = useDialog();
  const { isNoiseSuppressionEnabled, userVolumes, isDeafened: isGlobalDeafened } = useVoice();
  const { speakingUsers = new Set<string>() } = useVoiceLevels() || {};
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isIncomingCall, setIsIncomingCall] = useState(initialIncomingCall);
  const [isRinging, setIsRinging] = useState(!initialIncomingCall);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [showScreenSelector, setShowScreenSelector] = useState(false);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participantsMetadata, setParticipantsMetadata] = useState<Map<string, User>>(new Map());

  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<Room | null>(null);
  const ringTimeoutRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const wasCallEstablishedRef = useRef(false);
  const notificationSentRef = useRef(false);
  const mountedAtRef = useRef<number>(Date.now());

  const fetchMetadata = useCallback(async (userId: string) => {
    if (participantsMetadata.has(userId)) return;
    try {
      const { data } = await axios.get(`/api/users/${userId}`);
      setParticipantsMetadata(prev => new Map(prev).set(userId, data));
    } catch (e) { }
  }, [participantsMetadata]);

  useEffect(() => {
    if (!socket || !dmId) return;
    if (!initialIncomingCall) {
      socket.emit('join-dm-call', { dmId });
      // If it's a group, we don't need targetUserId
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

    const handleIncomingOffer = () => {
      if (!isCallActive) setIsIncomingCall(true);
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
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(data.userId);
          return next;
        });
      } else if (String(data.userId) === String(otherUser._id)) {
        endCall();
      }
    };

    socket.on('call-offer', handleIncomingOffer);
    socket.on('call-end', () => {
      if (!isGroup) endCall();
    });
    socket.on('dm-call-user-joined', handleOtherUserJoined);
    socket.on('dm-call-existing-users', handleExistingUsers);
    socket.on('dm-call-user-left', handleUserLeft);

    return () => {
      const duration = Date.now() - mountedAtRef.current;
      if (!initialIncomingCall && !wasCallEstablishedRef.current && !notificationSentRef.current && dmId && duration > 3000 && !isGroup) {
        notificationSentRef.current = true;
        axios.post(`/api/direct-messages/${dmId}/messages`, { content: 'Пропущенный звонок', type: 'missed-call' }).catch(() => { });
      }
      if (dmId) socket.emit('leave-dm-call', { dmId });
      socket.off('call-offer'); socket.off('call-end'); socket.off('dm-call-user-joined'); socket.off('dm-call-existing-users');
      socket.off('dm-call-user-left');
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      cleanupStreams();
    };
  }, [socket, dmId, isGroup]);

  const joinLiveKitRoom = async () => {
    if (roomRef.current) return;
    try {
      const { data } = await axios.get('/api/livekit/token', {
        params: {
          roomName: `call-${dmId}`,
          identity: user?._id?.toString()
        }
      });

      const { token, serverUrl } = data;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: { dtx: true, simulcast: true, red: true }
      });

      roomRef.current = room;

      room
        .on(RoomEvent.ParticipantConnected, (participant) => {
          setRemoteParticipants(prev => [...prev, participant]);
          if (isGroup) fetchMetadata(participant.identity);
        })
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
          setRemoteStreams(prev => {
            const next = new Map(prev);
            next.delete(participant.identity);
            return next;
          });
        })
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (publication.source === Track.Source.ScreenShare) {
            soundManager.play(SOUNDS.SCREENSHARE_ON, 0.4);
            setRemoteScreenStreams(prev => {
              const next = new Map(prev);
              const existing = next.get(participant.identity) || new MediaStream();
              existing.addTrack(track.mediaStreamTrack!);
              next.set(participant.identity, existing);
              return next;
            });
          } else {
            setRemoteStreams(prev => {
              const next = new Map(prev);
              const existing = next.get(participant.identity) || new MediaStream();
              existing.addTrack(track.mediaStreamTrack!);
              next.set(participant.identity, existing);
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
          } else {
            setRemoteStreams(prev => {
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
        })
        .on(RoomEvent.LocalTrackPublished, (publication) => {
          const track = publication.track;
          if (!track) return;
          if (publication.source === Track.Source.Microphone) {
             setLocalStream(new MediaStream([track.mediaStreamTrack!]));
          } else if (publication.source === Track.Source.Camera) {
             setIsVideoEnabled(true);
             const stream = new MediaStream([track.mediaStreamTrack!]);
             setLocalStream(prev => {
                if (!prev) return stream;
                const next = new MediaStream(prev.getTracks());
                next.addTrack(track.mediaStreamTrack!);
                return next;
             });
          }
        })
        .on(RoomEvent.LocalTrackUnpublished, (publication) => {
          if (publication.source === Track.Source.Camera) {
            setIsVideoEnabled(false);
            setLocalStream(prev => {
              if (!prev) return null;
              const remaining = prev.getTracks().filter(t => t.kind !== 'video');
              return remaining.length > 0 ? new MediaStream(remaining) : null;
            });
          }
        });

      await room.connect(serverUrl, token);
      setRemoteParticipants(Array.from(room.remoteParticipants.values()));

      await room.localParticipant.setMicrophoneEnabled(true);
      if (isVideoEnabled) await room.localParticipant.setCameraEnabled(true);

      const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (micTrack?.track) setLocalStream(new MediaStream([micTrack.track.mediaStreamTrack!]));

      setIsCallActive(true);
      wasCallEstablishedRef.current = true;
    } catch (e) { console.error('[DM Voice] LiveKit join error:', e); }
  };

  const acceptCall = async () => {
    setIsIncomingCall(false);
    setIsRinging(false);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    if (socket) socket.emit('join-dm-call', { dmId });
    await joinLiveKitRoom();
  };

  const endCall = async () => {
    cleanupStreams();
    soundManager.play(SOUNDS.CALL_LEAVE, 0.4);
    if (socket) {
      if (isGroup) {
        socket.emit('leave-dm-call', { dmId });
      } else {
        socket.emit('call-end', { targetUserId: otherUser._id, dmId });
      }
    }
    setIsCallActive(false); onEndCall();
  };

  const cleanupStreams = () => {
    if (roomRef.current) { roomRef.current.disconnect(); roomRef.current = null; }
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (screenStream) screenStream.getTracks().forEach(track => track.stop());
  };

  const toggleMute = () => { setIsMuted(!isMuted); roomRef.current?.localParticipant.setMicrophoneEnabled(isMuted); };
  const toggleVideo = async () => {
    const newState = !isVideoEnabled;
    setIsVideoEnabled(newState);
    if (roomRef.current) {
        await roomRef.current.localParticipant.setCameraEnabled(newState);
        
        // Manual sync for local preview in case event is slow
        const cameraPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Camera);
        if (newState && cameraPub?.track) {
            setLocalStream(prev => {
                const tracks = prev ? [...prev.getTracks().filter(t => t.kind !== 'video'), cameraPub.track!.mediaStreamTrack!] : [cameraPub.track!.mediaStreamTrack!];
                return new MediaStream(tracks);
            });
        } else if (!newState) {
            setLocalStream(prev => {
                if (!prev) return null;
                const remaining = prev.getTracks().filter(t => t.kind !== 'video');
                return remaining.length > 0 ? new MediaStream(remaining) : null;
            });
        }
    }
  };

  const toggleScreenShare = async (sourceId?: string, options?: { resolution: string, frameRate: string }) => {
    if (isScreenSharing) {
      setIsScreenSharing(false);
      soundManager.play(SOUNDS.SCREENSHARE_OFF, 0.4);
      if (roomRef.current) await roomRef.current.localParticipant.setScreenShareEnabled(false);
    } else if (sourceId && roomRef.current) {
      try {
        const frameRate = parseInt(options?.frameRate || '30', 10);
        const constraints = {
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxFrameRate: frameRate } } as any
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (roomRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) await roomRef.current.localParticipant.publishTrack(videoTrack, { source: Track.Source.ScreenShare });
        }
        setScreenStream(stream);
        setIsScreenSharing(true);
        soundManager.play(SOUNDS.SCREENSHARE_ON, 0.4);
      } catch (e) { alert('Ошибка: ' + (e as Error).message); }
    }
  };

  useEffect(() => {
    if (localStream && localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const allParticipants = [
    { identity: user?._id || 'me', isMe: true, isLocal: true, participant: roomRef.current?.localParticipant },
    ...remoteParticipants.map(p => ({ identity: p.identity, isMe: false, isLocal: false, participant: p }))
  ];

  if (isIncomingCall) {
    return (
      <div className="voice-call-notification">
        <div className="notification-content">
          <div className="notification-avatar">
            <UserAvatar user={isGroup ? null : otherUser} size={48} />
          </div>
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
          <div className="call-title">
            {isGroup ? (dmName || 'Групповой звонок') : `Звонок: ${otherUser.username}`}
          </div>
        </div>
        <div className="call-duration">{isCallActive ? 'В эфире' : 'Подключение...'}</div>
      </header>

      <main className="call-main">
        <div className={`video-grid count-${allParticipants.length}`}>
          {allParticipants.map((p) => {
            const stream = p.isLocal ? (isVideoEnabled ? localStream : null) : remoteStreams.get(p.identity);
            const userMeta = p.isMe ? user : (isGroup ? participantsMetadata.get(p.identity) : otherUser);
            const isSpeaking = speakingUsers.has(p.identity) || (p.isMe && localSpeaking);
            const screenShare = p.isLocal ? (isScreenSharing ? screenStream : null) : remoteScreenStreams.get(p.identity);

            return (
              <div key={p.identity} className={`participant-slot ${isSpeaking ? 'speaking' : ''}`}>
                {stream && stream.getVideoTracks().length > 0 ? (
                  <video
                    autoPlay playsInline muted={p.isMe}
                    ref={el => { if (el && el.srcObject !== stream) el.srcObject = stream; }}
                    className="participant-video"
                  />
                ) : (
                  <div className="participant-placeholder">
                    <UserAvatar user={userMeta || (p.isMe ? user : null)} size={allParticipants.length > 2 ? 80 : 120} animate={isSpeaking} />
                    <span>{userMeta?.username || 'Загрузка...'}</span>
                  </div>
                )}
                {screenShare && (
                  <div className="participant-screenshare">
                    <video autoPlay playsInline muted={p.isMe} ref={el => { if (el && el.srcObject !== screenShare) el.srcObject = screenShare; }} />
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
        <button className="control-circle end-call-circle" onClick={endCall} title="Завершить">
          <span style={{ display: 'flex', transform: 'rotate(135deg)' }}><PhoneIcon size={28} /></span>
        </button>
      </div>

      {Array.from(remoteStreams.entries()).map(([uid, stream]) => (
        <RemoteAudioPlayer
          key={uid} stream={stream}
          volume={userVolumes.get(uid) ?? 1}
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

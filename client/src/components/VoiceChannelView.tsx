import React, { useMemo, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useVoice, useVoiceLevels } from '../contexts/VoiceContext';
import { Channel, User, Server } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { getAvatarUrl, getFullUrl } from '../utils/avatar';
import { MenuIcon, SpeakerIcon, PhoneIcon, MicMutedIcon, MicIcon, DeafenedIcon, MonitorIcon, PlayIcon, MaximizeIcon, MinimizeIcon, VolumeHighIcon, VolumeLowIcon, FullscreenIcon } from './Icons';
import ScreenSourceSelector from './ScreenSourceSelector';
import axios from 'axios';
import MemberContextMenu from './MemberContextMenu';
import UserAvatar from './UserAvatar';
import './VoiceChannelView.css';

interface VoiceChannelViewProps {
  channel: Channel;
  server: Server;
  onUserClick: (userId: string, event?: React.MouseEvent) => void;
  onMessageClick: (userId: string) => void;
  onCallClick: (userId: string) => void;
  onMobileMenuClick?: () => void;
}

const VoiceParticipantCard = React.memo<{
  participant: any;
  isSpeaking: boolean;
  onUserClick: any;
  onContextMenu: any;
  getDisplayName: any;
}>(({ participant, isSpeaking, onUserClick, onContextMenu, getDisplayName }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (participant.cameraStream && videoRef.current && videoRef.current.srcObject !== participant.cameraStream) {
      videoRef.current.srcObject = participant.cameraStream;
    }
  }, [participant.cameraStream]);

  return (
    <div
      className={`p-card ${isSpeaking ? 'is-speaking' : ''} ${participant.cameraStream ? 'has-video' : ''}`}
      onClick={(e) => onUserClick(participant._id, e)}
      onContextMenu={onContextMenu}
    >
      {participant.cameraStream && (
        <video ref={videoRef} autoPlay playsInline muted className="p-camera-video" />
      )}

      {!participant.cameraStream && participant.banner && (
        <div
          className="p-bg"
          style={{ backgroundImage: `url(${getFullUrl(participant.banner)})` }}
        />
      )}

      {!participant.cameraStream && (
        <div className="p-avatar-wrap">
          <UserAvatar
            user={participant}
            size={64}
            animate={true}
            className="p-avatar"
          />
        </div>
      )}

      <div className="p-info">
        <span className="p-name">{getDisplayName(participant)}{participant.isMe ? ' (Вы)' : ''}</span>
        {participant.isMe && <span className="p-badge badge-host">HOST</span>}
      </div>

      <div className="p-indicators">
        {(participant.isMuted || participant.isDeafened) && (
          <div className="ind-icon is-muted">
            {participant.isDeafened ? <DeafenedIcon size={18} /> : <MicMutedIcon size={18} />}
          </div>
        )}
        {isSpeaking ? (
          <div className="ind-icon">
            <MicIcon size={18} color="#ffffff" />
          </div>
        ) : null}
      </div>
    </div>
  );
});

const VoiceStreamCard: React.FC<{
  item: any;
  currentUser: any;
  getDisplayName: (u: User) => string;
  stopScreenShare: () => void;
  remoteScreenStreams: Map<string, MediaStream>;
  watchedScreenIds: Set<string>;
  screenVolumes: Map<string, number>;
  setScreenVolume: (uId: string, v: number) => void;
  setWatchingScreen: (uId: string, w: boolean) => void;
  focusedStreamId: string | null;
  setFocusedStreamId: (sId: string | null) => void;
  expandedStreamId: string | null;
  setExpandedStreamId: (sId: string | null) => void;
  screenStream: MediaStream | null;
}> = ({
  item, currentUser, getDisplayName, stopScreenShare, remoteScreenStreams,
  watchedScreenIds, screenVolumes, setScreenVolume, setWatchingScreen,
  focusedStreamId, setFocusedStreamId, expandedStreamId, setExpandedStreamId,
  screenStream
}) => {
    const isMe = item.isMe;
    const stream = isMe ? screenStream : remoteScreenStreams.get(item.userId);
    const isWatching = isMe || watchedScreenIds.has(item.userId);
    const volume = isMe ? 0 : (screenVolumes.get(item.userId) ?? 1);
    const isExpanded = expandedStreamId === item._id;
    const isFocused = focusedStreamId === item._id;

    const videoRef = React.useRef<HTMLVideoElement>(null);
    const viewportRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (videoRef.current && stream && isWatching && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        if (isMe) videoRef.current.muted = true;
        videoRef.current.play().catch(() => { });
      }
    }, [stream, isMe, isExpanded, isWatching]);

    useEffect(() => {
      if (videoRef.current && !isMe) {
        videoRef.current.volume = Math.min(Math.max(volume, 0), 1);
      }
    }, [volume, isMe]);

    const handleFullscreen = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedStreamId(isExpanded ? null : item._id);
    };

    // Effect for handling hardware fullscreen synchronously with expanded state
    useEffect(() => {
      if (isExpanded && viewportRef.current) {
        const target = viewportRef.current;
        const methods = ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen', 'mozRequestFullScreen', 'msRequestFullscreen'];
        const method = methods.find(m => typeof (target as any)[m] === 'function');
        if (method) {
          try { (target as any)[method]().catch(() => { }); } catch (e) { }
        }
      } else if (!isExpanded) {
        const doc = document as any;
        const exitMethods = ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen', 'mozCancelFullScreen', 'msExitFullscreen'];
        const exitMethod = exitMethods.find(m => typeof doc[m] === 'function');
        if (exitMethod && (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement)) {
          try { doc[exitMethod](); } catch (e) { }
        }
      }
    }, [isExpanded]);

    const cardContent = (
      <div
        className={`p-card ${isExpanded ? 'is-expanded' : ''}`}
        onClick={() => {
          if (!isMe) {
            if (!isWatching) {
              setWatchingScreen(item.userId, true);
              setFocusedStreamId(item._id);
            } else if (!isFocused) {
              setFocusedStreamId(item._id);
            } else {
              setExpandedStreamId(isExpanded ? null : item._id);
            }
          } else {
            setExpandedStreamId(isExpanded ? null : item._id);
          }
        }}
      >
        <div className="stream-viewport" ref={viewportRef}>
          {(stream && isWatching) ? (
            <>
              <video
                autoPlay
                playsInline
                ref={videoRef}
                className="stream-video"
                muted={true} // Audio is handled by RemoteScreen in VoiceContext to prevent duplicates
              />
              <div className="stream-controls-overlay top" onClick={e => e.stopPropagation()}>
                <div className="stream-controls-left">
                  {!isMe && (
                    <div className="volume-control-wrapper">
                      {volume === 0 ? <VolumeLowIcon size={18} /> : <VolumeHighIcon size={18} />}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={volume}
                        onChange={(e) => setScreenVolume(item.userId, parseFloat(e.target.value))}
                        className="stream-volume-slider"
                      />
                    </div>
                  )}
                </div>
                <div className="stream-controls-right">
                  <button className="stream-control-btn" onClick={handleFullscreen} title="На весь экран">
                    <FullscreenIcon size={18} />
                  </button>
                  <button
                    className="stop-stream-btn-red"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isMe) {
                        stopScreenShare();
                      } else {
                        setWatchingScreen(item.userId, false);
                      }
                      // Clear focus and expansion if this was the stream being closed
                      if (expandedStreamId === item._id) setExpandedStreamId(null);
                      if (focusedStreamId === item._id) setFocusedStreamId(null);
                    }}
                  >
                    &times;
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="stream-overlay">
              <div className="stream-icon-glow"><MonitorIcon size={64} /></div>
              {!isMe ? (
                <button
                  className="btn-watch"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWatchingScreen(item.userId, true);
                    setFocusedStreamId(item._id);
                  }}
                >
                  <PlayIcon size={18} />
                  <span>Смотреть стрим</span>
                </button>
              ) : (
                <div className="p-name">Загрузка вашей трансляции...</div>
              )}
            </div>
          )}
          <div className="p-info">
            <span className="p-name">{isMe ? 'Ваш стрим' : (item.participantName || 'Стрим')}</span>
            {(isMe || isWatching) && <span className="p-badge badge-live">LIVE</span>}
          </div>
        </div>
      </div>
    );

    if (isExpanded) return ReactDOM.createPortal(cardContent, document.body);
    return cardContent;
  };

const VoiceChannelView: React.FC<VoiceChannelViewProps> = ({ channel, server, onUserClick, onMessageClick, onCallClick, onMobileMenuClick }) => {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const {
    isConnected,
    activeChannelId,
    joinChannel,
    leaveChannel,
    isMuted,
    isDeafened,
    toggleMute,
    toggleDeafen,
    connectedUsers: activeConnectedUsers,
    userStates,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    localStream,
    screenStream,
    remoteScreenStreams,
    screenVolumes,
    setScreenVolume,
    watchedScreenIds,
    setWatchingScreen,
    remoteStreams,
    isVideoOn,
    toggleVideo,
    localCameraStream
  } = useVoice();
  const { speakingUsers = new Set<string>() } = useVoiceLevels() || {};

  const [externalParticipants, setExternalParticipants] = useState<User[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; userId: string } | null>(null);
  const [showScreenSelector, setShowScreenSelector] = useState(false);
  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(null);
  const [focusedStreamId, setFocusedStreamId] = useState<string | null>(null);

  const handleCloseContextMenu = () => setContextMenu(null);

  const getDisplayName = (u: User) => {
    const member = server.members.find(m => {
      const mId = typeof m.user === 'string' ? m.user : m.user?._id;
      return String(mId) === String(u._id);
    });
    return member?.nickname || u.username;
  };

  const isConnectedToThisChannel = isConnected && activeChannelId === channel._id;

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        const response = await axios.get(`/api/channels/${channel._id}/voice-participants`);
        setExternalParticipants(response.data);
      } catch (err) { }
    };

    fetchParticipants();

    if (socket) {
      const handleUpdate = (data: { channelId: string; users: User[] }) => {
        if (data.channelId === channel._id) {
          setExternalParticipants(data.users);
        }
      };

      socket.on('voice-channel-users-update', handleUpdate);
      return () => {
        socket.off('voice-channel-users-update', handleUpdate);
      };
    }
  }, [channel._id, socket]);

  const displayParticipants = useMemo(() => {
    let items: any[] = [];
    if (isConnectedToThisChannel && currentUser) {
      // Create a set of IDs we've already added to avoid duplicates
      const seenIds = new Set<string>();

      // 1. Add Me
      items.push({ ...currentUser, isMe: true, isMuted, isDeafened, isScreenSharing, type: 'user', isVideoOn, cameraStream: isVideoOn ? localCameraStream : null });
      seenIds.add(currentUser._id);

      if (isScreenSharing) {
        items.push({ _id: `local-stream`, type: 'stream', isMe: true });
      }

      // 2. Add Socket-connected users (Users we officially know are in channel)
      activeConnectedUsers.forEach(u => {
        if (!seenIds.has(u._id)) {
          const state = userStates.get(u._id) || { isMuted: false, isDeafened: false, isScreenSharing: false, isVideoOn: false };
          items.push({ ...u, isMe: false, isMuted: state.isMuted, isDeafened: state.isDeafened, isScreenSharing: state.isScreenSharing, isVideoOn: state.isVideoOn, cameraStream: state.isVideoOn ? remoteStreams.get(u._id) : null, type: 'user' });
          seenIds.add(u._id);
        }

        const state = userStates.get(u._id);
        if (state?.isScreenSharing && remoteScreenStreams.has(u._id)) {
          items.push({ _id: `stream-${u._id}`, userId: u._id, type: 'stream', isMe: false });
        }
      });

      // 3. Fallback: Add users who are ACTUALLY in LiveKit room but missed by Socket events
      // This prevents participants from "ghosting" (hearing but not seeing them)
      remoteStreams.forEach((stream, userId) => {
        if (!seenIds.has(userId)) {
          // Look up user info in externalParticipants (pre-fetched from API)
          const backupUser = externalParticipants.find(p => p._id === userId);
          const state = userStates.get(userId) || { isMuted: false, isDeafened: false, isScreenSharing: false, isVideoOn: false };

          if (backupUser) {
            items.push({
              ...backupUser,
              isMe: false,
              isMuted: state.isMuted,
              isDeafened: state.isDeafened,
              isScreenSharing: state.isScreenSharing,
              isVideoOn: state.isVideoOn,
              cameraStream: state.isVideoOn ? stream : null,
              type: 'user',
              isGhost: true
            });
          } else {
            // Ultimate fallback: we know they are here because we have their stream
            items.push({
              _id: userId,
              username: `User ${userId.slice(-4)}`,
              isMe: false,
              isMuted: state.isMuted,
              isDeafened: state.isDeafened,
              isScreenSharing: state.isScreenSharing,
              isVideoOn: state.isVideoOn,
              cameraStream: state.isVideoOn ? stream : null,
              type: 'user',
              isPlaceholder: true
            });
          }
          seenIds.add(userId);

          if (state.isScreenSharing && remoteScreenStreams.has(userId)) {
            items.push({ _id: `stream-${userId}`, userId: userId, type: 'stream', isMe: false });
          }
        }
      });
    } else {
      // Not connected view (sidebar preview or before joining)
      externalParticipants.forEach(u => {
        const state = userStates.get(u._id) || { isMuted: false, isDeafened: false, isScreenSharing: false, isVideoOn: false };
        items.push({
          ...u,
          isMe: u._id === currentUser?._id,
          isMuted: state.isMuted,
          isDeafened: state.isDeafened,
          isScreenSharing: state.isScreenSharing,
          isVideoOn: state.isVideoOn,
          cameraStream: null, // Don't preview video if not connected
          type: 'user'
        });
        if (state.isScreenSharing && remoteScreenStreams.has(u._id)) {
          items.push({ _id: `stream-${u._id}`, userId: u._id, type: 'stream', isMe: false });
        }
      });
    }
    return items;
  }, [isConnectedToThisChannel, currentUser, activeConnectedUsers, isMuted, isDeafened, isScreenSharing, isVideoOn, localCameraStream, externalParticipants, userStates, remoteScreenStreams, remoteStreams]);

  useEffect(() => {
    if (!isConnectedToThisChannel) {
      setExpandedStreamId(null);
      setFocusedStreamId(null);
    } else {
      if (expandedStreamId) {
        const streamExists = displayParticipants.some(p => p._id === expandedStreamId);
        if (!streamExists) setExpandedStreamId(null);
      }
      if (focusedStreamId) {
        const streamExists = displayParticipants.some(p => p._id === focusedStreamId);
        if (!streamExists) setFocusedStreamId(null);
      }
    }
  }, [isConnectedToThisChannel, expandedStreamId, focusedStreamId, displayParticipants]);

  const handleConnect = () => joinChannel(channel._id);
  const handleDisconnect = () => {
    setExpandedStreamId(null);
    setFocusedStreamId(null);
    leaveChannel();
  };

  const renderItem = (item: any) => {
    if (item.type === 'stream') {
      const participant = activeConnectedUsers.find(u => u._id === item.userId) || externalParticipants.find(u => u._id === item.userId);
      return (
        <VoiceStreamCard
          key={item._id}
          item={{ ...item, participantName: participant ? getDisplayName(participant) : null }}
          currentUser={currentUser}
          getDisplayName={getDisplayName}
          stopScreenShare={stopScreenShare}
          remoteScreenStreams={remoteScreenStreams}
          watchedScreenIds={watchedScreenIds}
          screenVolumes={screenVolumes}
          setScreenVolume={setScreenVolume}
          setWatchingScreen={setWatchingScreen}
          focusedStreamId={focusedStreamId}
          setFocusedStreamId={setFocusedStreamId}
          expandedStreamId={expandedStreamId}
          setExpandedStreamId={setExpandedStreamId}
          screenStream={screenStream}
        />
      );
    }

    const participant = item;
    const isSpeaking = speakingUsers.has(participant._id) && !participant.isMuted;

    return (
      <VoiceParticipantCard
        key={participant._id}
        participant={participant}
        isSpeaking={isSpeaking}
        onUserClick={onUserClick}
        getDisplayName={getDisplayName}
        onContextMenu={(e: React.MouseEvent) => {
          e.preventDefault();
          if (participant.isMe) return;
          setContextMenu({ x: e.clientX, y: e.clientY, userId: participant._id });
        }}
      />
    );
  };

  const focusedItem = focusedStreamId ? displayParticipants.find(p => p._id === focusedStreamId) : null;

  return (
    <div className="voice-channel-view">
      <header className="voice-hdr">
        <div className="hdr-left">
          <button className="mobile-nav-toggle" onClick={onMobileMenuClick}>
            <MenuIcon size={24} />
          </button>
          <h1>
            <div className="voice-status-indicator inline">
              <div className="pulse-ring"></div>
              <div className="status-dot"></div>
            </div>
            {channel.name}
          </h1>
        </div>
        <div className="hdr-right">
          {channel.topic && <div className="channel-topic-tag">{channel.topic}</div>}
          <div className="channel-status-badge">Подключено</div>
        </div>
      </header>

      {contextMenu && (
        <MemberContextMenu
          user={displayParticipants.find(p => p._id === contextMenu.userId)}
          server={server}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onOpenProfile={onUserClick}
        />
      )}

      <main className="voice-canvas">
        {focusedItem ? (
          <div className="stage-wrap">
            <div className="stage-primary">
              {renderItem(focusedItem)}
            </div>
            <div className="stage-aux">
              {displayParticipants.filter(p => p._id !== focusedStreamId).map(item => renderItem(item))}
            </div>
          </div>
        ) : (
          <div className="grid-wrap">
            <div className={`v-grid count-${displayParticipants.length}`}>
              {displayParticipants.length > 0 ? (
                displayParticipants.map((item) => renderItem(item))
              ) : (
                <div className="v-empty">
                  <div className="v-empty-icon"><SpeakerIcon size={64} /></div>
                  {!isConnectedToThisChannel && (
                    <div className="v-empty-sub">Нажмите кнопку соединения внизу, чтобы начать</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <div className="voice-ctrls-anchor">
        {isConnectedToThisChannel ? (
          <div className="voice-ctrls">
            <button
              className={`ctrl-btn ${isMuted ? 'active' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
            >
              {isMuted ? <MicMutedIcon size={20} /> : <MicIcon size={20} />}
            </button>
            <button
              className={`ctrl-btn ${isDeafened ? 'active' : ''}`}
              onClick={toggleDeafen}
              title={isDeafened ? 'Включить звук' : 'Выключить звук'}
            >
              {isDeafened ? <DeafenedIcon size={20} /> : <SpeakerIcon size={20} />}
            </button>
            <button
              className={`ctrl-btn ${isVideoOn ? 'streaming' : ''}`}
              onClick={toggleVideo}
              title={isVideoOn ? 'Выключить камеру' : 'Включить камеру'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            </button>
            <button
              className={`ctrl-btn ${isScreenSharing ? 'streaming' : ''}`}
              onClick={() => isScreenSharing ? stopScreenShare() : setShowScreenSelector(true)}
              title={isScreenSharing ? 'Прекратить трансляцию' : 'Трансляция экрана'}
            >
              <MonitorIcon size={20} />
            </button>
            <div className="ctrl-sep"></div>
            <button
              className="ctrl-btn hangup"
              onClick={handleDisconnect}
              title="Отключиться"
            >
              <PhoneIcon size={20} />
            </button>
          </div>
        ) : (
          <button className="btn-join" onClick={handleConnect}>
            Подключиться
          </button>
        )}
      </div>

      {showScreenSelector && (
        <ScreenSourceSelector
          onClose={() => setShowScreenSelector(false)}
          onSelect={(id, opts) => {
            startScreenShare(id, { resolution: opts.resolution, frameRate: opts.frameRate });
            setShowScreenSelector(false);
          }}
        />
      )}
    </div>
  );
};

export default VoiceChannelView;

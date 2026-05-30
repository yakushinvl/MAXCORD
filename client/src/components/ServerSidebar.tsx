import React, { useState, useEffect, useRef } from 'react';
import { Server, Channel, User } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import { useSocket } from '../contexts/SocketContext';
import CreateChannelModal from './CreateChannelModal';
import ChannelSettingsModal from './ChannelSettingsModal';
import { HashtagIcon, SpeakerIcon, PlusIcon, SettingsIcon, MicMutedIcon, DeafenedIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useVoice, useVoiceLevels } from '../contexts/VoiceContext';
import { Permissions, hasPermission, computePermissions } from '../utils/permissions';
import './panel-hero.css';
import './ServerSidebar.css';
import InviteModal from './InviteModal';
import MemberContextMenu from './MemberContextMenu';
import UserAvatar from './UserAvatar';
import UserBadges from './UserBadges';
import VoiceControlPanel from './VoiceControlPanel';
import { ConnectionState } from 'livekit-client';

interface ServerSidebarProps {
  server: Server;
  selectedChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
  onChannelCreated?: () => void;
  onUserClick: (userId: string, event?: React.MouseEvent) => void;
  onOpenSettings: () => void;
  onServerClick: () => void;
  unreadCounts: Record<string, number>;
  style?: React.CSSProperties;
}

const ServerSidebar: React.FC<ServerSidebarProps> = ({
  server,
  selectedChannel,
  onChannelSelect,
  onChannelCreated,
  onUserClick,
  onOpenSettings,
  onServerClick,
  unreadCounts,
  style
}) => {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const { joinChannel, userStates, activeChannelId, roomConnectionState } = useVoice();
  const { speakingUsers = new Set<string>() } = useVoiceLevels() || {};

  const isOwner = currentUser && server.owner && (
    (typeof server.owner === 'object' && String((server.owner as any)._id) === String(currentUser._id)) ||
    (String(server.owner) === String(currentUser._id))
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [voiceStates, setVoiceStates] = useState<Record<string, User[]>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, user: User } | null>(null);
  // Drag-to-move state. We keep the source in a REF (not state) because the
  // browser fires `dragover` before React commits the `setDragging` from
  // `dragstart` — without a ref the dragover handler reads `null` and never
  // calls preventDefault, so the browser refuses the drop entirely.
  // `draggingId` state is only for visual feedback (opacity of source).
  const draggingRef = useRef<{ userId: string; fromChannelId: string } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Use computePermissions - it already handles ownership by returning all bits
  const userPerms = currentUser ? computePermissions(currentUser._id, server) : 0n;
  const canManageGuild = hasPermission(userPerms, Permissions.MANAGE_GUILD);
  const canCreateChannels = hasPermission(userPerms, Permissions.MANAGE_CHANNELS);
  const canInvite = hasPermission(userPerms, Permissions.CREATE_INSTANT_INVITE);
  const canMoveMembers = hasPermission(userPerms, Permissions.MOVE_MEMBERS);

  // === Drag handlers (admin-only voice member move) ===
  const handleUserDragStart = (e: React.DragEvent, userId: string, fromChannelId: string) => {
    if (!canMoveMembers) return;
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    // Provide BOTH text/plain (some browsers strip non-standard MIME on Windows)
    // and a custom MIME we can identify in drop.
    const payload = JSON.stringify({ userId, fromChannelId });
    try { e.dataTransfer.setData('application/maxcord-voice-user', payload); } catch {}
    try { e.dataTransfer.setData('text/plain', payload); } catch {}
    draggingRef.current = { userId, fromChannelId };
    setDraggingId(userId);
  };
  const handleUserDragEnd = () => {
    draggingRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
  };
  const handleChannelDragOver = (e: React.DragEvent, channelId: string) => {
    const src = draggingRef.current;
    if (!canMoveMembers || !src) return;
    if (src.fromChannelId === channelId) return; // no-op drop on source
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dropTargetId !== channelId) setDropTargetId(channelId);
  };
  const handleChannelDragLeave = (e: React.DragEvent, channelId: string) => {
    if (e.currentTarget === e.target && dropTargetId === channelId) setDropTargetId(null);
  };
  const handleChannelDrop = (e: React.DragEvent, channelId: string) => {
    if (!canMoveMembers) return;
    e.preventDefault();
    e.stopPropagation();
    // Prefer the custom MIME, fall back to text/plain.
    const raw =
      e.dataTransfer.getData('application/maxcord-voice-user')
      || e.dataTransfer.getData('text/plain');
    draggingRef.current = null;
    setDraggingId(null);
    setDropTargetId(null);
    if (!raw || !socket) return;
    try {
      const { userId, fromChannelId } = JSON.parse(raw) as { userId: string; fromChannelId: string };
      if (!userId || fromChannelId === channelId) return;
      socket.emit('admin-voice-move', { userId, channelId });
    } catch { /* ignore malformed drag data */ }
  };

  /* console.log('ServerSidebar Permissions Debug:', { serverName: server.name, userId: currentUser?._id, isOwner, userPerms: userPerms.toString() }); */

  const handleContextMenu = (e: React.MouseEvent, user: User) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, user });
  };

  const textChannels = (server.channels || []).filter(c => c.type === 'text');
  const voiceChannels = (server.channels || []).filter(c => c.type === 'voice');

  useEffect(() => {
    if (socket) {
      socket.emit('join-server', server._id);
      socket.on('server-voice-states', (states) => setVoiceStates(states));
      socket.on('voice-channel-users-update', (data) => {
        setVoiceStates(prev => ({ ...prev, [data.channelId]: data.users }));
      });
      return () => {
        socket.emit('leave-server', server._id);
        socket.off('server-voice-states');
        socket.off('voice-channel-users-update');
      };
    }
  }, [socket, server._id]);

  const handleChannelCreated = () => {
    if (onChannelCreated) onChannelCreated();
    setShowCreateModal(false);
  };

  return (
    <div className="server-sidebar panel-hero" style={style}>
      <div className="panel-hero-bg" aria-hidden="true">
        <div className="blob cyan" />
        <div className="blob purple" />
        <div className="blob pink" />
      </div>
      <div className="server-header">
        <div className="server-header-left" onClick={onServerClick} style={{ cursor: 'pointer' }}>
          {server.icon ? (
            <div className="server-header-icon"><img src={getAvatarUrl(server.icon)!} alt="" /></div>
          ) : (
            <div className="server-header-icon-placeholder">{server.name.charAt(0).toUpperCase()}</div>
          )}
          <h2>{server.name}</h2>
        </div>
        <div className="server-header-actions">
          {canInvite && <button className="invite-button" onClick={() => setShowInviteModal(true)} title="Пригласить друзей"><PlusIcon size={18} /></button>}
          {canManageGuild && <button className="settings-button" onClick={onOpenSettings} title="Настройки сервера"><SettingsIcon size={18} /></button>}
        </div>
      </div>

      <div className="channels-list">
        {textChannels.length > 0 && (
          <div className="channel-category">
            <div className="category-header">
              <span>ТЕКСТОВЫЕ КАНАЛЫ</span>
              {canCreateChannels && <button className="add-channel-button" onClick={() => setShowCreateModal(true)} title="Создать канал"><PlusIcon size={18} /></button>}
            </div>
            {textChannels.map((channel) => {
              const channelPerms = currentUser ? computePermissions(currentUser._id, server, channel) : 0n;
              if (!hasPermission(channelPerms, Permissions.VIEW_CHANNEL)) return null;

              const canEditThisChannel = hasPermission(channelPerms, Permissions.MANAGE_CHANNELS);

              return (
                <div key={channel._id} className={`channel-item ${selectedChannel?._id === channel._id ? 'active' : ''} ${unreadCounts[channel._id] > 0 ? 'unread' : ''}`} onClick={() => onChannelSelect(channel)}>
                  <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <span className="channel-icon">#</span>
                    <span className="channel-name">{channel.name}</span>
                  </div>
                  <div className="channel-actions">
                    {unreadCounts[channel._id] > 0 && <div className="channel-unread-badge" style={{ marginRight: '4px' }}>{unreadCounts[channel._id]}</div>}
                    {canEditThisChannel && (
                      <button className="channel-settings-icon" onClick={(e) => { e.stopPropagation(); setEditingChannel(channel); }}>
                        <SettingsIcon size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {voiceChannels.length > 0 && (
          <div className="channel-category">
            <div className="category-header">
              <span>ГОЛОСОВЫЕ КАНАЛЫ</span>
              {canCreateChannels && <button className="add-channel-button" onClick={() => setShowCreateModal(true)} title="Создать канал"><PlusIcon size={18} /></button>}
            </div>
            {voiceChannels.map((channel) => {
              const channelPerms = currentUser ? computePermissions(currentUser._id, server, channel) : 0n;
              if (!hasPermission(channelPerms, Permissions.VIEW_CHANNEL)) return null;

              const canEditThisChannel = hasPermission(channelPerms, Permissions.MANAGE_CHANNELS);

              const isDropTarget = canMoveMembers && dropTargetId === channel._id;
              return (
                <div key={channel._id}>
                  <div
                    className={`channel-item ${selectedChannel?._id === channel._id ? 'active' : ''} ${isDropTarget ? 'is-drop-target' : ''}`}
                    onClick={() => {
                      onChannelSelect(channel);
                      if (activeChannelId !== channel._id) {
                        joinChannel(channel._id);
                      }
                    }}
                    onDragOver={(e) => handleChannelDragOver(e, channel._id)}
                    onDragLeave={(e) => handleChannelDragLeave(e, channel._id)}
                    onDrop={(e) => handleChannelDrop(e, channel._id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <span className="channel-icon">
                        {activeChannelId === channel._id ? (
                          <div className={`voice-status-indicator sidebar-inline ${
                            roomConnectionState === ConnectionState.Connecting || 
                            roomConnectionState === ConnectionState.Reconnecting ? 'connecting' : ''
                          }`}>
                            <div className="pulse-ring"></div>
                            <div className="status-dot"></div>
                          </div>
                        ) : (
                          <SpeakerIcon size={18} />
                        )}
                      </span>
                      <span className="channel-name">{channel.name}</span>
                    </div>
                    <div className="channel-actions">
                      {canEditThisChannel && (
                        <button className="channel-settings-icon" onClick={(e) => { e.stopPropagation(); setEditingChannel(channel); }}>
                          <SettingsIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {voiceStates[channel._id] && voiceStates[channel._id].length > 0 && (
                    <div className="voice-channel-users">
                      {voiceStates[channel._id].map(u => (
                        <div
                          key={u._id}
                          className={`voice-user-item ${speakingUsers.has(u._id) ? 'speaking' : ''} ${draggingId === u._id ? 'is-dragging' : ''} ${canMoveMembers ? 'is-draggable' : ''}`}
                          draggable={canMoveMembers}
                          onDragStart={(e) => handleUserDragStart(e, u._id, channel._id)}
                          onDragEnd={handleUserDragEnd}
                          onClick={(e) => { e.stopPropagation(); onUserClick(u._id, e); }}
                          onContextMenu={(e) => handleContextMenu(e, u)}
                          title={canMoveMembers ? 'Перетащите для перемещения в другой канал' : undefined}
                        >
                          <div className={`voice-user-avatar ${speakingUsers.has(u._id) ? 'speaking' : ''}`}>
                            {/* draggable={false} on the <img> — otherwise the browser's default
                                image-drag intercepts the parent's drag and our dragstart never fires. */}
                            {getAvatarUrl(u.avatar) ? <img src={getAvatarUrl(u.avatar)!} alt="" draggable={false} /> : <span>{u.username.charAt(0).toUpperCase()}</span>}
                          </div>
                          <div className="voice-user-name-row">
                            <span className={`voice-user-name ${speakingUsers.has(u._id) ? 'speaking' : ''}`}>
                              {server.members.find(m => String((m.user as any)._id || m.user) === String(u._id))?.nickname || u.username}
                            </span>
                            <UserBadges badges={u.badges} size={12} />
                          </div>
                          <div className="voice-user-icons">
                            {userStates.get(u._id)?.isScreenSharing && (
                              <div className="live-badge nano">ЭФИР</div>
                            )}
                            {((u as any).isDeafened || (u as any).isServerDeafened) ? (
                              <DeafenedIcon size={14} color="#f23f42" />
                            ) : ((u as any).isMuted || (u as any).isServerMuted) ? (
                              <MicMutedIcon size={14} color="#f23f42" />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && <CreateChannelModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} serverId={server._id} onChannelCreated={handleChannelCreated} />}
      {showInviteModal && <InviteModal isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} serverId={server._id} serverName={server.name} />}
      {editingChannel && (
        <ChannelSettingsModal
          isOpen={!!editingChannel}
          onClose={() => setEditingChannel(null)}
          channel={editingChannel}
          server={server}
          onChannelUpdate={(updated) => {
            // Updated via server-updated socket usually, but for instant UI:
            if (onChannelCreated) onChannelCreated();
          }}
          onChannelDelete={(id) => {
            if (onChannelCreated) onChannelCreated();
          }}
        />
      )}
      {contextMenu && <MemberContextMenu user={contextMenu.user} server={server} x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} onOpenProfile={onUserClick} />}

      <VoiceControlPanel />
    </div>
  );
};

export default ServerSidebar;

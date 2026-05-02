import React, { useState } from 'react';
import { User, Server } from '../types';
import SettingsModal from './SettingsModal';
import JoinServerModal from './JoinServerModal';
import { getAvatarUrl } from '../utils/avatar';
import UserAvatar from './UserAvatar';
import { UsersIcon, PlusIcon, SettingsIcon, BellIcon, LayoutGridIcon } from './Icons';
import ServerContextMenu from './ServerContextMenu';
import './Sidebar.css';

interface SidebarProps {
  user: User;
  servers: Server[];
  unreadCounts: Record<string, number>;
  selectedServer: Server | null;
  onServerSelect: (server: Server) => void;
  onCreateServer: (name: string) => void;
  onServerJoined: (server: Server) => void;
  onLogout: () => void;
  onShowFriends: () => void;
  showFriends?: boolean;
  onShowShowcase: () => void;
  showShowcase?: boolean;
  onServerLeave: (serverId: string) => void;
  onOpenJoinModal: () => void;
  onOpenSettings: () => void;
  onOpenProfile: (userId: string, event?: React.MouseEvent) => void;
  onToggleInbox: () => void;
  inboxUnreadCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  servers,
  unreadCounts,
  selectedServer,
  onServerSelect,
  onCreateServer,
  onServerJoined,
  onLogout,
  onShowFriends,
  showFriends,
  onShowShowcase,
  showShowcase,
  onServerLeave,
  onOpenJoinModal,
  onOpenSettings,
  onOpenProfile,
  onToggleInbox,
  inboxUnreadCount
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, server: Server } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, server: Server) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, server });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-servers">
        <div className="server-icon inbox-sidebar-icon" onClick={onToggleInbox} title="Уведомления">
          <BellIcon size={28} color="var(--secondary-neon)" />
          {inboxUnreadCount > 0 && <div className="unread-badge">{inboxUnreadCount > 9 ? '9+' : inboxUnreadCount}</div>}
        </div>
        <div className={`server-icon home-icon ${showFriends && !selectedServer ? 'active' : ''}`} onClick={onShowFriends} title="Друзья">
          <UsersIcon size={28} />
          {Object.entries(unreadCounts).some(([id, count]) => count > 0 && !servers.some(s => s.channels.some(c => c._id === id))) && (
            <div className="unread-badge"></div>
          )}
        </div>
        <div className={`server-icon home-icon ${showShowcase ? 'active' : ''}`} onClick={onShowShowcase} title="Витрина ботов и мини-приложений">
          <LayoutGridIcon size={28} />
        </div>
        <div className="server-icon home-icon" onClick={onOpenJoinModal} title="Добавить сервер">
          <PlusIcon size={28} color="var(--primary-neon)" />
        </div>
        <div className="sidebar-divider" />
        {servers.map((server) => (
          <div
            key={server._id}
            className={`server-icon ${selectedServer?._id === server._id ? 'active' : ''}`}
            onClick={() => onServerSelect(server)}
            onContextMenu={(e) => handleContextMenu(e, server)}
            title={server.name}
          >
            <UserAvatar
              user={{ username: server.name, avatar: server.icon }}
              size={48}
              className="server-icon-avatar"
            />
            {server.channels.some(c => unreadCounts[c._id] > 0) && (
              <div className="unread-badge"></div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-user">
        <div
          className="user-avatar-wrapper"
          title={`${user.username} (${user.status})`}
          onClick={(e) => onOpenProfile(user._id, e)}
          style={{ position: 'relative' }}
        >
          <UserAvatar
            user={user}
            size={38}
            className="user-avatar"
          />
          <div className={`status-indicator ${user.status}`}></div>
        </div>
        <button className="logout-button" onClick={onOpenSettings} title="Настройки">
          <SettingsIcon size={20} />
        </button>
      </div>


      {contextMenu && (
        <ServerContextMenu
          server={contextMenu.server}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onLeave={onServerLeave}
        />
      )}
    </div>
  );
};

export default Sidebar;


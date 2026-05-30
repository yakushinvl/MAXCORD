import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Server, MiniApp } from '../types';
import SettingsModal from './SettingsModal';
import JoinServerModal from './JoinServerModal';
import { getAvatarUrl } from '../utils/avatar';
import UserAvatar from './UserAvatar';
import { UsersIcon, PlusIcon, SettingsIcon, BellIcon, LayoutGridIcon } from './Icons';
import ServerContextMenu from './ServerContextMenu';
import { iosSpringSnappy } from '../animations/transitions';
import './panel-hero.css';
import './Sidebar.css';

// iOS-style press feedback shared across every clickable server-icon button.
const pressFeedback = {
  whileTap: { scale: 0.88 },
  whileHover: { scale: 1.06 },
  transition: iosSpringSnappy,
};

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
  minimizedMiniApps?: MiniApp[];
  onRestoreMiniApp?: (appId: string) => void;
  onCloseMiniApp?: (appId: string) => void;
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
  inboxUnreadCount,
  minimizedMiniApps = [],
  onRestoreMiniApp,
  onCloseMiniApp,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, server: Server } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, server: Server) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, server });
  };

  return (
    <div className="sidebar panel-hero">
      <div className="panel-hero-bg" aria-hidden="true">
        <div className="blob cyan" />
        <div className="blob purple" />
        <div className="blob pink" />
      </div>
      <div className="sidebar-servers">
        <div className="server-item">
          <div className="pill"><span /></div>
          <motion.div
            className="server-icon inbox-sidebar-icon"
            onClick={onToggleInbox}
            title="Уведомления"
            {...pressFeedback}
          >
            <BellIcon size={28} color="var(--secondary-neon)" />
            {inboxUnreadCount > 0 && <div className="unread-badge">{inboxUnreadCount > 9 ? '9+' : inboxUnreadCount}</div>}
          </motion.div>
        </div>

        <div className={`server-item ${showFriends ? 'active' : ''}`}>
          <div className="pill"><span /></div>
          <motion.div
            className={`server-icon friends-sidebar-icon ${showFriends ? 'active' : ''}`}
            onClick={onShowFriends}
            title="Друзья"
            {...pressFeedback}
          >
            <UsersIcon size={28} />
            {Object.entries(unreadCounts).some(([id, count]) => count > 0 && !servers.some(s => s.channels.some(c => c._id === id))) && (
              <div className="unread-badge"></div>
            )}
          </motion.div>
        </div>

        <div className={`server-item ${showShowcase ? 'active' : ''}`}>
          <div className="pill"><span /></div>
          <motion.div
            className={`server-icon showcase-sidebar-icon ${showShowcase ? 'active' : ''}`}
            onClick={onShowShowcase}
            title="Витрина ботов и мини-приложений"
            {...pressFeedback}
          >
            <LayoutGridIcon size={28} color="var(--accent-pink)" />
          </motion.div>
        </div>

        <AnimatePresence>
          {minimizedMiniApps.map(app => (
            <motion.div
              key={app._id}
              className="server-item"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
            >
              <div className="pill"><span /></div>
              <motion.div
                className="server-icon miniapp-minimized-icon"
                onClick={() => onRestoreMiniApp?.(app._id)}
                onContextMenu={(e) => { e.preventDefault(); onCloseMiniApp?.(app._id); }}
                title={`${app.name} — нажми чтобы развернуть, ПКМ — закрыть`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileTap={{ scale: 0.88 }}
                whileHover={{ scale: 1.06 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.7 }}
              >
                {app.avatar ? (
                  <img src={getAvatarUrl(app.avatar) || ''} alt={app.name} />
                ) : (
                  <LayoutGridIcon size={24} color="var(--accent-pink)" />
                )}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="server-item">
          <div className="pill"><span /></div>
          <motion.div
            className="server-icon home-icon"
            onClick={onOpenJoinModal}
            title="Добавить сервер"
            {...pressFeedback}
          >
            <PlusIcon size={28} color="var(--primary-neon)" />
          </motion.div>
        </div>

        <div className="sidebar-divider" />
        
        {Array.isArray(servers) && servers.map((server) => (
          <div key={server._id} className={`server-item ${selectedServer?._id === server._id ? 'active' : ''}`}>
            <div className="pill"><span /></div>
            <motion.div
              className={`server-icon ${selectedServer?._id === server._id ? 'active' : ''}`}
              onClick={() => onServerSelect(server)}
              onContextMenu={(e) => handleContextMenu(e, server)}
              title={server.name}
              {...pressFeedback}
            >
              <UserAvatar
                user={{ username: server.name, avatar: server.icon }}
                size={48}
                className="server-icon-avatar"
              />
              {server.channels.some(c => unreadCounts[c._id] > 0) && (
                <div className="unread-badge"></div>
              )}
            </motion.div>
          </div>
        ))}
      </div>

      <div className="sidebar-user">
        <motion.div
          className="user-avatar-wrapper"
          title={`${user.username} (${user.status})`}
          onClick={(e) => onOpenProfile(user._id, e)}
          style={{ position: 'relative' }}
          {...pressFeedback}
        >
          <UserAvatar
            user={user}
            size={38}
            className="user-avatar"
          />
          <div className={`status-indicator ${user.status}`}></div>
        </motion.div>
        <motion.button
          className="logout-button"
          onClick={onOpenSettings}
          title="Настройки"
          whileTap={{ scale: 0.88, rotate: 30 }}
          whileHover={{ scale: 1.08, rotate: -8 }}
          transition={iosSpringSnappy}
        >
          <SettingsIcon size={20} />
        </motion.button>
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


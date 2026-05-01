import React from 'react';
import './UserBadges.css';

export interface Badge {
  id: string;
  label: string;
  icon: string;
}

export const BADGES: Record<string, Badge> = {
  dev: { id: 'dev', label: 'Разработчик', icon: '🛠️' },
  premium: { id: 'premium', label: 'Премиум', icon: '💎' },
  moderator: { id: 'moderator', label: 'Модератор', icon: '🛡️' },
  artist: { id: 'artist', label: 'Художник', icon: '🎨' },
  gamer: { id: 'gamer', label: 'Геймер', icon: '🎮' },
  meow: { id: 'meow', label: 'Котик', icon: '🐈' },
  staff: { id: 'staff', label: 'Персонал', icon: '👔' },
  bug_hunter: { id: 'bug_hunter', label: 'Охотник за багами', icon: '🐛' }
};

interface UserBadgesProps {
  badges?: string[];
  size?: number;
  className?: string;
}

const UserBadges: React.FC<UserBadgesProps> = ({ badges, size = 16, className = "" }) => {
  if (!badges || badges.length === 0) return null;

  return (
    <div className={`user-badges-container ${className}`}>
      {badges.map(badgeId => {
        const badge = BADGES[badgeId];
        if (!badge) return null;
        return (
          <div 
            key={badgeId} 
            className="user-badge" 
            title={badge.label}
            style={{ fontSize: `${size}px` }}
          >
            {badge.icon}
          </div>
        );
      })}
    </div>
  );
};

export default UserBadges;

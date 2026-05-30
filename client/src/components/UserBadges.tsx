import React from 'react';
import './UserBadges.css';

export interface Badge {
  id: string;
  label: string;
  icon: string;
}

export const BADGES: Record<string, Badge> = {
  dev: { id: 'dev', label: 'Разработчик', icon: './badges/developer.png' },
  premium: { id: 'premium', label: 'Премиум', icon: './badges/premium.png' },
  moderator: { id: 'moderator', label: 'Модератор', icon: './badges/moderate.png' },
  artist: { id: 'artist', label: 'Художник', icon: './badges/painter.png' },
  gamer: { id: 'gamer', label: 'Геймер', icon: './badges/gamer.png' },
  meow: { id: 'meow', label: 'Котик', icon: './badges/cat.png' },
  staff: { id: 'staff', label: 'Персонал', icon: './badges/personal%20stuff.png' },
  bug_hunter: { id: 'bug_hunter', label: 'Охотник за багами', icon: './badges/Bug.png' }
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
          <img 
            key={badgeId} 
            src={badge.icon}
            alt={badge.label}
            className="user-badge" 
            title={badge.label}
            style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
          />
        );
      })}
    </div>
  );
};

export default UserBadges;

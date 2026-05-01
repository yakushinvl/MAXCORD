import React from 'react';
import { getFullUrl } from '../utils/avatar';
import './Reactions.css';

interface Reaction {
    emoji: string;
    users: string[];
}

interface ReactionsProps {
    reactions: Reaction[];
    currentUserId: string;
    onReact: (emoji: string) => void;
}

const Reactions: React.FC<ReactionsProps> = ({ reactions, currentUserId, onReact }) => {
    if (!reactions || reactions.length === 0) return null;

    const isCustomEmoji = (emoji: string) => emoji.startsWith('/') || emoji.startsWith('http');

    return (
        <div className="message-reactions">
            {reactions.map((reaction, index) => {
                const hasReacted = reaction.users.includes(currentUserId);
                return (
                    <button
                        key={index}
                        className={`reaction-pill ${hasReacted ? 'active' : ''}`}
                        onClick={() => onReact(reaction.emoji)}
                        title={reaction.users.length > 0 ? `${reaction.users.length} чел. оценили` : ''}
                    >
                        {isCustomEmoji(reaction.emoji) ? (
                            <img src={getFullUrl(reaction.emoji) || ''} alt="reaction" className="custom-emoji-reaction" />
                        ) : (
                            <span className="emoji-reaction">{reaction.emoji}</span>
                        )}
                        <span className="reaction-count">{reaction.users.length}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default Reactions;

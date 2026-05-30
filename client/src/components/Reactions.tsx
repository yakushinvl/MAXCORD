import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getFullUrl } from '../utils/avatar';
import { iosSpringSnappy } from '../animations/transitions';
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
            <AnimatePresence initial={false}>
                {reactions.map((reaction) => {
                    const hasReacted = reaction.users.includes(currentUserId);
                    return (
                        <motion.button
                            key={reaction.emoji}
                            layout
                            className={`reaction-pill ${hasReacted ? 'active' : ''}`}
                            onClick={() => onReact(reaction.emoji)}
                            title={reaction.users.length > 0 ? `${reaction.users.length} чел. оценили` : ''}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            transition={iosSpringSnappy}
                            whileTap={{ scale: 0.9 }}
                        >
                            {isCustomEmoji(reaction.emoji) ? (
                                <img src={getFullUrl(reaction.emoji) || ''} alt="reaction" className="custom-emoji-reaction" />
                            ) : (
                                <span className="emoji-reaction">{reaction.emoji}</span>
                            )}
                            <motion.span
                                key={reaction.users.length}
                                className="reaction-count"
                                initial={{ scale: 1.4, opacity: 0.6 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={iosSpringSnappy}
                            >
                                {reaction.users.length}
                            </motion.span>
                        </motion.button>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default Reactions;

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Message } from '../types';
import { PinIcon, ChevronDownIcon, ChevronUpIcon, CameraIcon } from './Icons';
import UserAvatar from './UserAvatar';
import UserBadges from './UserBadges';
import { getFullUrl } from '../utils/avatar';
import { iosSpring } from '../animations/transitions';
import './StickyPins.css';

interface StickyPinsProps {
    pinnedMessages: Message[];
    onOpenPins: () => void;
}

const StickyPins: React.FC<StickyPinsProps> = ({ pinnedMessages, onOpenPins }) => {
    const hasPins = pinnedMessages.length > 0;
    const latestPin = hasPins ? pinnedMessages[0] : null;
    const firstMediaAttachment = latestPin?.attachments?.find(a =>
        a.type?.startsWith('image/') || a.type?.startsWith('video/')
    );

    return (
        <AnimatePresence initial={false}>
            {hasPins && latestPin && (
                <motion.div
                    className="sticky-pins-container"
                    onClick={onOpenPins}
                    initial={{ opacity: 0, y: -12, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={iosSpring}
                    style={{ overflow: 'hidden' }}
                >
                    <div className="sticky-pin-header">
                        <div className="sticky-pin-icon-wrap">
                            <PinIcon size={14} fill="var(--primary-neon)" color="var(--primary-neon)" />
                        </div>

                        {firstMediaAttachment && (
                            <div className="sticky-pin-media-preview">
                                {firstMediaAttachment.type?.startsWith('image/') ? (
                                    <img src={getFullUrl(firstMediaAttachment.url)!} alt="" />
                                ) : (
                                    <div className="video-placeholder-mini">
                                        <CameraIcon size={14} />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="sticky-pin-content">
                            <span className="sticky-pin-label">Закрепленное сообщение</span>
                            <div className="sticky-pin-snippet">
                                <strong>{latestPin.author.username}</strong>
                                <UserBadges badges={latestPin.author.badges} size={12} />
                                <strong>:</strong> {latestPin.content || (latestPin.attachments?.length ? 'Вложение' : '')}
                            </div>
                        </div>
                        <div className="sticky-pin-count">
                            {pinnedMessages.length > 1 ? `+${pinnedMessages.length - 1}` : ''}
                            <ChevronDownIcon size={18} />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default StickyPins;

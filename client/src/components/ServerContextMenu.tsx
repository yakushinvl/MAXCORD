import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { Server } from '../types';
import axios from 'axios';
import { useDialog } from '../contexts/DialogContext';
import { popoverVariants, popoverTransition } from '../animations/transitions';
import './MemberContextMenu.css'; // Reusing context menu styles

interface ServerContextMenuProps {
    server: Server;
    x: number;
    y: number;
    onClose: () => void;
    onLeave: (serverId: string) => void;
}

const ServerContextMenu: React.FC<ServerContextMenuProps> = ({ server, x, y, onClose, onLeave }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const { confirm, alert } = useDialog();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleLeaveServer = async () => {
        if (await confirm(`Вы уверены, что хотите покинуть сервер "${server.name}"?`)) {
            try {
                await axios.post(`/api/servers/${server._id}/leave`);
                onLeave(server._id);
                onClose();
            } catch (err) {
                await alert('Не удалось покинуть сервер');
            }
        }
    };

    const adjustedX = Math.min(x, window.innerWidth - 200);
    const adjustedY = Math.min(y, window.innerHeight - 100);

    // Origin positioned at the click point so the popover scales from where the user clicked.
    const originX = `${Math.max(0, x - adjustedX)}px`;
    const originY = `${Math.max(0, y - adjustedY)}px`;

    return ReactDOM.createPortal(
        <motion.div
            ref={menuRef}
            className="member-context-menu"
            style={{ top: adjustedY, left: adjustedX, minWidth: '160px', transformOrigin: `${originX} ${originY}` }}
            variants={popoverVariants}
            initial="initial" animate="animate"
            transition={popoverTransition}
        >
            <div className="menu-group">
                <div className="menu-item destructive" onClick={handleLeaveServer}>
                    Покинуть сервер
                </div>
            </div>
        </motion.div>,
        document.body
    );
};

export default ServerContextMenu;

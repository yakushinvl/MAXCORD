import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Server } from '../types';
import axios from 'axios';
import { useDialog } from '../contexts/DialogContext';
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

    return ReactDOM.createPortal(
        <div className="member-context-menu" ref={menuRef} style={{ top: adjustedY, left: adjustedX, minWidth: '160px' }}>
            <div className="menu-group">
                <div className="menu-item destructive" onClick={handleLeaveServer}>
                    Покинуть сервер
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ServerContextMenu;

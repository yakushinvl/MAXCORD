import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { User } from '../types';
import UserAvatar from './UserAvatar';
import UserBadges from './UserBadges';
import { CloseIcon, SearchIcon, PlusIcon } from './Icons';
import './CreateGroupDMModal.css';

interface CreateGroupDMModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (dmId: string) => void;
    friends: User[];
}

const CreateGroupDMModal: React.FC<CreateGroupDMModalProps> = ({ isOpen, onClose, onCreated, friends }) => {
    const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const filteredFriends = friends.filter(f =>
        f.username.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !selectedUsers.some(u => u._id === f._id)
    );

    const toggleUser = (user: User) => {
        if (selectedUsers.some(u => u._id === user._id)) {
            setSelectedUsers(selectedUsers.filter(u => u._id !== user._id));
        } else if (selectedUsers.length < 9) {
            setSelectedUsers([...selectedUsers, user]);
        }
    };

    const handleCreate = async () => {
        if (selectedUsers.length === 0) return;
        setLoading(true);
        try {
            const userIds = selectedUsers.map(u => u._id);
            const response = await axios.post('/api/direct-messages/group', {
                userIds,
                name: groupName.trim() || null
            });
            onCreated(response.data._id);
            onClose();
        } catch (error) {
            console.error('Error creating group DM:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="create-group-modal glass-panel-base" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="header-title">
                        <h2>Создать группу</h2>
                        <p>{selectedUsers.length}/10 участников</p>
                    </div>
                    <button className="close-button" onClick={onClose}><CloseIcon size={20} /></button>
                </div>

                <div className="modal-content">
                    <div className="group-name-input-wrapper">
                        <input
                            type="text"
                            placeholder="Название группы (необязательно)"
                            value={groupName}
                            onChange={e => setGroupName(e.target.value)}
                            className="group-name-input"
                        />
                    </div>

                    <div className="search-wrapper">
                        <SearchIcon size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Поиск друзей..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="user-search-input"
                        />
                    </div>

                    {selectedUsers.length > 0 && (
                        <div className="selected-users-list custom-scrollbar">
                            {selectedUsers.map(u => (
                                <div key={u._id} className="selected-user-tag" onClick={() => toggleUser(u)}>
                                    <span>{u.username}</span>
                                    <CloseIcon size={12} />
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="friends-selection-list custom-scrollbar">
                        {filteredFriends.length === 0 ? (
                            <div className="empty-friends-search">
                                {searchQuery ? 'Друзья не найдены' : 'Список друзей пуст'}
                            </div>
                        ) : (
                            filteredFriends.map(f => (
                                <div key={f._id} className="user-selection-item" onClick={() => toggleUser(f)}>
                                    <div className="user-info">
                                        <UserAvatar user={f} size={32} />
                                        <span className="username">{f.username}</span>
                                        <UserBadges badges={f.badges} size={12} />
                                    </div>
                                    <div className={`checkbox ${selectedUsers.some(u => u._id === f._id) ? 'checked' : ''}`}>
                                        {selectedUsers.some(u => u._id === f._id) && <div style={{ transform: 'rotate(45deg)', display: 'flex' }}><PlusIcon size={12} /></div>}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose}>Отмена</button>
                    <button
                        className="create-btn"
                        onClick={handleCreate}
                        disabled={selectedUsers.length === 0 || loading}
                    >
                        {loading ? 'Создание...' : 'Создать группу'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateGroupDMModal;

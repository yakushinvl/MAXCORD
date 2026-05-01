import React, { useState, useEffect, useRef } from 'react';
import { User, Role } from '../types';
import { getAvatarUrl } from '../utils/avatar';
import UserBadges from './UserBadges';
import './MentionAutocomplete.css';

interface MentionAutocompleteProps {
    query: string;
    items: (User | Role)[];
    onSelect: (item: User | Role) => void;
    onClose: () => void;
}

const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({ query, items, onSelect, onClose }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filter items based on query
    const filteredItems = items.filter(item => {
        const name = 'username' in item ? item.username : item.name;
        return name.toLowerCase().includes(query.toLowerCase());
    }).sort((a, b) => {
        const nameA = 'username' in a ? a.username : a.name;
        const nameB = 'username' in b ? b.username : b.name;
        return nameA.localeCompare(nameB);
    }).slice(0, 10); // Limit results

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredItems.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    onSelect(filteredItems[selectedIndex]);
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filteredItems, selectedIndex, onSelect, onClose]);

    if (filteredItems.length === 0) return null;

    return (
        <div className="mention-autocomplete" ref={scrollRef}>
            <div className="mention-autocomplete-header">
                {query ? `Поиск: ${query}` : 'Упомянуть...'}
            </div>
            <div className="mention-autocomplete-list">
                {filteredItems.map((item, index) => {
                    const isUser = 'username' in item;
                    const name = isUser ? item.username : item.name;

                    return (
                        <div
                            key={'_id' in item ? item._id : (item as any).id || index}
                            className={`mention-item ${index === selectedIndex ? 'selected' : ''} ${!isUser ? 'role-item' : ''}`}
                            onClick={() => onSelect(item)}
                        >
                            {isUser ? (
                                <div className="mention-item-avatar">
                                    {getAvatarUrl(item.avatar) ? (
                                        <img src={getAvatarUrl(item.avatar)!} alt="" />
                                    ) : (
                                        <span>{name.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                            ) : (
                                <div className="mention-item-role-icon" style={{ backgroundColor: item.color }}>
                                    @
                                </div>
                            )}
                            <div className="mention-item-name" style={{ color: !isUser ? item.color : 'inherit' }}>
                                {name}
                                {isUser && <UserBadges badges={item.badges} size={12} />}
                                {!isUser && <span className="role-tag">Роль</span>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MentionAutocomplete;

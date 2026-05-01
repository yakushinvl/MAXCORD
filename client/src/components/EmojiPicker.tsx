import React, { useState } from 'react';
import { Emoji, Server } from '../types';
import { getFullUrl } from '../utils/avatar';
import './EmojiPicker.css';

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    server?: Server;
}

const COMMON_EMOJIS = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
];

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, server }) => {
    const [search, setSearch] = useState('');

    const filteredEmojis = COMMON_EMOJIS.filter(e => e.includes(search));
    const serverEmojis = server?.emojis || [];

    return (
        <div className="emoji-picker glass-panel-base">
            <div className="emoji-picker-search">
                <input
                    type="text"
                    placeholder="Поиск эмодзи..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                />
            </div>
            <div className="emoji-picker-scroll">
                {serverEmojis.length > 0 && !search && (
                    <div className="emoji-category">
                        <div className="category-title">ЭМОДЗИ СЕРВЕРА</div>
                        <div className="emoji-grid">
                            {serverEmojis.map(emoji => (
                                <button
                                    key={emoji.id}
                                    className="emoji-item custom"
                                    onClick={() => onSelect(emoji.url)}
                                    title={`:${emoji.name}:`}
                                >
                                    <img src={getFullUrl(emoji.url) || ''} alt={emoji.name} />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="emoji-category">
                    <div className="category-title">ВСЕ ЭМОДЗИ</div>
                    <div className="emoji-grid">
                        {filteredEmojis.map(emoji => (
                            <button
                                key={emoji}
                                className="emoji-item"
                                onClick={() => onSelect(emoji)}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmojiPicker;

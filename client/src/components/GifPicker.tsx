import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './GifPicker.css';

interface GifPickerProps {
    onSelect: (url: string) => void;
    onClose: () => void;
}

const TENOR_API_KEY = 'LIVDSRZULELA'; // Public test key

const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
    const [query, setQuery] = useState('');
    const [gifs, setGifs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const fetchGifs = async (searchQuery: string) => {
        setLoading(true);
        try {
            let url = `https://g.tenor.com/v1/trending?key=${TENOR_API_KEY}&limit=20`;
            if (searchQuery.trim()) {
                url = `https://g.tenor.com/v1/search?q=${encodeURIComponent(searchQuery)}&key=${TENOR_API_KEY}&limit=20`;
            }
            const response = await axios.get(url);
            setGifs(response.data.results || []);
        } catch (e) {
            console.error('Failed to fetch GIFs:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGifs('');
    }, []);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        searchTimeoutRef.current = setTimeout(() => {
            fetchGifs(val);
        }, 500);
    };

    return (
        <div className="gif-picker-container glass-panel-base" onClick={(e) => e.stopPropagation()}>
            <div className="gif-picker-header">
                <input
                    type="text"
                    placeholder="Поиск GIF..."
                    value={query}
                    onChange={handleSearch}
                    className="gif-search-input settings-input"
                    autoFocus
                />
            </div>
            <div className="gif-picker-content">
                {loading && gifs.length === 0 ? (
                    <div className="gif-loading">Загрузка...</div>
                ) : (
                    <div className="gif-grid">
                        {gifs.map((gif) => (
                            <div
                                key={gif.id}
                                className="gif-item"
                                onClick={() => {
                                    const url = gif.media[0]?.gif?.url;
                                    if (url) {
                                        onSelect(url);
                                    }
                                }}
                            >
                                <img src={gif.media[0]?.nanogif?.url || gif.media[0]?.gif?.url} alt="gif" loading="lazy" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GifPicker;

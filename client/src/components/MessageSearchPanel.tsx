import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchIcon, CloseIcon } from './Icons';
import UserAvatar from './UserAvatar';
import './MessageSearchPanel.css';

interface SearchAuthor {
    _id: string;
    username: string;
    avatar?: string;
    badges?: any;
}

interface SearchResult {
    _id: string;
    content: string;
    createdAt: string;
    author: SearchAuthor;
}

interface MessageSearchPanelProps {
    open: boolean;
    onClose: () => void;
    /** Endpoint that responds with { results: SearchResult[], hasMore: boolean } and accepts `q`, `before`, `limit` query params. */
    endpoint: string;
    onJump: (messageId: string, createdAt: string) => void;
}

const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) {
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};

const highlight = (text: string, q: string) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + q.length);
    const after = text.slice(idx + q.length);
    return (
        <>
            {before}
            <mark className="search-highlight">{match}</mark>
            {after}
        </>
    );
};

const MessageSearchPanel: React.FC<MessageSearchPanelProps> = ({ open, onClose, endpoint, onJump }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (open) {
            const t = window.setTimeout(() => inputRef.current?.focus(), 200);
            return () => window.clearTimeout(t);
        } else {
            setQuery('');
            setResults([]);
            setHasMore(false);
            setError(null);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setHasMore(false);
            setError(null);
            return;
        }
        const reqId = ++requestIdRef.current;
        setLoading(true);
        setError(null);
        const t = window.setTimeout(async () => {
            try {
                const res = await axios.get(endpoint, { params: { q } });
                if (reqId !== requestIdRef.current) return;
                setResults(res.data.results || []);
                setHasMore(!!res.data.hasMore);
            } catch (e) {
                if (reqId !== requestIdRef.current) return;
                setError('Не удалось загрузить результаты');
                setResults([]);
                setHasMore(false);
            } finally {
                if (reqId === requestIdRef.current) setLoading(false);
            }
        }, 300);
        return () => window.clearTimeout(t);
    }, [query, endpoint, open]);

    const loadMore = async () => {
        if (loadingMore || !hasMore || !results.length) return;
        setLoadingMore(true);
        try {
            const before = results[results.length - 1].createdAt;
            const res = await axios.get(endpoint, { params: { q: query.trim(), before } });
            setResults(prev => [...prev, ...(res.data.results || [])]);
            setHasMore(!!res.data.hasMore);
        } catch (e) {
            setError('Не удалось загрузить ещё');
        } finally {
            setLoadingMore(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <motion.aside
                    key="search-panel"
                    className="msg-search-panel"
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                >
                    <div className="msg-search-header">
                        <div className="msg-search-input-wrap">
                            <SearchIcon size={16} color="var(--text-dim)" />
                            <input
                                ref={inputRef}
                                className="msg-search-input"
                                placeholder="Поиск по сообщениям…"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
                            />
                            {query && (
                                <button className="msg-search-clear" onClick={() => setQuery('')} title="Очистить">
                                    <CloseIcon size={14} />
                                </button>
                            )}
                        </div>
                        <button className="msg-search-close" onClick={onClose} title="Закрыть">
                            <CloseIcon size={18} />
                        </button>
                    </div>

                    <div className="msg-search-meta">
                        {loading
                            ? 'Поиск…'
                            : error
                                ? error
                                : query.trim().length < 2
                                    ? 'Введите минимум 2 символа'
                                    : `Найдено: ${results.length}${hasMore ? '+' : ''}`}
                    </div>

                    <div className="msg-search-results">
                        {results.map(r => (
                            <button
                                key={r._id}
                                className="msg-search-result"
                                onClick={() => onJump(r._id, r.createdAt)}
                            >
                                <div className="msg-search-result-head">
                                    <UserAvatar user={r.author} size={28} />
                                    <span className="msg-search-result-name">{r.author.username}</span>
                                    <span className="msg-search-result-date">{formatDateShort(r.createdAt)}</span>
                                </div>
                                <div className="msg-search-result-body">
                                    {highlight(r.content, query.trim())}
                                </div>
                            </button>
                        ))}
                        {hasMore && !loading && (
                            <button className="msg-search-more" onClick={loadMore} disabled={loadingMore}>
                                {loadingMore ? 'Загрузка…' : 'Показать ещё'}
                            </button>
                        )}
                        {!loading && query.trim().length >= 2 && results.length === 0 && !error && (
                            <div className="msg-search-empty">Ничего не найдено</div>
                        )}
                    </div>
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

export default MessageSearchPanel;

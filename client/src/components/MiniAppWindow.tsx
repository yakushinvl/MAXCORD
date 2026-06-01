import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { MiniApp } from '../types';
import { CloseIcon, MaximizeIcon, LayoutGridIcon, MonitorIcon } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import { useSocket } from '../contexts/SocketContext';
import './MiniAppWindow.css';

interface MiniAppWindowProps {
    app: MiniApp;
    onClose: (appId: string) => void;
    onMinimize?: (appId: string) => void;
    /** When true, window is hidden visually but iframe stays mounted so audio /
     *  WebRTC publications keep running in the background. */
    minimized?: boolean;
}

/** Try to obtain a MediaStreamTrack from a mini-app message. The SDK supports
 *  two paths: transferable (track is on msg.track) and same-origin stash
 *  (track is in iframe.contentWindow.__maxcordTrackStash, keyed by stashId). */
function pickTrackFromMessage(msg: any, iframe?: HTMLIFrameElement | null): MediaStreamTrack | null {
    // Path 1: transferable (Chrome 116+, cross-origin friendly)
    // We check both instanceof and a "quack" check because across different
    // contexts (even same-origin in some Electron configs), instanceof can fail.
    const isTrack = (t: any) => t && (t instanceof MediaStreamTrack || (typeof t === 'object' && t.constructor?.name === 'MediaStreamTrack' && typeof t.stop === 'function'));

    if (isTrack(msg.track)) {
        console.log('[MiniApp bridge] got track via transferable');
        return msg.track;
    }

    // Path 1.5: transferable MediaStream (sometimes works when track doesn't)
    if (msg.stream) {
        try {
            const stream = msg.stream as MediaStream;
            const t = stream.getAudioTracks()[0] || stream.getVideoTracks()[0];
            if (isTrack(t)) {
                console.log('[MiniApp bridge] got track via transferable stream');
                return t;
            }
        } catch (e) {
            console.warn('[MiniApp bridge] failed to extract track from msg.stream:', e);
        }
    }

    // Path 2: same-origin stash
    const stashId = msg.payload?.__trackStashId;
    console.log('[MiniApp bridge] stashId from msg:', stashId, 'msg keys:', Object.keys(msg), 'payload keys:', msg.payload && Object.keys(msg.payload));
    if (!stashId) {
        if (msg.track || msg.stream) console.warn('[MiniApp bridge] msg.track/stream present but failed isTrack check');
        else console.warn('[MiniApp bridge] no stashId and no transferable track in message');
        return null;
    }
    try {
        const win = iframe?.contentWindow as any;
        const stash = win?.__maxcordTrackStash as Map<string, MediaStreamTrack> | undefined;
        console.log('[MiniApp bridge] iframe window:', !!win, 'stash:', stash, 'stash.size:', stash?.size);
        if (!stash) return null;
        const t = stash.get(stashId);
        console.log('[MiniApp bridge] stash.get(', stashId, ') =', t, 'kind:', t?.kind, 'readyState:', t?.readyState);
        return t || null;
    } catch (e) {
        console.warn('[MiniApp bridge] Track stash unreachable (cross-origin?):', e);
        return null;
    }
}

const MiniAppWindow: React.FC<MiniAppWindowProps> = ({ app, onClose, onMinimize, minimized = false }) => {
    const [position, setPosition] = useState({ x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 });
    const [size, setSize] = useState({ width: 800, height: 600 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const { user } = useAuth();
    const {
        activeChannelId,
        publishExternalAudioTrack, publishExternalVideoTrack, unpublishExternalAudioTrack,
        replaceExternalTrack,
    } = useVoice();
    const { socket } = useSocket();

    const getAbsoluteUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (url.startsWith('/')) return url;
        return `https://${url}`;
    };
    const absoluteUrl = getAbsoluteUrl(app.url);

    // Track of publication sids we created for this app, to clean up on unmount.
    const publishedSidsRef = useRef<Set<string>>(new Set());
    // sessionId -> { channelId, audioSid, videoSid, audioTrack, videoTrack }
    const presencesRef = useRef<Map<string, {
        channelId: string;
        audioSid?: string;
        videoSid?: string;
        audioTrack?: MediaStreamTrack;
        videoTrack?: MediaStreamTrack;
    }>>(new Map());

    /** Resolve the LiveKit-style channel id for the user's current voice context. */
    const currentVoiceChannelId = useCallback((): string | null => {
        // VoiceContext.activeChannelId is the server-voice channel id (raw). For DM
        // the active voice room is encoded as call-<dmId> on the LiveKit side, but
        // VoiceContext doesn't track DM call membership. We expose only server
        // voice for now; DM presence can be added later by surfacing dmCallId.
        if (activeChannelId) return 'channel-' + activeChannelId;
        return null;
    }, [activeChannelId]);

    // postMessage bridge
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Channel for high-performance / transferable data
        const channel = new MessageChannel();
        const { port1, port2 } = channel;

        const isFromOurFrame = (source: MessageEventSource | null) =>
            source === iframe.contentWindow;

        const respond = (id: string, payload: any, transfer: Transferable[] = []) => {
            try { iframe.contentWindow?.postMessage({ __maxcord: true, id, ...payload }, '*', transfer); } catch {}
        };

        const handleMsg = async (msg: any, sourcePort?: MessagePort) => {
            if (!msg || typeof msg !== 'object' || !msg.__maxcord || !msg.type || msg.id == null) return;

            const { id, type, payload } = msg;
            try {
                switch (type) {
                    case 'init':
                        // Provide port2 to the iframe during init so it can use it for transfers
                        respond(id, { ok: true, result: {
                            user: user ? { _id: String(user._id), username: user.username, avatar: user.avatar } : null,
                            app: { _id: app._id, name: app.name },
                            voiceChannelId: activeChannelId,
                        }, port: port2 }, [port2]);
                        break;

                    case 'getUser':
                        respond(id, { ok: true, result: user ? {
                            _id: String(user._id), username: user.username, avatar: user.avatar
                        } : null });
                        break;

                    case 'getVoiceChannel':
                        respond(id, { ok: true, result: { channelId: activeChannelId } });
                        break;

                    case 'storage.get': {
                        const r = await axios.get(`/api/miniapps/${app._id}/storage/${encodeURIComponent(payload.key)}`);
                        respond(id, { ok: true, result: r.data.value });
                        break;
                    }
                    case 'storage.getAll': {
                        const r = await axios.get(`/api/miniapps/${app._id}/storage`);
                        respond(id, { ok: true, result: r.data });
                        break;
                    }
                    case 'storage.set': {
                        await axios.put(`/api/miniapps/${app._id}/storage/${encodeURIComponent(payload.key)}`, { value: payload.value });
                        respond(id, { ok: true, result: true });
                        break;
                    }
                    case 'storage.delete': {
                        await axios.delete(`/api/miniapps/${app._id}/storage/${encodeURIComponent(payload.key)}`);
                        respond(id, { ok: true, result: true });
                        break;
                    }

                    case 'fetch': {
                        const r = await axios.post(`/api/miniapps/${app._id}/fetch`, payload);
                        respond(id, { ok: true, result: r.data });
                        break;
                    }

                    case 'publishAudioTrack': {
                        const track = pickTrackFromMessage(msg, iframe);
                        if (!track) { respond(id, { ok: false, error: 'no track received' }); break; }
                        const sid = await publishExternalAudioTrack(track, payload?.name || app.name);
                        if (sid) publishedSidsRef.current.add(sid);
                        respond(id, { ok: !!sid, result: sid });
                        break;
                    }

                    case 'unpublishAudioTrack': {
                        const sid = payload?.sid;
                        if (sid && publishedSidsRef.current.has(sid)) {
                            await unpublishExternalAudioTrack(sid);
                            publishedSidsRef.current.delete(sid);
                        }
                        respond(id, { ok: true });
                        break;
                    }

                    case 'sendMessage': {
                        if (!socket) { respond(id, { ok: false, error: 'no socket' }); break; }
                        socket.emit('send-message', payload);
                        respond(id, { ok: true });
                        break;
                    }

                    case 'voicePresence.create': {
                        const { sessionId, displayName, avatar } = payload;
                        const channelId = currentVoiceChannelId();
                        if (!channelId) { respond(id, { ok: false, error: 'Не в голосовом канале' }); break; }
                        if (!socket) { respond(id, { ok: false, error: 'no socket' }); break; }
                        socket.emit('voice-presence-create', { sessionId, channelId, displayName, avatar });
                        presencesRef.current.set(sessionId, { channelId });
                        respond(id, { ok: true, result: channelId });
                        break;
                    }
                    case 'voicePresence.publishAudio': {
                        const { sessionId } = payload;
                        let track = pickTrackFromMessage(msg, iframe);
                        if (!track) {
                            await new Promise(r => setTimeout(r, 50));
                            track = pickTrackFromMessage(msg, iframe);
                        }
                        const slot = presencesRef.current.get(sessionId);
                        if (!track || !slot) { respond(id, { ok: false, error: 'no track received' }); break; }
                        // Same track ref — no-op.
                        if (slot.audioSid && slot.audioTrack === track && track.readyState === 'live') {
                            respond(id, { ok: true, result: slot.audioSid });
                            break;
                        }
                        // Different track but same slot — try replaceTrack first. Keeps
                        // the LiveKit publication intact, so receivers don't lose audio.
                        if (slot.audioSid) {
                            const replaced = await replaceExternalTrack(slot.audioSid, track);
                            if (replaced) {
                                slot.audioTrack = track;
                                respond(id, { ok: true, result: slot.audioSid });
                                break;
                            }
                            // replaceTrack failed — fall back to unpublish+publish
                            await unpublishExternalAudioTrack(slot.audioSid);
                        }
                        const sid = await publishExternalAudioTrack(track, 'maxcord-presence:' + sessionId);
                        if (sid) { slot.audioSid = sid; slot.audioTrack = track; publishedSidsRef.current.add(sid); }
                        respond(id, { ok: !!sid, result: sid });
                        break;
                    }
                    case 'voicePresence.publishVideo': {
                        const { sessionId } = payload;
                        const track = pickTrackFromMessage(msg, iframe);
                        const slot = presencesRef.current.get(sessionId);
                        if (!track || !slot) { respond(id, { ok: false, error: 'no track received' }); break; }
                        if (slot.videoSid && slot.videoTrack === track && track.readyState === 'live') {
                            respond(id, { ok: true, result: slot.videoSid });
                            break;
                        }
                        if (slot.videoSid) await unpublishExternalAudioTrack(slot.videoSid);
                        const sid = await publishExternalVideoTrack(track, 'maxcord-presence:' + sessionId);
                        if (sid) { slot.videoSid = sid; slot.videoTrack = track; publishedSidsRef.current.add(sid); }
                        respond(id, { ok: !!sid, result: sid });
                        break;
                    }
                    case 'voicePresence.unpublishAudio': {
                        const slot = presencesRef.current.get(payload.sessionId);
                        if (slot?.audioSid) {
                            await unpublishExternalAudioTrack(slot.audioSid);
                            publishedSidsRef.current.delete(slot.audioSid);
                            slot.audioSid = undefined;
                        }
                        respond(id, { ok: true });
                        break;
                    }
                    case 'voicePresence.unpublishVideo': {
                        const slot = presencesRef.current.get(payload.sessionId);
                        if (slot?.videoSid) {
                            await unpublishExternalAudioTrack(slot.videoSid);
                            publishedSidsRef.current.delete(slot.videoSid);
                            slot.videoSid = undefined;
                        }
                        respond(id, { ok: true });
                        break;
                    }
                    case 'voicePresence.setBackground': {
                        const slot = presencesRef.current.get(payload.sessionId);
                        if (!slot || !socket) { respond(id, { ok: false, error: 'invalid' }); break; }
                        socket.emit('voice-presence-update', { sessionId: payload.sessionId, channelId: slot.channelId, patch: { background: payload.background } });
                        respond(id, { ok: true });
                        break;
                    }
                    case 'voicePresence.update': {
                        const slot = presencesRef.current.get(payload.sessionId);
                        if (!slot || !socket) { respond(id, { ok: false, error: 'invalid' }); break; }
                        socket.emit('voice-presence-update', { sessionId: payload.sessionId, channelId: slot.channelId, patch: payload.patch || {} });
                        respond(id, { ok: true });
                        break;
                    }
                    case 'voicePresence.setControls': {
                        const slot = presencesRef.current.get(payload.sessionId);
                        if (!slot || !socket) { respond(id, { ok: false, error: 'invalid' }); break; }
                        socket.emit('voice-presence-update', { sessionId: payload.sessionId, channelId: slot.channelId, patch: { controls: payload.controls } });
                        respond(id, { ok: true });
                        break;
                    }
                    case 'voicePresence.updateControl': {
                        const slot = presencesRef.current.get(payload.sessionId);
                        if (!slot || !socket) { respond(id, { ok: false, error: 'invalid' }); break; }
                        socket.emit('voice-presence-update', { sessionId: payload.sessionId, channelId: slot.channelId, patch: { controlPatch: { id: payload.controlId, partial: payload.partial } } });
                        respond(id, { ok: true });
                        break;
                    }
                    case 'voicePresence.destroy': {
                        const slot = presencesRef.current.get(payload.sessionId);
                        if (slot) {
                            if (slot.audioSid) { await unpublishExternalAudioTrack(slot.audioSid); publishedSidsRef.current.delete(slot.audioSid); }
                            if (slot.videoSid) { await unpublishExternalAudioTrack(slot.videoSid); publishedSidsRef.current.delete(slot.videoSid); }
                            if (socket) socket.emit('voice-presence-destroy', { sessionId: payload.sessionId, channelId: slot.channelId });
                            presencesRef.current.delete(payload.sessionId);
                        }
                        respond(id, { ok: true });
                        break;
                    }

                    case 'oauthPopup': {
                        // Open OAuth in a popup. Resolves when popup navigates to a URL
                        // that matches the supplied redirect_uri (substring match). The
                        // OAuth flow passes through several intermediate URLs (login pages,
                        // consent screens), all of which we must IGNORE — only the final
                        // redirect back to the app is meaningful.
                        const win = window.open(payload.url, 'maxcord-oauth', `width=${payload.width||600},height=${payload.height||720}`);
                        if (!win) { respond(id, { ok: false, error: 'popup blocked' }); break; }
                        const expected = payload.redirectUri ? String(payload.redirectUri) : null;
                        const start = Date.now();
                        const poll = setInterval(() => {
                            try {
                                if (win.closed) { clearInterval(poll); respond(id, { ok: false, error: 'closed' }); return; }
                                const href = win.location.href;
                                if (!href || href === 'about:blank') return;
                                // Strict gate: must look like our redirect (or at least same-origin to host)
                                const isOurRedirect = expected
                                    ? href.startsWith(expected.split('#')[0].split('?')[0])
                                    : href.startsWith(window.location.origin);
                                if (!isOurRedirect) return;
                                const url = new URL(href);
                                clearInterval(poll);
                                try { win.close(); } catch {}
                                respond(id, { ok: true, result: { href, hash: url.hash, search: url.search } });
                            } catch {
                                // Cross-origin — keep polling silently
                            }
                            if (Date.now() - start > 300000) { clearInterval(poll); try { win.close(); } catch {}; respond(id, { ok: false, error: 'timeout' }); }
                        }, 400);
                        break;
                    }

                    default:
                        respond(id, { ok: false, error: 'unknown type: ' + type });
                }
            } catch (err: any) {
                respond(id, { ok: false, error: err?.response?.data?.message || err?.message || 'error' });
            }
        };

        const windowHandler = (e: MessageEvent) => {
            if (isFromOurFrame(e.source)) handleMsg(e.data);
        };

        port1.onmessage = (e) => {
            handleMsg(e.data, port1);
        };

        window.addEventListener('message', windowHandler);
        return () => {
            window.removeEventListener('message', windowHandler);
            port1.close();
        };
    }, [user, app._id, app.name, activeChannelId, publishExternalAudioTrack, unpublishExternalAudioTrack, socket]);

    // Broadcast voice channel changes to the iframe
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        try {
            iframe.contentWindow?.postMessage({ __maxcord: true, event: 'voiceChannelChanged', payload: { channelId: activeChannelId } }, '*');
        } catch {}
    }, [activeChannelId]);

    // Forward voice-presence-control events from the host socket to the iframe,
    // but only when the targeted session is owned by THIS iframe.
    useEffect(() => {
        if (!socket) return;
        const onControl = (data: { sessionId: string; channelId: string; controlId: string; value?: any; fromUserId: string }) => {
            if (!presencesRef.current.has(data.sessionId)) return;
            const iframe = iframeRef.current;
            try { iframe?.contentWindow?.postMessage({ __maxcord: true, event: 'voicePresenceControl', payload: data }, '*'); } catch {}
        };
        socket.on('voice-presence-control', onControl);
        return () => { socket.off('voice-presence-control', onControl); };
    }, [socket]);

    // Cleanup any published tracks and presences on unmount
    useEffect(() => {
        return () => {
            for (const sid of publishedSidsRef.current) {
                unpublishExternalAudioTrack(sid).catch(() => {});
            }
            publishedSidsRef.current.clear();
            for (const [sessionId, slot] of presencesRef.current.entries()) {
                if (socket) socket.emit('voice-presence-destroy', { sessionId, channelId: slot.channelId });
            }
            presencesRef.current.clear();
        };
    }, [unpublishExternalAudioTrack, socket]);

    useEffect(() => {
        const timer = setTimeout(() => { if (isLoading) setIsBlocked(true); }, 7000);
        return () => clearTimeout(timer);
    }, [isLoading]);

    // Auto-minimize on click outside the window (anywhere else inside MAXCORD).
    // Clicks INSIDE the iframe are isolated to that document and don't bubble
    // here, so they don't trigger this.
    const windowRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (minimized || !onMinimize) return;
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (target && windowRef.current && !windowRef.current.contains(target)) {
                onMinimize(app._id);
            }
        };
        // Defer attachment to the next tick so the click that OPENED this window
        // (from showcase/sidebar) doesn't immediately minimize it.
        const handle = setTimeout(() => {
            document.addEventListener('mousedown', onDocMouseDown);
        }, 0);
        return () => {
            clearTimeout(handle);
            document.removeEventListener('mousedown', onDocMouseDown);
        };
    }, [minimized, onMinimize, app._id]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };
    const handleResizeDown = (e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        setIsResizing(direction);
        resizeStartRef.current = { x: e.clientX, y: e.clientY, w: size.width, h: size.height };
    };
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
        } else if (isResizing) {
            const dx = e.clientX - resizeStartRef.current.x;
            const dy = e.clientY - resizeStartRef.current.y;
            let newW = resizeStartRef.current.w;
            let newH = resizeStartRef.current.h;
            if (isResizing.includes('right')) newW = Math.max(400, resizeStartRef.current.w + dx);
            if (isResizing.includes('bottom')) newH = Math.max(300, resizeStartRef.current.h + dy);
            setSize({ width: newW, height: newH });
        }
    }, [isDragging, isResizing]);
    const handleMouseUp = useCallback(() => { setIsDragging(false); setIsResizing(null); }, []);

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

    return (
        <motion.div
            ref={windowRef}
            className="miniapp-window"
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
                zIndex: isDragging || isResizing ? 9001 : 9000,
                transformOrigin: '0 0',
                pointerEvents: minimized ? 'none' : 'auto',
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={
                minimized
                    ? {
                          opacity: 0,
                          scale: 0.05,
                          // Morph towards the left sidebar (≈40px from left, ≈260px from top
                          // under the showcase icon — close enough without measuring DOM).
                          x: -position.x + 40,
                          y: -position.y + 260,
                      }
                    : { opacity: 1, scale: 1, x: 0, y: 0 }
            }
            transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
        >
            <div className="miniapp-header" onMouseDown={handleMouseDown}>
                <div className="header-info">
                    <LayoutGridIcon size={16} color="var(--primary-neon)" />
                    <span>{app.name}</span>
                </div>
                <div className="header-actions">
                    <a href={absoluteUrl} target="_blank" rel="noopener noreferrer" className="header-btn" title="Открыть в новой вкладке" onMouseDown={e => e.stopPropagation()}>
                        <MaximizeIcon size={16} />
                    </a>
                    {onMinimize && (
                        <button
                            className="header-btn"
                            onClick={() => onMinimize(app._id)}
                            onMouseDown={e => e.stopPropagation()}
                            title="Свернуть"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="5" y1="19" x2="19" y2="19" />
                            </svg>
                        </button>
                    )}
                    <button className="header-btn" onClick={() => onClose(app._id)} onMouseDown={e => e.stopPropagation()}>
                        <CloseIcon size={18} />
                    </button>
                </div>
            </div>
            <div className="miniapp-content" style={{ position: 'relative' }}>
                {isBlocked && (
                    <div className="miniapp-blocked-overlay">
                        <div className="blocked-content">
                            <MonitorIcon size={64} color="var(--text-dim)" />
                            <h3>Сайт не загружается?</h3>
                            <p>Многие современные сайты (Google, GitHub и др.) запрещают встраивание во фреймы в целях безопасности.</p>
                            <a href={absoluteUrl} target="_blank" rel="noopener noreferrer" className="neon-btn" style={{ padding: '12px 24px', fontSize: '13px' }}>
                                Открыть в новой вкладке
                            </a>
                        </div>
                    </div>
                )}
                {isLoading && !isBlocked && (
                    <div className="miniapp-loading">
                        <div className="liquid-loader">
                            <div></div><div></div><div></div>
                        </div>
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    src={absoluteUrl}
                    title={app.name}
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    onLoad={() => { setIsLoading(false); setIsBlocked(false); }}
                    allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb; autoplay"
                    style={{ pointerEvents: isDragging || isResizing ? 'none' : 'auto', background: 'white', display: isBlocked ? 'none' : 'block' }}
                />
            </div>
            <div className="resize-handle right" onMouseDown={(e) => handleResizeDown(e, 'right')} />
            <div className="resize-handle bottom" onMouseDown={(e) => handleResizeDown(e, 'bottom')} />
            <div className="resize-handle bottom-right" onMouseDown={(e) => handleResizeDown(e, 'bottom-right')} />
        </motion.div>
    );
};

export default MiniAppWindow;

import React, { useEffect, useRef, useState } from 'react';
import { VoicePresenceInfo } from '../contexts/VoiceContext';
import './PresenceTile.css';

interface Props {
    presence: VoicePresenceInfo;
    videoStream?: MediaStream;
    volume: number;
    onVolumeChange: (volume: number) => void;
    onControl: (controlId: string, value?: any) => void;
}

/**
 * Music-player-styled tile for a mini-app "voice presence".
 * Layout:
 *   - Large cover/video fills the card (16:9)
 *   - Gradient overlay from bottom for legibility
 *   - Bottom-left:  app pill (icon + displayName) above subtitle
 *   - Bottom-right: compact controls always visible
 *   - Top-right hover: volume slider
 *   - Animated equalizer bars next to app pill (visual "now playing" hint)
 */
const PresenceTile: React.FC<Props> = ({ presence, videoStream, volume, onVolumeChange, onControl }) => {
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const bgVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!videoStream || !remoteVideoRef.current) return;
        if (remoteVideoRef.current.srcObject !== videoStream) remoteVideoRef.current.srcObject = videoStream;
        remoteVideoRef.current.play().catch(() => {});
    }, [videoStream]);

    const bg = presence.background;
    const videoUrl = !videoStream && bg?.type === 'video' && bg.url ? bg.url : null;
    const cover = !videoStream && !videoUrl && bg?.type === 'image' && bg.url ? bg.url : null;
    const solidBg = !videoStream && !videoUrl && bg?.type === 'color' && bg.color ? bg.color : null;
    const accent = presence.accentColor || 'var(--accent-pink, #ff00c8)';

    useEffect(() => {
        const el = bgVideoRef.current;
        if (!el || !videoUrl) return;
        if (el.src !== videoUrl) el.src = videoUrl;
        el.muted = true;
        el.loop = true;
        el.playsInline = true;
        el.play().catch(() => {});
    }, [videoUrl]);

    const tileStyle: React.CSSProperties = {
        ['--presence-accent' as any]: accent,
        ...(cover ? { backgroundImage: `url('${cover}')` } : {}),
        ...(solidBg ? { background: solidBg } : {}),
    };

    return (
        <div className="p-card presence-card" style={tileStyle} onClick={(e) => e.stopPropagation()}>
            {/* Backdrop: blurred cover (for static images, gives lush colour spill) */}
            {cover && <div className="presence-cover-bg" style={{ backgroundImage: `url('${cover}')` }} />}

            {/* Live video (from publishVideo) — fills the tile */}
            {videoStream && <video ref={remoteVideoRef} className="presence-media" autoPlay playsInline muted />}

            {/* URL-based looping video background */}
            {videoUrl && <video ref={bgVideoRef} className="presence-media presence-bg-video" autoPlay loop muted playsInline />}

            {/* Hero cover artwork (foreground square) — for static-image presences only */}
            {cover && !videoStream && !videoUrl && (
                <div className="presence-cover-hero" style={{ backgroundImage: `url('${cover}')` }} />
            )}

            {/* Dark vignette for text legibility */}
            <div className="presence-vignette" />

            {/* Top row: brand chip + volume on hover */}
            <div className="presence-top-row">
                <div className="presence-brand">
                    {presence.avatar && <img src={presence.avatar} alt="" />}
                    <span>{presence.displayName}</span>
                </div>

                <div className="presence-volume" title={`Громкость: ${Math.round(volume * 100)}%`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        {volume === 0 ? (
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3L19 14.41 17.59 13 16 14.59 14.41 13 13 14.41 14.59 16 13 17.59 14.41 19 16 17.41 17.59 19 19 17.59z" />
                        ) : volume < 0.5 ? (
                            <path d="M7 9v6h4l5 5V4l-5 5H7z" />
                        ) : (
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" />
                        )}
                    </svg>
                    <input
                        type="range"
                        min={0}
                        max={200}
                        value={Math.round(volume * 100)}
                        onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>

            {/* Now-playing info */}
            <div className="presence-info">
                {presence.subtitle && (
                    <div className="presence-subtitle">
                        <EqBars />
                        <span>{presence.subtitle}</span>
                    </div>
                )}
            </div>

            {/* Bottom controls bar — always visible */}
            {presence.controls && presence.controls.length > 0 && (
                <div className="presence-controls">
                    {presence.controls.map(ctrl => (
                        <PresenceControl key={ctrl.id} ctrl={ctrl} onControl={onControl} />
                    ))}
                </div>
            )}
        </div>
    );
};

/** Three animated bars — visual cue for "audio is playing here". */
const EqBars: React.FC = () => (
    <div className="presence-eq" aria-hidden>
        <span /><span /><span />
    </div>
);

const PresenceControl: React.FC<{
    ctrl: VoicePresenceInfo['controls'][number];
    onControl: Props['onControl'];
}> = ({ ctrl, onControl }) => {
    const [local, setLocal] = useState<number | null>(null);
    if (ctrl.kind === 'slider') {
        const value = local ?? ctrl.value ?? 0;
        const min = ctrl.min ?? 0;
        const max = ctrl.max ?? 100;
        const pct = ((value - min) / (max - min)) * 100;
        return (
            <div className="presence-seek" title={ctrl.tooltip || ctrl.label}>
                <div className="presence-seek-track">
                    <div className="presence-seek-fill" style={{ width: `${pct}%` }} />
                </div>
                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => setLocal(Number(e.target.value))}
                    onMouseUp={(e) => { onControl(ctrl.id, Number((e.target as HTMLInputElement).value)); setLocal(null); }}
                    onTouchEnd={(e) => { onControl(ctrl.id, Number((e.target as HTMLInputElement).value)); setLocal(null); }}
                />
            </div>
        );
    }
    const styleClass = ctrl.style ? ` presence-btn-${ctrl.style}` : '';
    return (
        <button
            className={`presence-btn${styleClass}`}
            title={ctrl.tooltip || ctrl.label}
            onClick={(e) => { e.stopPropagation(); onControl(ctrl.id); }}
        >
            {ctrl.label || ctrl.id}
        </button>
    );
};

export default PresenceTile;

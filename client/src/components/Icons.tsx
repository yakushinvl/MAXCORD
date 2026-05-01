import React from 'react';

export const LayoutGridIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
    </svg>
);

export const HashtagIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" />
        <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
);

export const SpeakerIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
);

export const SpeakerMutedIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
);

export const PhoneIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

export const MicIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

export const MicMutedIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

export const DocumentIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
    </svg>
);

export const PlusIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export const DeafenedIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="var(--icon-stroke)" className={className}>
        <path d="M3 11c0-4.97 4.03-9 9-9s9 4.03 9 9" />
        <path d="M19 11v6a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h3Z" />
        <path d="M5 11v6a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5Z" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

export const UsersIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

export const SettingsIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export const ChatIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

export const CloseIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export const CheckIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export const VideoIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
    </svg>
);

export const CameraIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m22 8-6 4 6 4V8Z" />
        <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);
export const ShieldIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

export const TrashIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
);

export const ScreenShareIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
        <path d="M12 17v4" />
        <path d="M8 21h8" />
        <path d="m14 10 5 5-5 5" />
        <path d="M19 15H9" />
    </svg>
);

export const StopScreenShareIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />
        <path d="M12 17v4" />
        <path d="M8 21h8" />
        <path d="m14 8 4 4-4 4" />
        <path d="m18 8-4 4 4 4" />
    </svg>
);

export const MaximizeIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
);

export const MinimizeIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </svg>
);

export const MonitorIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
    </svg>
);

export const PaletteIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="13.5" cy="6.5" r=".5" />
        <circle cx="17.5" cy="10.5" r=".5" />
        <circle cx="8.5" cy="7.5" r=".5" />
        <circle cx="6.5" cy="12.5" r=".5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.6 1.5-1.5 0-.4-.1-.8-.4-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.5 1.5-1.5H19c2.8 0 5-2.2 5-5 0-4.4-4.5-8-12-8z" />
    </svg>
);

export const KeyboardIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
        <line x1="6" y1="8" x2="6" y2="8" />
        <line x1="10" y1="8" x2="10" y2="8" />
        <line x1="14" y1="8" x2="14" y2="8" />
        <line x1="18" y1="8" x2="18" y2="8" />
        <line x1="6" y1="12" x2="6" y2="12" />
        <line x1="10" y1="12" x2="10" y2="12" />
        <line x1="14" y1="12" x2="14" y2="12" />
        <line x1="18" y1="12" x2="18" y2="12" />
        <line x1="7" y1="16" x2="17" y2="16" />
    </svg>
);

export const SmartphoneIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
);

export const LogOutIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

export const EllipsisIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
    </svg>
);
export const SearchIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

export const PlayIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
);

export const PauseIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
    </svg>
);

export const YouTubeIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
        <polygon fill={color} points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </svg>
);

export const VolumeHighIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
);

export const VolumeLowIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
);

export const FullscreenIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
);

export const ChevronLeftIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

export const ChevronRightIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

export const ChevronUpIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="18 15 12 9 6 15" />
    </svg>
);

export const ChevronDownIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 24, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

export const ExpandIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
);

export const MusicIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
    </svg>
);

export const DownloadIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

export const MailIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

export const BellIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

export const PinIcon: React.FC<{ size?: number; color?: string; fill?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', fill = 'none', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M5 17h14v-2l-1-1V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v9l-1 1v2z" />
    </svg>
);

export const ArrowDownIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
    </svg>
);

export const SmileIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
);
export const BotIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
);

export const ReplyIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="9 17 4 12 9 7" />
        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
);

export const CopyIcon: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'var(--icon-color)', className = "" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

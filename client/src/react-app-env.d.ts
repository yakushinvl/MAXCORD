/// <reference types="vite/client" />

interface Window {
    electron: {
        isElectron: boolean;
        ipc: {
            invoke: (channel: string, ...args: any[]) => Promise<any>;
            on: (channel: string, func: (...args: any[]) => void) => () => void;
            send: (channel: string, ...args: any[]) => void;
            removeAllListeners: (channel: string) => void;
        };
        clipboard: {
            writeText: (text: string) => void;
        };
        getCurrentActivity: () => Promise<any>;
        onActivityChanged: (callback: (activity: any) => void) => () => void;
        windowControls: {
            minimize: () => void;
            maximize: () => void;
            close: () => void;
        };
        getDesktopSources: (options: { types: string[]; thumbnailSize?: { width: number; height: number } }) => Promise<any[]>;
        setContentProtection: (enabled: boolean) => Promise<void>;
    };
}

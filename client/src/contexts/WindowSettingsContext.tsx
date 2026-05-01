import React, { createContext, useContext, useState, useEffect } from 'react';

interface WindowSettings {
    autoStart: boolean;
    minimizeToTray: boolean;
    closeToTray: boolean;
    startMinimized: boolean;
    hardwareAcceleration: boolean;
    appVersion: string;
}

interface WindowSettingsContextType extends WindowSettings {
    setAutoStart: (value: boolean) => void;
    setMinimizeToTray: (value: boolean) => void;
    setCloseToTray: (value: boolean) => void;
    setStartMinimized: (value: boolean) => void;
    setHardwareAcceleration: (value: boolean) => void;
}

const WindowSettingsContext = createContext<WindowSettingsContextType | undefined>(undefined);

export const WindowSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [appVersion, setAppVersion] = useState('1.2.61');
    const [settings, setSettings] = useState<WindowSettings>(() => {
        const saved = localStorage.getItem('window-settings');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            autoStart: false,
            minimizeToTray: true,
            closeToTray: true,
            startMinimized: false,
            hardwareAcceleration: true,
        };
    });

    useEffect(() => {
        // Initial setup on mount
        // @ts-ignore
        const electron = window.electron;
        if (electron && electron.ipc) {
            // Get version once
            electron.ipc.invoke('get-app-version').then((v: string) => {
                if (v && v !== '1.0.0') setAppVersion(v);
            });

            // Sync current settings once
            electron.ipc.invoke('toggle-autostart', settings.autoStart).catch(() => { });
            electron.ipc.send('update-window-settings', {
                minimizeToTray: settings.minimizeToTray,
                closeToTray: settings.closeToTray,
                startMinimized: settings.startMinimized
            });
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('window-settings', JSON.stringify(settings));

        // Sync with Electron on change
        // @ts-ignore
        const electron = window.electron;
        if (electron && electron.ipc) {
            electron.ipc.invoke('toggle-autostart', settings.autoStart).catch(() => { });
            electron.ipc.send('update-window-settings', {
                minimizeToTray: settings.minimizeToTray,
                closeToTray: settings.closeToTray,
                startMinimized: settings.startMinimized
            });
        }
    }, [settings]);

    const setAutoStart = (autoStart: boolean) => setSettings(prev => ({ ...prev, autoStart }));
    const setMinimizeToTray = (minimizeToTray: boolean) => setSettings(prev => ({ ...prev, minimizeToTray }));
    const setCloseToTray = (closeToTray: boolean) => setSettings(prev => ({ ...prev, closeToTray }));
    const setStartMinimized = (startMinimized: boolean) => setSettings(prev => ({ ...prev, startMinimized }));
    const setHardwareAcceleration = (hardwareAcceleration: boolean) => {
        setSettings(prev => ({ ...prev, hardwareAcceleration }));
        // HW Accel usually requires restart or app.disableHardwareAcceleration()
        // We'll just hint the user to restart
    };

    return (
        <WindowSettingsContext.Provider value={{
            ...settings,
            setAutoStart,
            setMinimizeToTray,
            setCloseToTray,
            setStartMinimized,
            setHardwareAcceleration,
            appVersion
        }}>
            {children}
        </WindowSettingsContext.Provider>
    );
};

export const useWindowSettings = () => {
    const context = useContext(WindowSettingsContext);
    if (context === undefined) {
        throw new Error('useWindowSettings must be used within a WindowSettingsProvider');
    }
    return context;
};

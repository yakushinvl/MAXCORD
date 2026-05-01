import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useVoice } from './VoiceContext';

export interface Keybind {
    id: string;
    action: string;
    accelerator: string;
    isEnabled: boolean;
}

interface KeybindsContextType {
    keybinds: Keybind[];
    addKeybind: (action: string, accelerator: string) => void;
    removeKeybind: (id: string) => void;
    updateKeybind: (id: string, updates: Partial<Keybind>) => void;
    isRecording: boolean;
    startRecording: (id: string) => void;
    stopRecording: () => void;
    recordingId: string | null;
}

const KeybindsContext = createContext<KeybindsContextType | undefined>(undefined);

export const KeybindsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { toggleMute, toggleDeafen, toggleOverlay } = useVoice();
    const [keybinds, setKeybinds] = useState<Keybind[]>(() => {
        const saved = localStorage.getItem('keybinds');
        if (saved) return JSON.parse(saved);
        return [
            { id: '1', action: 'toggle-mute', accelerator: 'CommandOrControl+Shift+M', isEnabled: true },
            { id: '2', action: 'toggle-deafen', accelerator: 'CommandOrControl+Shift+D', isEnabled: true },
            { id: '3', action: 'toggle-overlay', accelerator: 'CommandOrControl+Shift+O', isEnabled: true }
        ];
    });

    const [isRecording, setIsRecording] = useState(false);
    const [recordingId, setRecordingId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('keybinds', JSON.stringify(keybinds));
        
        // Sync with Electron
        // @ts-ignore
        if (window.electron && window.electron.ipc) {
            // @ts-ignore
            window.electron.ipc.send('update-keybinds', keybinds.filter(k => k.isEnabled));
        }
    }, [keybinds]);

    useEffect(() => {
        // Listen for shortcuts from main process
        // @ts-ignore
        if (window.electron && window.electron.ipc) {
            // @ts-ignore
            const unMute = window.electron.ipc.on('toggle-mute-shortcut', () => toggleMute());
            // @ts-ignore
            const unDeafen = window.electron.ipc.on('toggle-deafen-shortcut', () => toggleDeafen());
            // @ts-ignore
            const unOverlay = window.electron.ipc.on('toggle-overlay-shortcut', () => toggleOverlay());

            return () => {
                unMute();
                unDeafen();
                unOverlay();
            };
        }
    }, [toggleMute, toggleDeafen, toggleOverlay]);

    const addKeybind = (action: string, accelerator: string) => {
        const newKeybind: Keybind = {
            id: Math.random().toString(36).substr(2, 9),
            action,
            accelerator,
            isEnabled: true
        };
        setKeybinds(prev => [...prev, newKeybind]);
    };

    const removeKeybind = (id: string) => {
        setKeybinds(prev => prev.filter(k => k.id !== id));
    };

    const updateKeybind = (id: string, updates: Partial<Keybind>) => {
        setKeybinds(prev => prev.map(k => k.id === id ? { ...k, ...updates } : k));
    };

    const startRecording = (id: string) => {
        setIsRecording(true);
        setRecordingId(id);
    };

    const stopRecording = () => {
        setIsRecording(false);
        setRecordingId(null);
    };

    return (
        <KeybindsContext.Provider value={{
            keybinds,
            addKeybind,
            removeKeybind,
            updateKeybind,
            isRecording,
            startRecording,
            stopRecording,
            recordingId
        }}>
            {children}
        </KeybindsContext.Provider>
    );
};

export const useKeybinds = () => {
    const context = useContext(KeybindsContext);
    if (!context) throw new Error('useKeybinds must be used within KeybindsProvider');
    return context;
};

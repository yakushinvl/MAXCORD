import React, { createContext, useContext, useState, useEffect } from 'react';

interface ChatSettings {
    displayEmbeds: boolean;
    previewLinks: boolean;
    autoPlayGifs: boolean;
    showStickers: boolean;
    enableTTS: boolean;
    mentionHighlight: boolean;
    autocompleteEmoji: boolean;
    showHoverActions: boolean;
}

interface ChatSettingsContextType extends ChatSettings {
    setDisplayEmbeds: (value: boolean) => void;
    setPreviewLinks: (value: boolean) => void;
    setAutoPlayGifs: (value: boolean) => void;
    setShowStickers: (value: boolean) => void;
    setEnableTTS: (value: boolean) => void;
    setMentionHighlight: (value: boolean) => void;
    setAutocompleteEmoji: (value: boolean) => void;
    setShowHoverActions: (value: boolean) => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextType | undefined>(undefined);

export const ChatSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<ChatSettings>(() => {
        const saved = localStorage.getItem('chat-settings');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            displayEmbeds: true,
            previewLinks: true,
            autoPlayGifs: true,
            showStickers: true,
            enableTTS: false,
            mentionHighlight: true,
            autocompleteEmoji: true,
            showHoverActions: true,
        };
    });

    useEffect(() => {
        localStorage.setItem('chat-settings', JSON.stringify(settings));
    }, [settings]);

    const setDisplayEmbeds = (displayEmbeds: boolean) => setSettings(prev => ({ ...prev, displayEmbeds }));
    const setPreviewLinks = (previewLinks: boolean) => setSettings(prev => ({ ...prev, previewLinks }));
    const setAutoPlayGifs = (autoPlayGifs: boolean) => setSettings(prev => ({ ...prev, autoPlayGifs }));
    const setShowStickers = (showStickers: boolean) => setSettings(prev => ({ ...prev, showStickers }));
    const setEnableTTS = (enableTTS: boolean) => setSettings(prev => ({ ...prev, enableTTS }));
    const setMentionHighlight = (mentionHighlight: boolean) => setSettings(prev => ({ ...prev, mentionHighlight }));
    const setAutocompleteEmoji = (autocompleteEmoji: boolean) => setSettings(prev => ({ ...prev, autocompleteEmoji }));
    const setShowHoverActions = (showHoverActions: boolean) => setSettings(prev => ({ ...prev, showHoverActions }));

    return (
        <ChatSettingsContext.Provider value={{
            ...settings,
            setDisplayEmbeds,
            setPreviewLinks,
            setAutoPlayGifs,
            setShowStickers,
            setEnableTTS,
            setMentionHighlight,
            setAutocompleteEmoji,
            setShowHoverActions
        }}>
            {children}
        </ChatSettingsContext.Provider>
    );
};

export const useChatSettings = () => {
    const context = useContext(ChatSettingsContext);
    if (context === undefined) {
        throw new Error('useChatSettings must be used within a ChatSettingsProvider');
    }
    return context;
};

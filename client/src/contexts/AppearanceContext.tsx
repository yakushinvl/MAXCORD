import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'dark' | 'amoled';
export type DensityType = 'cozy' | 'compact';
export type AppIconType = 'default' | 'icon1' | 'icon2' | 'icon3' | 'icon4' | 'legacy';

interface CustomColors {
    primary: string;
    secondary: string;
    accent: string;
}

interface AppearanceSettings {
    theme: ThemeType;
    density: DensityType;
    messageSpacing: number; // 0 to 24px
    groupSpacing: number; // 0 to 48px
    fontScale: number; // 0.8 to 1.5
    uiScale: number; // 0.5 to 2.0
    appIcon: AppIconType;
    performanceMode: boolean;
    customColors: CustomColors;
    customBackground: string;
    backgroundDim: number; // 0 to 100
    backgroundBlur: number; // 0 to 20
}

interface AppearanceContextType extends AppearanceSettings {
    setTheme: (theme: ThemeType) => void;
    setDensity: (density: DensityType) => void;
    setMessageSpacing: (spacing: number) => void;
    setGroupSpacing: (spacing: number) => void;
    setFontScale: (scale: number) => void;
    setUiScale: (scale: number) => void;
    setAppIcon: (icon: AppIconType) => void;
    setPerformanceMode: (enabled: boolean) => void;
    setCustomColors: (colors: Partial<CustomColors>) => void;
    setCustomBackground: (url: string) => void;
    setBackgroundDim: (value: number) => void;
    setBackgroundBlur: (value: number) => void;
    resetCustomTheme: () => void;
}

const DEFAULT_CUSTOM_COLORS: CustomColors = {
    primary: '#006aff',
    secondary: '#7000ff',
    accent: '#ff00c8'
};

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export const AppearanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppearanceSettings>(() => {
        const saved = localStorage.getItem('appearance-settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure performanceMode and custom settings exist for backward compatibility
            // Migration: light theme has been removed — fall back to dark.
            const safeTheme: ThemeType = parsed.theme === 'amoled' ? 'amoled' : 'dark';
            return {
                theme: safeTheme,
                density: parsed.density || 'cozy',
                messageSpacing: parsed.messageSpacing ?? 2,
                groupSpacing: parsed.groupSpacing ?? 16,
                fontScale: parsed.fontScale ?? 1.0,
                uiScale: parsed.uiScale ?? 1.0,
                appIcon: parsed.appIcon || 'default',
                performanceMode: parsed.performanceMode ?? false,
                customColors: parsed.customColors || { ...DEFAULT_CUSTOM_COLORS },
                customBackground: parsed.customBackground || '',
                backgroundDim: parsed.backgroundDim ?? 40,
                backgroundBlur: parsed.backgroundBlur ?? 0
            };
        }
        return {
            theme: 'dark',
            density: 'cozy',
            messageSpacing: 2,
            groupSpacing: 16,
            fontScale: 1.0,
            uiScale: 1.0,
            appIcon: 'default',
            performanceMode: false,
            customColors: { ...DEFAULT_CUSTOM_COLORS },
            customBackground: '',
            backgroundDim: 40,
            backgroundBlur: 0,
        };
    });

    useEffect(() => {
        localStorage.setItem('appearance-settings', JSON.stringify(settings));
        applySettings(settings);

        // Apply icon to Electron
        const electron = (window as any).electron;
        if (electron && electron.ipc) {
            electron.ipc.send('change-icon', settings.appIcon);
            electron.ipc.send('set-zoom-factor', settings.uiScale);
        }

        // Apply icon to Browser Favicon
        updateFavicon(settings.appIcon);
    }, [settings]);

    const updateFavicon = (iconType: AppIconType) => {
        const iconMap: Record<AppIconType, string> = {
            'default': 'icon.png',
            'icon1': 'icon1.PNG',
            'icon2': 'icon2.png',
            'icon3': 'icon3.png',
            'icon4': 'icon4.png',
            'legacy': 'logo_256x256.png'
        };

        const fileName = iconMap[iconType] || 'icon.png';
        const fullUrl = `${import.meta.env.BASE_URL}${fileName}`;

        // Find or create the favicon link elements
        const linkTags = document.querySelectorAll("link[rel*='icon']");
        
        if (linkTags.length > 0) {
            linkTags.forEach(tag => {
                (tag as HTMLLinkElement).href = fullUrl;
            });
        } else {
            const newLink = document.createElement('link');
            newLink.rel = 'icon';
            newLink.href = fullUrl;
            document.head.appendChild(newLink);
        }
    };

    const applySettings = (s: AppearanceSettings) => {
        const root = document.documentElement;

        // Expose theme to CSS via data attribute so theme-specific overrides
        // (e.g. panel-hero on light theme) can target it without re-reading vars.
        root.dataset.theme = s.theme;

        // Theme Colors & Design Tokens
        if (s.theme === 'dark') {
            root.style.setProperty('--bg-primary', '#36393f');
            root.style.setProperty('--bg-dark', '#020205');
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.04)');
            root.style.setProperty('--glass-bg-subtle', 'rgba(255, 255, 255, 0.02)');
            root.style.setProperty('--glass-bg-active', 'rgba(255, 255, 255, 0.1)');
            root.style.setProperty('--glass-bg-accent', 'rgba(255, 255, 255, 0.05)');
            root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.08)');
            root.style.setProperty('--text-main', '#ffffff');
            root.style.setProperty('--text-dim', 'rgba(255, 255, 255, 0.45)');
            root.style.setProperty('--header-primary', '#ffffff');
            root.style.setProperty('--border-divider', 'rgba(255, 255, 255, 0.06)');
            root.style.setProperty('--glass-blur-value', s.performanceMode ? '0px' : '50px');
        } else if (s.theme === 'amoled') {
            root.style.setProperty('--bg-primary', '#000000');
            root.style.setProperty('--bg-dark', '#000000');
            root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.04)');
            root.style.setProperty('--glass-bg-subtle', 'rgba(255, 255, 255, 0.02)');
            root.style.setProperty('--glass-bg-active', 'rgba(255, 255, 255, 0.08)');
            root.style.setProperty('--glass-bg-accent', 'rgba(255, 255, 255, 0.04)');
            root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
            root.style.setProperty('--text-main', '#ffffff');
            root.style.setProperty('--text-dim', 'rgba(255, 255, 255, 0.5)');
            root.style.setProperty('--header-primary', '#ffffff');
            root.style.setProperty('--border-divider', 'rgba(255, 255, 255, 0.1)');
            root.style.setProperty('--glass-blur-value', s.performanceMode ? '0px' : '50px');
        }

        // Apply Custom Colors
        root.style.setProperty('--primary-neon', s.customColors.primary);
        root.style.setProperty('--secondary-neon', s.customColors.secondary);
        root.style.setProperty('--accent-pink', s.customColors.accent);

        // Apply Custom Background
        if (s.customBackground && !s.performanceMode) {
            root.style.setProperty('--custom-bg-image', `url(${s.customBackground})`);
            root.style.setProperty('--custom-bg-dim', (s.backgroundDim / 100).toString());
            root.style.setProperty('--custom-bg-blur', `${s.backgroundBlur}px`);
            root.classList.add('has-custom-bg');
        } else {
            root.style.removeProperty('--custom-bg-image');
            root.style.removeProperty('--custom-bg-dim');
            root.style.removeProperty('--custom-bg-blur');
            root.classList.remove('has-custom-bg');
        }

        // Spacing
        root.style.setProperty('--message-spacing', `${s.messageSpacing}px`);
        root.style.setProperty('--group-spacing', `${s.groupSpacing}px`);

        // Scale
        root.style.setProperty('--font-scale', s.fontScale.toString());
        root.style.setProperty('--base-font-size', `${16 * s.fontScale}px`);

        // Apply UI scale via CSS zoom for browser fallback if Electron fails
        if (!(window as any).electron) {
            (root.style as any).zoom = s.uiScale.toString();
        }

        // Density modifiers
        if (s.density === 'compact') {
            root.style.setProperty('--message-padding-v', '2px');
            root.style.setProperty('--message-margin-v', '0px');
            root.style.setProperty('--avatar-size', '32px');
            root.style.setProperty('--avatar-radius', '10px');
        } else {
            root.style.setProperty('--message-padding-v', '10px');
            root.style.setProperty('--message-margin-v', '2px');
            root.style.setProperty('--avatar-size', '42px');
            root.style.setProperty('--avatar-radius', '14px');
        }

        // Performance Mode
        if (s.performanceMode) {
            root.classList.add('performance-mode');
            root.style.setProperty('--glass-blur-value', '0px');
        } else {
            root.classList.remove('performance-mode');
        }
    };

    const setTheme = (theme: ThemeType) => setSettings(prev => ({ ...prev, theme }));
    const setDensity = (density: DensityType) => setSettings(prev => ({ ...prev, density }));
    const setMessageSpacing = (messageSpacing: number) => setSettings(prev => ({ ...prev, messageSpacing }));
    const setGroupSpacing = (groupSpacing: number) => setSettings(prev => ({ ...prev, groupSpacing }));
    const setFontScale = (fontScale: number) => setSettings(prev => ({ ...prev, fontScale }));
    const setUiScale = (uiScale: number) => setSettings(prev => ({ ...prev, uiScale }));
    const setAppIcon = (appIcon: AppIconType) => setSettings(prev => ({ ...prev, appIcon }));
    const setPerformanceMode = (performanceMode: boolean) => setSettings(prev => ({ ...prev, performanceMode }));
    
    const setCustomColors = (colors: Partial<CustomColors>) => setSettings(prev => ({
        ...prev,
        customColors: { ...prev.customColors, ...colors }
    }));

    const setCustomBackground = (customBackground: string) => setSettings(prev => ({ ...prev, customBackground }));
    const setBackgroundDim = (backgroundDim: number) => setSettings(prev => ({ ...prev, backgroundDim }));
    const setBackgroundBlur = (backgroundBlur: number) => setSettings(prev => ({ ...prev, backgroundBlur }));

    const resetCustomTheme = () => setSettings(prev => ({
        ...prev,
        customColors: { ...DEFAULT_CUSTOM_COLORS },
        customBackground: '',
        backgroundDim: 40,
        backgroundBlur: 0
    }));

    return (
        <AppearanceContext.Provider value={{
            ...settings,
            setTheme,
            setDensity,
            setMessageSpacing,
            setGroupSpacing,
            setFontScale,
            setUiScale,
            setAppIcon,
            setPerformanceMode,
            setCustomColors,
            setCustomBackground,
            setBackgroundDim,
            setBackgroundBlur,
            resetCustomTheme
        }}>
            {children}
        </AppearanceContext.Provider>
    );
};

export const useAppearance = () => {
    const context = useContext(AppearanceContext);
    if (context === undefined) {
        throw new Error('useAppearance must be used within an AppearanceProvider');
    }
    return context;
};

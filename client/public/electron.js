const { app, BrowserWindow, ipcMain, clipboard, Tray, Menu, nativeImage, screen, desktopCapturer, globalShortcut, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const axios = require('axios');

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let pendingDeepLink = null;
let mainWindow;
let updaterWindow;
let tray = null;
let overlayWindow = null;
let isQuitting = false;
let currentVoiceState = { isMuted: false, isDeafened: false, isConnected: false };
const isOpenedHidden = process.argv.includes('--hidden') || app.getLoginItemSettings().wasOpenedAsHidden;

let appSettings = {
    minimizeToTray: true,
    closeToTray: true,
    startMinimized: false
};
let isOverlayEnabled = true; // Default enabled

// --- IPC Handlers (Registered early to prevent renderer errors) ---
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-pending-deep-link', () => {
    const link = pendingDeepLink;
    pendingDeepLink = null;
    return link;
});

ipcMain.handle('toggle-autostart', (event, enable) => {
    try {
        app.setLoginItemSettings({
            openAtLogin: enable,
            path: app.getPath('exe'),
            args: ['--hidden']
        });
        return app.getLoginItemSettings().openAtLogin;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('get-autostart-status', () => app.getLoginItemSettings().openAtLogin);

ipcMain.on('update-window-settings', (event, settings) => {
    appSettings = { ...appSettings, ...settings };
});

ipcMain.on('restart-app', () => {
    app.relaunch();
    app.exit();
});

ipcMain.on('update-keybinds', (event, keybinds) => {
    unregisterGlobalShortcuts();
    keybinds.forEach(kb => {
        try {
            globalShortcut.register(kb.accelerator, () => {
                if (mainWindow) {
                    mainWindow.webContents.send(`${kb.action}-shortcut`);
                }
            });
        } catch (e) {
            console.error(`Failed to register shortcut ${kb.accelerator}:`, e);
        }
    });
});
// -------------------------------------------------------------

// Performance Tuning
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-oop-rasterization');
app.commandLine.appendSwitch('enable-accelerated-video-decode');
app.commandLine.appendSwitch('enable-accelerated-video-encode'); // HW encode for VP9/AV1
app.commandLine.appendSwitch('enable-zero-copy'); // Reduces memory copy for video/audio
app.commandLine.appendSwitch('ignore-gpu-blocklist'); // Ensure GPU is used even on older drivers
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096 --stack-size=2048');

// Enable hardware-accelerated VP9/AV1 encoding and high-bitrate WebRTC
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder,WebRtcAllowInputVolumeAdjustment,PlatformEncryptedDolbyVision,WebRtcHideLocalSdps,WebRtcUseEchoCanceller3,D3D11VideoDecoder,D3D11VideoEncoder');
// Force WebRTC to use higher bitrate and disable internal bandwidth limits
app.commandLine.appendSwitch('force-fieldtrials', 'WebRTC-Video-MinimumSendBitrate/Enabled-300000/');

if (!isDev) {
    app.commandLine.appendSwitch('force-device-scale-factor', '1'); // Consistent sizing
}

// Disable the yellow/green border on Windows 10/11 when capturing windows
// Also disable Vulkan which can cause green screen/flickering on some GPUs
app.commandLine.appendSwitch('disable-features', 'WinrtCaptureBorders,Vulkan');
app.commandLine.appendSwitch('disable-site-isolation-trials');

const stateFilePath = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
    try {
        if (fs.existsSync(stateFilePath)) {
            const data = fs.readFileSync(stateFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) { }
    return { width: 1280, height: 800 };
}

function saveWindowState() {
    if (!mainWindow) return;
    try {
        const bounds = mainWindow.getBounds();
        const state = { ...bounds, isMaximized: mainWindow.isMaximized() };
        fs.writeFileSync(stateFilePath, JSON.stringify(state));
    } catch (e) { }
}

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.setFeedURL({ provider: 'github', owner: 'yakushinvl', repo: 'MAXCORD' });

if (process.defaultApp) {
    if (process.argv.length >= 2) app.setAsDefaultProtocolClient('maxcord', process.execPath, [path.resolve(process.argv[1])]);
} else app.setAsDefaultProtocolClient('maxcord');

const startupUrl = process.argv.find(arg => arg.startsWith('maxcord://'));
if (startupUrl) pendingDeepLink = startupUrl;

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            const url = commandLine.find(arg => arg.startsWith('maxcord://'));
            if (url) mainWindow.webContents.send('deep-link', url);
        }
    });

    app.whenReady().then(() => {
        if (!tray) createTray();
        if (isDev) createWindow();
        else createUpdaterWindow();
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.ico');
    const trayIcon = nativeImage.createFromPath(iconPath);
    tray = new Tray(trayIcon);
    updateTrayMenu();
    tray.setToolTip('MAXCORD');
    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                if (mainWindow.isFocused()) mainWindow.hide();
                else { mainWindow.show(); mainWindow.focus(); }
            } else { mainWindow.show(); mainWindow.focus(); }
        }
    });
}

function updateTrayMenu() {
    if (!tray) return;
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Открыть MAXCORD', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
        { type: 'separator' },
        {
            label: currentVoiceState.isMuted ? '✓ Микрофон выключен' : 'Выключить микрофон',
            enabled: currentVoiceState.isConnected,
            click: () => { if (mainWindow) mainWindow.webContents.send('toggle-mute-shortcut'); }
        },
        {
            label: currentVoiceState.isDeafened ? '✓ Звук выключен' : 'Выключить звук',
            enabled: currentVoiceState.isConnected,
            click: () => { if (mainWindow) mainWindow.webContents.send('toggle-deafen-shortcut'); }
        },
        { type: 'separator' },
        { label: 'Выйти', click: () => { isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(contextMenu);
}

function updateTrayStatus(state) {
    if (!tray) return;
    currentVoiceState = state;
    const { isMuted, isDeafened, isConnected } = state;
    let iconName = 'icon.ico';
    let statusText = 'MAXCORD - В сети';

    if (isDeafened) {
        iconName = 'icon_deafened.ico';
        statusText = 'MAXCORD - Звук выключен';
    } else if (isMuted) {
        iconName = 'icon_muted.ico';
        statusText = 'MAXCORD - Микрофон выключен';
    } else if (!isConnected) {
        statusText = 'MAXCORD - Не в голосе';
    }

    const iconPath = path.join(__dirname, iconName);
    if (fs.existsSync(iconPath)) {
        tray.setImage(nativeImage.createFromPath(iconPath));
    }
    tray.setToolTip(statusText);
    updateTrayMenu();
}

function registerGlobalShortcuts() {
    // Default shortcuts until dynamic ones are loaded from frontend
    globalShortcut.register('CommandOrControl+Shift+M', () => {
        if (mainWindow) mainWindow.webContents.send('toggle-mute-shortcut');
    });

    globalShortcut.register('CommandOrControl+Shift+D', () => {
        if (mainWindow) mainWindow.webContents.send('toggle-deafen-shortcut');
    });
}

function unregisterGlobalShortcuts() {
    globalShortcut.unregisterAll();
}

function createUpdaterWindow() {
    updaterWindow = new BrowserWindow({ width: 400, height: 500, frame: false, backgroundColor: '#1e1f22', show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } });
    updaterWindow.loadFile(path.join(__dirname, 'updater.html'));
    updaterWindow.once('ready-to-show', () => {
        if (!isOpenedHidden) updaterWindow.show();
        if (!isDev) {
            autoUpdater.checkForUpdates();
            const safetyTimeout = setTimeout(() => { createWindow(); if (updaterWindow && !updaterWindow.isDestroyed()) updaterWindow.close(); }, 10000);
            autoUpdater.on('update-available', () => clearTimeout(safetyTimeout));
            autoUpdater.on('update-not-available', () => clearTimeout(safetyTimeout));
            autoUpdater.on('error', () => clearTimeout(safetyTimeout));
        } else setTimeout(() => { createWindow(); updaterWindow.close(); }, 2000);
    });
    autoUpdater.on('checking-for-update', () => updaterWindow.webContents.send('updater-message', 'Проверка обновлений...'));
    autoUpdater.on('update-available', (info) => updaterWindow.webContents.send('updater-message', `Найдено обновление ${info.version}. Загрузка...`));
    autoUpdater.on('update-not-available', () => {
        updaterWindow.webContents.send('updater-message', 'У вас последняя версия');
        setTimeout(() => { createWindow(); if (updaterWindow && !updaterWindow.isDestroyed()) updaterWindow.close(); }, 1000);
    });
    autoUpdater.on('error', () => {
        updaterWindow.webContents.send('updater-message', 'Ошибка при поиске обновлений');
        setTimeout(() => { createWindow(); if (updaterWindow && !updaterWindow.isDestroyed()) updaterWindow.close(); }, 2000);
    });
    autoUpdater.on('download-progress', (progressObj) => updaterWindow.webContents.send('updater-progress', progressObj.percent));
    autoUpdater.on('update-downloaded', () => {
        updaterWindow.webContents.send('updater-message', 'Обновление скачано. Установка...');
        setTimeout(() => autoUpdater.quitAndInstall(), 1000);
    });
}

function createWindow() {
    const windowState = loadWindowState();
    const display = screen.getPrimaryDisplay();
    const workArea = display.workArea;
    let { width, height, x, y } = windowState;
    if (!width || width < 800) width = 1280;
    if (!height || height < 600) height = 800;
    if (x === undefined || y === undefined || x < workArea.x || x > workArea.x + workArea.width || y < workArea.y || y > workArea.y + workArea.height) {
        x = workArea.x + (workArea.width - width) / 2;
        y = workArea.y + (workArea.height - height) / 2;
    } else if (!windowState.isMaximized) {
        if (width > workArea.width) width = workArea.width;
        if (height > workArea.height) height = workArea.height;
        if (y + height > workArea.y + workArea.height) y = workArea.y + workArea.height - height;
    }
    mainWindow = new BrowserWindow({
        width, height, x, y, minWidth: 800, minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: false, 
            allowRunningInsecureContent: true, // Allow mixed content
            backgroundThrottling: false,
            spellcheck: false, // Performance: Disable spellcheck
            v8CacheOptions: 'bypass-heat-check-and-allow-code-cache', // Faster JIT
            preload: isDev ? path.join(__dirname, '../public/preload.js') : path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        frame: false,
        backgroundColor: '#1e1f22',
        icon: path.join(__dirname, 'icon.ico'),
        show: false // Performance: Use ready-to-show to prevent white flash
    });
    mainWindow.once('ready-to-show', () => {
        if (!appSettings.startMinimized && !isOpenedHidden) {
            mainWindow.show();
        }
        scanActivities();
    });

    // Mask as a standard Chrome browser to avoid YouTube 152-4 errors
    mainWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36");


    // Handle Permissions (Essential for packaged apps)
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
        if (permission === 'media' || permission === 'display-capture') return true;
        return false;
    });

    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'media' || permission === 'display-capture') {
            callback(true);
        } else {
            callback(false);
        }
    });
    let saveTimeout;
    const debouncedSave = () => { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveWindowState, 500); };
    mainWindow.on('resize', debouncedSave);
    mainWindow.on('move', debouncedSave);
    mainWindow.on('minimize', (event) => {
        if (appSettings.minimizeToTray) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
    mainWindow.on('close', (event) => {
        if (!isQuitting && appSettings.closeToTray) {
            event.preventDefault();
            saveWindowState();
            mainWindow.hide();
            return false;
        }
        saveWindowState();
    });
    if (!tray) createTray();
    registerGlobalShortcuts();

    app.on('will-quit', () => {
        unregisterGlobalShortcuts();
    });
    app.on('open-url', (event, url) => {
        event.preventDefault();
        if (mainWindow) mainWindow.webContents.send('deep-link', url);
        else pendingDeepLink = url;
    });
    mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowed = ['media', 'microphone', 'camera'];
        callback(allowed.includes(permission));
    });
    mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        const allowed = ['media', 'microphone', 'camera'];
        return allowed.includes(permission);
    });

    // YouTube Fix: Intercept and modify headers for YouTube embeds to bypass Error 153/152 in production
    mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
        { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.googlevideo.com/*', '*://*.ytimg.com/*'] },
        (details, callback) => {
            const ytId = details.url.match(/embed\/([^?&]+)/)?.[1] || '';
            const referer = ytId ? `https://www.youtube-nocookie.com/embed/${ytId}` : 'https://www.youtube-nocookie.com/';
            details.requestHeaders['Referer'] = referer;
            details.requestHeaders['Origin'] = 'https://www.youtube-nocookie.com';
            details.requestHeaders['User-Agent'] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
            details.requestHeaders['Sec-Fetch-Dest'] = 'iframe';
            details.requestHeaders['Sec-Fetch-Site'] = 'cross-site';
            callback({ requestHeaders: details.requestHeaders });
        }
    );

    // Final Strike: Robustly strip and replace protection headers
    mainWindow.webContents.session.webRequest.onHeadersReceived(
        { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.googlevideo.com/*'] },
        (details, callback) => {
            const responseHeaders = {};
            
            // Filter out existing security and CORS headers to prevent duplicates
            Object.keys(details.responseHeaders).forEach(key => {
                const lowerKey = key.toLowerCase();
                if (![
                    'x-frame-options', 
                    'content-security-policy', 
                    'frame-options', 
                    'access-control-allow-origin',
                    'access-control-allow-headers',
                    'access-control-allow-methods',
                    'access-control-allow-credentials'
                ].includes(lowerKey)) {
                    responseHeaders[key] = details.responseHeaders[key];
                }
            });
            
            // Dynamic mirroring for CORS with Credentials support
            let requestOrigin = details.requestHeaders?.['Origin'] || details.requestHeaders?.['origin'];
            
            // Fallback for Electron file protocol (null origin)
            if (!requestOrigin || requestOrigin === 'null' || requestOrigin === 'file://') {
                requestOrigin = 'https://www.youtube-nocookie.com';
            }
            
            responseHeaders['Access-Control-Allow-Origin'] = [requestOrigin];
            responseHeaders['Access-Control-Allow-Headers'] = ['*'];
            responseHeaders['Access-Control-Allow-Methods'] = ['*'];
            responseHeaders['Access-Control-Allow-Credentials'] = ['true'];
            
            callback({ responseHeaders });
        }
    );

    mainWindow.webContents.on('context-menu', (event, params) => {
        const template = [];
        if (params.isEditable) {
            template.push({ role: 'undo', label: 'Отменить' });
            template.push({ role: 'redo', label: 'Повторить' });
            template.push({ type: 'separator' });
            template.push({ role: 'cut', label: 'Вырезать' });
        }
        if (params.selectionText.trim().length > 0 || params.isEditable) {
            template.push({ role: 'copy', label: 'Копировать' });
        }
        if (params.isEditable) {
            template.push({ role: 'paste', label: 'Вставить' });
            template.push({ role: 'selectAll', label: 'Выбрать все' });
        }
        if (template.length > 0) {
            const menu = Menu.buildFromTemplate(template);
            menu.popup({ window: mainWindow });
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
        if (pendingDeepLink) mainWindow.webContents.send('deep-link', pendingDeepLink);
    });
    mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('fullscreen-changed', true));
    mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('fullscreen-changed', false));
    mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, 'index.html')}`);
    mainWindow.on('maximize', () => mainWindow.webContents.send('window-maximized', true));
    mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-maximized', false));

    // Disable backward/forward navigation using mouse side buttons (App commands)
    mainWindow.on('app-command', (e, cmd) => {
        if (cmd === 'browser-backward' || cmd === 'browser-forward') {
            e.preventDefault();
        }
    });

    if (isDev) mainWindow.webContents.openDevTools();
}

ipcMain.on('voice-state-sync', (event, state) => {
    updateTrayStatus(state);
});

ipcMain.on('show-native-notification', (event, { title, body, silent }) => {
    if (Notification.isSupported()) {
        const notification = new Notification({
            title,
            body,
            silent,
            icon: path.join(__dirname, 'icon.png')
        });
        notification.show();
        notification.on('click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });
    }
});

ipcMain.on('clipboard-write', (event, text) => {
    try { clipboard.writeText(text); } catch (error) { }
});

ipcMain.on('open-external-url', (event, url) => {
    try {
        shell.openExternal(url);
    } catch (e) {
        log.error("Failed to open external URL:", e);
    }
});

const { exec } = require('child_process');
let lastActivity = null;
let activityStartTime = null;
let scanInProgress = false;
let currentScanTimeout = null;
let adaptiveInterval = 3000;

// API Keys and Cache
// USER: Replace with your actual SteamGridDB API Key
const STEAMGRID_API_KEY = '84d5caff741db867dcb433b3e3a7fd37';
const gameMetadataCache = new Map();

const KNOWN_GAMES = {
    'VALORANT-Win64-Shipping.exe': { name: 'VALORANT', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/516575_IGDB-285x380.jpg', type: 'game' },
    'VALORANT.exe': { name: 'VALORANT', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/516575_IGDB-285x380.jpg', type: 'game' },
    'cs2.exe': { name: 'Counter-Strike 2', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-285x380.jpg', type: 'game' },
    'csgo.exe': { name: 'Counter-Strike: GO', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/32399_IGDB-285x380.jpg', type: 'game' },
    'dota2.exe': { name: 'Dota 2', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/29595_IGDB-285x380.jpg', type: 'game' },
    'League of Legends.exe': { name: 'League of Legends', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/21779_IGDB-285x380.jpg', type: 'game' },
    'Minecraft.exe': { name: 'Minecraft', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg', type: 'game' },
    'javaw.exe': { name: 'Minecraft', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/27471_IGDB-285x380.jpg', type: 'game' },
    'RobloxPlayerBeta.exe': { name: 'Roblox', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/23020_IGDB-285x380.jpg', type: 'game' },
    'Roblox.exe': { name: 'Roblox', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/23020_IGDB-285x380.jpg', type: 'game' },
    'GenshinImpact.exe': { name: 'Genshin Impact', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/513181_IGDB-285x380.jpg', type: 'game' },
    'aces.exe': { name: 'War Thunder', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/66366_IGDB-285x380.jpg', type: 'game' },
    'WarThunder.exe': { name: 'War Thunder', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/66366_IGDB-285x380.jpg', type: 'game' },
    'FortniteClient-Win64-Shipping.exe': { name: 'Fortnite', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/33214_IGDB-285x380.jpg', type: 'game' },

    // New games from Steam library
    'witcher3.exe': { name: 'The Witcher 3', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/115977_IGDB-285x380.jpg', type: 'game' },
    'r5apex.exe': { name: 'Apex Legends', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/511224_IGDB-285x380.jpg', type: 'game' },
    'arma3.exe': { name: 'Arma 3', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/30028_IGDB-285x380.jpg', type: 'game' },
    'arma3_x64.exe': { name: 'Arma 3', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/30028_IGDB-285x380.jpg', type: 'game' },
    'Content Warning.exe': { name: 'Content Warning', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/394758168_IGDB-285x380.jpg', type: 'game' },
    'deadlock.exe': { name: 'Deadlock', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/1908684124_IGDB-285x380.jpg', type: 'game' },
    'project8.exe': { name: 'Deadlock', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/1908684124_IGDB-285x380.jpg', type: 'game' },
    'Phasmophobia.exe': { name: 'Phasmophobia', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/518064_IGDB-285x380.jpg', type: 'game' },
    'TslGame.exe': { name: 'PUBG: BATTLEGROUNDS', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/493057_IGDB-285x380.jpg', type: 'game' },
    'RustClient.exe': { name: 'Rust', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/26348_IGDB-285x380.jpg', type: 'game' },
    'Squad.exe': { name: 'Squad', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/488632_IGDB-285x380.jpg', type: 'game' },
    'SquadGame.exe': { name: 'Squad', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/488632_IGDB-285x380.jpg', type: 'game' },
    'TheForest.exe': { name: 'The Forest', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/33857_IGDB-285x380.jpg', type: 'game' },
    'RainbowSix.exe': { name: 'Rainbow Six Siege', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/460630_IGDB-285x380.jpg', type: 'game' },
    'RainbowSix_Vulkan.exe': { name: 'Rainbow Six Siege', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/460630_IGDB-285x380.jpg', type: 'game' },
    '7DaysToDie.exe': { name: '7 Days to Die', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/27136_IGDB-285x380.jpg', type: 'game' },
    'BeamNG.drive.x64.exe': { name: 'BeamNG.drive', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/70440_IGDB-285x380.jpg', type: 'game' },
    'cms2018.exe': { name: 'Car Mechanic Simulator 2018', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/497424_IGDB-285x380.jpg', type: 'game' },
    'RelicCoH2.exe': { name: 'Company of Heroes 2', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/33075_IGDB-285x380.jpg', type: 'game' },
    'DCS.exe': { name: 'DCS World', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/21971_IGDB-285x380.jpg', type: 'game' },
    'Deceit.exe': { name: 'Deceit', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/494519_IGDB-285x380.jpg', type: 'game' },
    'destiny2.exe': { name: 'Destiny 2', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/497057_IGDB-285x380.jpg', type: 'game' },
    'Devour.exe': { name: 'DEVOUR', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/512942_IGDB-285x380.jpg', type: 'game' },
    'dontstarve_steam.exe': { name: "Don't Starve Together", icon: 'https://static-cdn.jtvnw.net/ttv-boxart/32629_IGDB-285x380.jpg', type: 'game' }
};

const SHARING_BLACKLIST = [
    'NVIDIA GeForce Experience',
    'NVIDIA Share',
    'NVIDIA Overlay',
    'Microsoft Text Input Application',
    'Settings',
    'Task Manager',
    'Program Manager',
    'Search',
    'Start',
    'Shell Experience Host',
    'Settings',
    'Action Center'
];

const NEUTRAL_PROCESSES = [
    'powershell.exe',
    'cmd.exe',
    'idle.exe',
    'electron.exe',
    'maxcord.exe',
    'searchhost.exe',
    'startmenuexperiencehost.exe',
    'taskmgr.exe'
];

function scheduleNextScan() {
    if (currentScanTimeout) clearTimeout(currentScanTimeout);
    currentScanTimeout = setTimeout(scanActivities, adaptiveInterval);
}

const FG_SCRIPT = `$code = '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);'; $t = Add-Type -MemberDefinition $code -Name 'W32' -Namespace 'W32' -PassThru; $hwnd = $t::GetForegroundWindow(); if($hwnd -ne 0){ $pidOut=0; $t::GetWindowThreadProcessId($hwnd, [ref]$pidOut); if ($pidOut -ne $pid) { (Get-Process -Id $pidOut).ProcessName + '.exe' } }`;

const STEAM_ID_SCRIPT = `Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -Name 'RunningAppID' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty RunningAppID`;

async function getSteamAppId() {
    return new Promise((resolve) => {
        exec(`powershell -Command "${STEAM_ID_SCRIPT}"`, (err, stdout) => {
            if (err || !stdout.trim()) resolve(null);
            else resolve(stdout.trim());
        });
    });
}

async function getGameMetadata(appId, exeName = null) {
    const cacheKey = appId || exeName;
    if (gameMetadataCache.has(cacheKey)) return gameMetadataCache.get(cacheKey);

    let metadata = { name: 'Unknown Game', icon: null, type: 'game' };

    try {
        // If we don't have a key, we can't do much with SGDB
        if (!STEAMGRID_API_KEY) {
            if (appId) {
                const steamRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
                if (steamRes.data[appId]?.success) {
                    metadata.name = steamRes.data[appId].data.name;
                    metadata.icon = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
                }
            } else if (exeName && KNOWN_GAMES[exeName]) {
                metadata = { ...KNOWN_GAMES[exeName] };
            }
            gameMetadataCache.set(cacheKey, metadata);
            return metadata;
        }

        const headers = { 'Authorization': `Bearer ${STEAMGRID_API_KEY}` };

        // 1. Get Game Object and Name
        let sgdbGameId = null;
        if (appId) {
            try {
                const gameRes = await axios.get(`https://www.steamgriddb.com/api/v2/games/steam/${appId}`, { headers });
                if (gameRes.data.success) {
                    metadata.name = gameRes.data.data.name;
                    sgdbGameId = gameRes.data.data.id;
                }
            } catch (e) { log.warn(`SGDB Game lookup failed for Steam ID ${appId}`); }
        }

        // Fallback for name if SGDB lookup failed but we have appId
        if (appId && metadata.name === 'Unknown Game') {
            const steamRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`);
            if (steamRes.data[appId]?.success) {
                metadata.name = steamRes.data[appId].data.name;
            }
        } else if (!appId && exeName && KNOWN_GAMES[exeName]) {
            metadata.name = KNOWN_GAMES[exeName].name;
        }

        // 2. Search by name if we still don't have a SGDB ID
        if (!sgdbGameId && metadata.name !== 'Unknown Game') {
            const searchRes = await axios.get(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(metadata.name)}`, { headers });
            if (searchRes.data.success && searchRes.data.data.length > 0) {
                sgdbGameId = searchRes.data.data[0].id;
            }
        }

        // 3. Get Assets (Grids)
        if (sgdbGameId) {
            const assetsRes = await axios.get(`https://www.steamgriddb.com/api/v2/grids/game/${sgdbGameId}?dimensions=342x482,600x900`, { headers });
            if (assetsRes.data.success && assetsRes.data.data.length > 0) {
                metadata.icon = assetsRes.data.data[0].url;
            }
        }

        // Final fallbacks for icons
        if (!metadata.icon) {
            if (appId) {
                metadata.icon = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
            } else if (exeName && KNOWN_GAMES[exeName]) {
                metadata.icon = KNOWN_GAMES[exeName].icon;
            }
        }

        gameMetadataCache.set(cacheKey, metadata);
        return metadata;
    } catch (e) {
        log.error("Failed to fetch game metadata", e);
        return metadata.name !== 'Unknown Game' ? metadata : null;
    }
}

async function scanActivities() {
    if (process.platform !== 'win32' || scanInProgress) { scheduleNextScan(); return; }
    scanInProgress = true;

    try {
        // Priority 0: Steam API detection (identifies what Steam thinks is running)
        const steamAppId = await getSteamAppId();
        let steamMetadata = null;
        if (steamAppId && steamAppId !== '0' && steamAppId !== 'null') {
            steamMetadata = await getGameMetadata(steamAppId);
        }

        // Priority 1: Foreground Window EXE detection
        exec(`powershell -Command "${FG_SCRIPT}"`, async (fgErr, fgStdout) => {
            const fgExe = fgStdout?.trim().toLowerCase();
            
            if (!fgErr && fgExe) {
                const fgBase = fgExe.endsWith('.exe') ? fgExe.slice(0, -4) : fgExe;

                // Match with KNOWN_GAMES, or the Steam game we just found, or meta lookup
                let foundKey = Object.keys(KNOWN_GAMES).find(key => {
                    const kLower = key.toLowerCase();
                    return fgExe === kLower || fgBase === kLower || fgExe === kLower.replace('.exe', '');
                });

                if (foundKey) {
                    const metadata = await getGameMetadata(null, foundKey);
                    updateActivity(metadata, true, fgExe);
                    scanInProgress = false;
                    adaptiveInterval = 2000;
                    scheduleNextScan();
                    return;
                }

                // If foreground matches Steam game name
                if (steamMetadata && (fgExe.includes(steamMetadata.name.toLowerCase()) || steamMetadata.name.toLowerCase().includes(fgBase))) {
                    updateActivity(steamMetadata, true, fgExe);
                    scanInProgress = false;
                    adaptiveInterval = 2000;
                    scheduleNextScan();
                    return;
                }
            }
            
            // Priority 2: Full Scan fallback (KNOWN_GAMES) or Steam fallback
            if (steamMetadata) {
                updateActivity(steamMetadata, false, fgExe);
                scanInProgress = false;
                adaptiveInterval = 3000;
                scheduleNextScan();
            } else {
                performFullScan(fgExe);
            }
        });
    } catch (err) {
        log.error("Activity scan error:", err);
        scanInProgress = false;
        scheduleNextScan();
    }
}

function updateActivity(foundActivity, isForeground = false, currentForegroundExe = '') {
    const currentName = foundActivity ? foundActivity.name : null;
    const lastName = lastActivity ? lastActivity.name : null;
    
    // 1. Manage Activity State (Rich Presence)
    if (currentName !== lastName) {
        if (foundActivity) {
            lastActivity = { ...foundActivity };
            activityStartTime = Date.now();
        } else {
            lastActivity = null;
            activityStartTime = null;
        }
        if (mainWindow && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('activity-changed', lastActivity ? { ...lastActivity, startTime: activityStartTime } : null);
        }
        // Always notify overlay of activity data change
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('activity-changed', lastActivity ? { ...lastActivity, startTime: activityStartTime } : null);
        }
    }

    // 2. Manage Overlay Visibility (Foreground sync)
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        const isNeutral = NEUTRAL_PROCESSES.includes(currentForegroundExe?.trim().toLowerCase() || '');
        
        // Final visibility decision
        let shouldShow;
        if (isNeutral && lastActivity) {
            // Neutral process -> Keep showing if we have an active game activity
            // BUT: If the game was detected via Steam AND it's not in Priority 1, 
            // we should be careful about "phantom" games.
            shouldShow = isOverlayEnabled;
        } else {
            // Specific app check -> Only show if it's the game in foreground
            shouldShow = foundActivity && isForeground && isOverlayEnabled;
        }
        
        if (shouldShow) {
            overlayWindow.showInactive();
        } else {
            overlayWindow.hide();
        }
    }
}

function performFullScan(fgExe = '') {
    exec('tasklist /NH /FO CSV', (err, stdout) => {
        scanInProgress = false;
        if (err) { adaptiveInterval = 5000; scheduleNextScan(); return; }
        const lines = stdout.split(/\r?\n/);
        let bestMatch = null;

        // Optimize search by normalizing targets once
        const normalizedGames = Object.keys(KNOWN_GAMES).map(k => ({ key: k, lower: k.toLowerCase(), base: k.toLowerCase().replace('.exe', '') }));

        for (const line of lines) {
            const parts = line.split('","');
            if (parts.length > 0) {
                const exeNameLower = parts[0].replace(/"/g, '').trim().toLowerCase();
                const baseName = exeNameLower.endsWith('.exe') ? exeNameLower.slice(0, -4) : exeNameLower;

                const match = normalizedGames.find(g => exeNameLower === g.lower || baseName === g.base);
                if (match) {
                    bestMatch = KNOWN_GAMES[match.key];
                    break;
                }
            }
        }
        updateActivity(bestMatch, false, fgExe); // false = game not confirmed in foreground
        adaptiveInterval = bestMatch ? 3000 : 5000;
        scheduleNextScan();
    });
}

scanActivities();

ipcMain.handle('get-current-activity', () => lastActivity ? { ...lastActivity, startTime: activityStartTime } : null);

ipcMain.on('change-icon', (event, iconName) => {
    // Эта функция отключена
    const iconPath = path.join(__dirname, 'icon.ico');
    try {
        if (!fs.existsSync(iconPath)) return;
        const iconImage = nativeImage.createFromPath(iconPath);
        if (iconImage.isEmpty()) return;
        if (mainWindow) mainWindow.setIcon(iconImage);
        if (tray) tray.setImage(iconImage);
    } catch (err) { }
});

ipcMain.handle('toggle-fullscreen', async (event, isFullscreen) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        try {
            mainWindow.setFullScreen(isFullscreen);
            return new Promise((resolve) => setTimeout(() => resolve(mainWindow.isFullScreen()), 100));
        } catch (err) { return false; }
    }
    return false;
});

ipcMain.on('window-minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window-maximize', () => { if (mainWindow) { if (mainWindow.isMaximized()) mainWindow.unmaximize(); else mainWindow.maximize(); } });
ipcMain.on('window-close', () => { if (mainWindow) mainWindow.close(); });

ipcMain.handle('get-desktop-sources', async (event, options) => {
    let sources = await desktopCapturer.getSources(options);

    // Filter out blacklisted apps
    sources = sources.filter(source => {
        const name = source.name;
        // Skip if empty or in blacklist
        if (!name || name.trim() === '') return false;
        return !SHARING_BLACKLIST.some(blacklisted => name.includes(blacklisted));
    });

    return sources.map(source => ({
        id: source.id,
        name: source.name,
        // Use JPEG with 40% quality to avoid main process blocking (much faster than PNG)
        thumbnail: source.thumbnail.toDataURL({ type: 'image/jpeg', quality: 40 }),
        display_id: source.display_id,
        appIcon: source.appIcon ? source.appIcon.toDataURL({ type: 'image/jpeg', quality: 40 }) : null
    }));
});

ipcMain.handle('set-content-protection', (event, enabled) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setContentProtection(enabled);
    }
});

// --- Native Audio Capture Integration ---
let maxcordAudio = null;
try {
    // Attempt to load the native module. 
    // This might fail if the module was compiled for Node.js but we are running in Electron 
    // and the ABIs don't match. In a production build, electron-builder handles rebuilding.
    maxcordAudio = require('maxcord-native-audio');
    log.info("Native Audio Module loaded successfully.");
} catch (e) {
    log.warn("Failed to load native audio module. Loopback capture will be unavailable.", e);
}

ipcMain.on('start-audio-capture', (event, { pid, mode }) => {
    if (!maxcordAudio) {
        log.warn("start-native-audio called but module is not loaded.");
        return;
    }
    log.info(`[NativeAudio] Attempting to start capture. PID: ${pid}, Mode: ${mode}`);
    try {
        let audioBuffer = [];
        let bufferSizeThreshold = 3; // Batch 3 packets
        let flushTimeout = null;

        const flush = () => {
            if (audioBuffer.length > 0 && event.sender && !event.sender.isDestroyed()) {
                const totalLength = audioBuffer.reduce((acc, val) => acc + val.length, 0);
                const mergedBuffer = Buffer.concat(audioBuffer, totalLength);
                event.sender.send('audio-data-batch', mergedBuffer);
                audioBuffer = [];
            }
            if (flushTimeout) {
                clearTimeout(flushTimeout);
                flushTimeout = null;
            }
        };

        const result = maxcordAudio.start(pid, mode, (data) => {
            if (event.sender && !event.sender.isDestroyed()) {
                if (!Buffer.isBuffer(data)) {
                    event.sender.send('audio-meta', data);
                } else {
                    audioBuffer.push(data);

                    if (audioBuffer.length >= bufferSizeThreshold) {
                        flush();
                    } else if (!flushTimeout) {
                        // Ensure we don't hold data too long
                        flushTimeout = setTimeout(flush, 10);
                    }
                }
            }
        });
        log.info("[NativeAudio] Capture start result:", result);
    } catch (e) {
        log.error("[NativeAudio] Capture execution error:", e);
    }
});

ipcMain.on('stop-audio-capture', () => {
    if (maxcordAudio) {
        log.info("Stopping native capture.");
        maxcordAudio.stop();
    }
});
ipcMain.handle('get-app-pid', () => process.pid);
ipcMain.handle('get-pid-from-hwnd', (event, hwnd) => {
    if (maxcordAudio && maxcordAudio.getPidFromWindowHandle) {
        return maxcordAudio.getPidFromWindowHandle(Number(hwnd));
    }
    return 0;
});
// ----------------------------------------

function createOverlayWindow() {
    if (overlayWindow) return;

    const display = screen.getPrimaryDisplay();
    const { width, height } = display.bounds;

    overlayWindow = new BrowserWindow({
        width: 300,
        height: 500,
        x: 20,
        y: 20,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        movable: true,
        focusable: false,
        skipTaskbar: true,
        hasShadow: false,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
            preload: isDev ? path.join(__dirname, '../public/preload.js') : path.join(__dirname, 'preload.js')
        }
    });

    overlayWindow.webContents.setFrameRate(60);

    const url = isDev ? 'http://localhost:3000/#/overlay' : `file://${path.join(__dirname, 'index.html')}#/overlay`;
    console.log('[Electron] Loading Overlay URL:', url);
    
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setFullScreenable(false);
    
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.loadURL(url);

    overlayWindow.on('closed', () => {
        overlayWindow = null;
    });

    overlayWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription) => {
        console.error('Overlay failed to load:', errorCode, errorDescription);
    });

    let isShown = false;
    overlayWindow.once('ready-to-show', () => {
        if (!isShown && overlayWindow && lastActivity) {
            overlayWindow.showInactive();
            isShown = true;
        }
    });

    // We no longer fallback to show inactive here. 
    // updateActivity will handle showing it when a game is found.
}

ipcMain.on('toggle-overlay', (event, enabled) => {
    console.log('[Electron] Toggling overlay:', enabled);
    isOverlayEnabled = enabled;
    
    if (enabled) {
        if (!overlayWindow) {
            createOverlayWindow();
        }
        // Force evaluation of foreground game
        scanActivities();
    } else {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.hide();
        }
    }
});

ipcMain.on('update-overlay-data', (event, data) => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay-data', data);
    }
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.on('update-overlay-config', (event, config) => {
    if (overlayWindow && !overlayWindow.isDestroyed() && config.position) {
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;
        
        const sizeMultiplier = config.size || 1;
        const winWidth = Math.round(300 * sizeMultiplier);
        const winHeight = Math.round(600 * sizeMultiplier);
        let x = 20;
        let y = 20;
        
        switch (config.position) {
            case 'top-left': x = 20; y = 20; break;
            case 'top-right': x = width - winWidth - 20; y = 20; break;
            case 'middle-left': x = 20; y = Math.round((height / 2) - (winHeight / 2)); break;
            case 'middle-right': x = width - winWidth - 20; y = Math.round((height / 2) - (winHeight / 2)); break;
            case 'bottom-left': x = 20; y = height - winHeight - 20; break;
            case 'bottom-right': x = width - winWidth - 20; y = height - winHeight - 20; break;
        }
        
        overlayWindow.setBounds({ x, y, width: winWidth, height: winHeight });
        overlayWindow.webContents.send('overlay-config', config);
    }
});

// -------------------------------------------------------------

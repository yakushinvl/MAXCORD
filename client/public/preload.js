const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
    isElectron: true,
    ipc: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, func) => {
            const subscription = (event, ...args) => func(event, ...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        },
        send: (channel, ...args) => ipcRenderer.send(channel, ...args),
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
    },
    clipboard: {
        writeText: (text) => ipcRenderer.send('clipboard-write', text)
    },
    util: {
        openExternal: (url) => ipcRenderer.send('open-external-url', url)
    },
    getCurrentActivity: () => ipcRenderer.invoke('get-current-activity'),
    onActivityChanged: (callback) => {
        const subscription = (event, activity) => callback(activity);
        ipcRenderer.on('activity-changed', subscription);
        return () => ipcRenderer.removeListener('activity-changed', subscription);
    },
    windowControls: {
        minimize: () => ipcRenderer.send('window-minimize'),
        maximize: () => ipcRenderer.send('window-maximize'),
        close: () => ipcRenderer.send('window-close')
    },
    getDesktopSources: (options) => ipcRenderer.invoke('get-desktop-sources', options),
    setContentProtection: (enabled) => ipcRenderer.invoke('set-content-protection', enabled)
};

contextBridge.exposeInMainWorld('electron', electronAPI);

export const isElectron = (): boolean => {
    const win = window as any;
    return !!(
        win.process?.type === 'renderer' ||
        win.electron?.isElectron === true ||
        win.navigator?.userAgent?.includes('Electron') ||
        (typeof win.process !== 'undefined' && win.process.versions?.electron)
    );
};

export const getElectronAPI = () => {
    const win = window as any;
    if (!win.electron) return null;
    return win.electron;
};

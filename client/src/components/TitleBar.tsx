import React from 'react';
import './TitleBar.css';

const TitleBar: React.FC = () => {
    const isElectron = !!(window as any).electron;
    const [isMaximized, setIsMaximized] = React.useState(false);

    React.useEffect(() => {
        if (!isElectron) return;

        const removeListener = (window as any).electron.ipc.on('window-maximized', (_event: any, maximized: boolean) => {
            setIsMaximized(maximized);
        });

        return () => {
            if (removeListener) removeListener();
        };
    }, [isElectron]);

    if (!isElectron) return null;

    const handleMinimize = () => {
        (window as any).electron.windowControls.minimize();
    };

    const handleMaximize = () => {
        (window as any).electron.windowControls.maximize();
    };

    const handleClose = () => {
        (window as any).electron.windowControls.close();
    };

    return (
        <div className="title-bar">
            <div className="title-bar-drag-area">
                <div className="title-bar-title">MAXCORD</div>
            </div>
            <div className="title-bar-controls">
                <button className="control-btn minimize" onClick={handleMinimize} title="Свернуть">
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
                    </svg>
                </button>
                <button className="control-btn maximize" onClick={handleMaximize} title={isMaximized ? "Восстановить" : "Развернуть"}>
                    {isMaximized ? (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <path fill="none" stroke="currentColor" d="M3.5,3.5v5h5v-5H3.5z M1.5,1.5v7h1v-6h6v-1H1.5z"></path>
                        </svg>
                    ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12">
                            <rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"></rect>
                        </svg>
                    )}
                </button>
                <button className="control-btn close" onClick={handleClose} title="Закрыть">
                    <svg width="12" height="12" viewBox="0 0 12 12">
                        <path fill="none" stroke="currentColor" strokeWidth="1.2" d="M1 1l10 10M11 1L1 11"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;

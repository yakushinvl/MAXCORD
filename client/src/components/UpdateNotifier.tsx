import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useNotifications } from '../contexts/NotificationContext';

const parseVersion = (v: string): number[] => {
    const clean = v.replace(/^v/, '').split('-')[0];
    return clean.split('.').map(p => parseInt(p, 10) || 0);
};

const compareVersions = (a: string, b: string): number => {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return da - db;
    }
    return 0;
};

const getLocalVersion = async (): Promise<string | null> => {
    const electron = (window as any).electron;
    if (electron && electron.ipc) {
        try {
            const v = await electron.ipc.invoke('get-app-version');
            if (typeof v === 'string' && v) return v;
        } catch (e) { }
    }
    return null;
};

const UpdateNotifier = () => {
    const { addNotification } = useNotifications();
    const lastShownRef = useRef<string | null>(null);

    useEffect(() => {
        // The "behind latest" notification only makes sense for the desktop client;
        // a browser session always serves the current build.
        const electron = (window as any).electron;
        if (!electron || !electron.ipc) return;

        const check = async () => {
            try {
                const local = await getLocalVersion();
                if (!local) return;

                const res = await axios.get('/api/version');
                const latest: string | undefined = res.data?.version;
                if (!latest) return;

                const dismissed = localStorage.getItem('update-notice-dismissed');

                if (compareVersions(local, latest) >= 0) {
                    if (dismissed) localStorage.removeItem('update-notice-dismissed');
                    lastShownRef.current = null;
                    return;
                }

                if (dismissed === latest) return;
                if (lastShownRef.current === latest) return;

                lastShownRef.current = latest;
                addNotification({
                    type: 'info',
                    title: 'Доступно обновление',
                    content: `Установлена версия ${local}, доступна ${latest}. Перезапустите приложение, чтобы обновиться.`,
                    duration: 0,
                    onClick: () => {
                        localStorage.setItem('update-notice-dismissed', latest);
                    },
                });
            } catch (e) { }
        };

        const initialTimer = window.setTimeout(check, 4000);
        const interval = window.setInterval(check, 60 * 60 * 1000);
        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, [addNotification]);

    return null;
};

export default UpdateNotifier;

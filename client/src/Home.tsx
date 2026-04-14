import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { VoiceProvider } from './contexts/VoiceContext';
import { InboxProvider } from './contexts/InboxContext';
import Main from './pages/Main';
import Landing from './pages/Landing';

const Home: React.FC = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="invite-page-loading">
                <div className="loading-spinner-rings">
                    <div></div><div></div><div></div><div></div>
                </div>
                <span>Инициализация...</span>
            </div>
        );
    }

    if (!user) {
        const isElectron = !!(window as any).electron;
        return isElectron ? <Navigate to="/login" replace /> : <Landing />;
    }

    return (
        <SocketProvider>
            <VoiceProvider>
                <InboxProvider>
                    <Main />
                </InboxProvider>
            </VoiceProvider>
        </SocketProvider>
    );
};

export default Home;

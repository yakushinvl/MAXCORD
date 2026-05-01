import React from 'react';
import { HashRouter, BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Login from './pages/Login';
import Register from './pages/Register';
import InvitePage from './pages/InvitePage';
import Docs from './pages/Docs';
import Policy from './pages/Policy';
import Home from './Home';
import { AppearanceProvider } from './contexts/AppearanceContext';
import './App.css';
import { useEffect } from 'react';
import TitleBar from './components/TitleBar';
import Overlay from './pages/Overlay';

const ElectronHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // @ts-ignore
    const electron = window.electron;
    if (electron && electron.ipc) {
      const handleLink = (url: string) => {
        try {
          const parsedUrl = new URL(url.replace('maxcord://', 'http://localhost/'));
          const pathParts = parsedUrl.pathname.split('/').filter(p => !!p);
          if (pathParts[0] === 'invite' && pathParts[1]) navigate(`/invite/${pathParts[1]}`);
        } catch (err) { }
      };
      const removeListener = electron.ipc.on('deep-link', (_event: any, url: string) => handleLink(url));
      electron.ipc.invoke('get-pending-deep-link').then((url: string | null) => { if (url) handleLink(url); });
      return () => { if (removeListener) removeListener(); };
    }
  }, [navigate]);

  return null;
};

import { useLocation } from 'react-router-dom';
import { useAppearance } from './contexts/AppearanceContext';

const AppBackground: React.FC = () => {
  const location = useLocation();
  const { 
    theme, 
    performanceMode, 
    customBackground, 
    backgroundDim, 
    backgroundBlur 
  } = useAppearance();
  const currentPath = (location.pathname + (location.hash || '')).toLowerCase();

  // Checking for login, register, and invite. 
  // We use direct check to make it robust across all routing types.
  const isAuthPage = currentPath.includes('login') ||
    currentPath.includes('register') ||
    currentPath.includes('invite');

  const getBaseBgColor = () => {
    if (theme === 'amoled') return '#000000';
    if (theme === 'light') return '#ffffff';
    return '#020205';
  };

  const getGradient = () => {
    if (theme === 'light') {
      // Soft Pearl Liquid
      return 'linear-gradient(-45deg, #ffffff, #f0f4ff, #fff0f5, #f5f0ff, #ffffff)';
    }
    if (theme === 'amoled') {
      // Deep Void Liquid (Subtle oil slick)
      return 'linear-gradient(-45deg, #000000, #050010, #000810, #080005, #000000)';
    }
    // Standard Dark (Deep Space Liquid)
    return 'linear-gradient(-45deg, #020204, #15082e, #0a1f38, #2e081c, #020204)';
  };

   const isOverlay = currentPath.includes('/overlay');
   if (isOverlay) return null;

   return (
    <div
      id="global-liquid-bg"
      style={{
        position: 'fixed',
        inset: '-10%', // Oversized for liquidFloat animation
        width: '120vw',
        height: '120vh',
        zIndex: 0,
        backgroundColor: getBaseBgColor(),
        overflow: 'hidden',
        animation: performanceMode ? 'none' : 'liquidFloat 60s ease-in-out infinite',
        pointerEvents: 'none'
      }}
    >
      {/* Base Liquid Gradient - Always active for "life" */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: getGradient(),
        backgroundSize: '300% 300%',
        animation: performanceMode ? 'none' : 'gradientMove 30s ease infinite',
        opacity: isAuthPage ? 0.4 : 1, // More subtle when bg.png is active
        transition: 'opacity 0.5s ease'
      }} />

      {/* Custom User Background Layer */}
      {customBackground && !performanceMode && (
        <div style={{
          position: 'absolute',
          inset: '10%', // Offset the -10% of parent to fill viewport exactly
          backgroundImage: `url(${customBackground})`,
          backgroundPosition: 'center center',
          backgroundSize: 'cover',
          filter: `blur(${backgroundBlur}px)`,
          transform: 'scale(1.1)', // Prevents white edges when blurred
          zIndex: 1,
          transition: 'all 0.5s ease'
        }} />
      )}

      {/* Custom User Background Dim Layer */}
      {customBackground && !performanceMode && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: `rgba(0, 0, 0, ${backgroundDim / 100})`,
          zIndex: 2,
          transition: 'background-color 0.3s ease'
        }} />
      )}

      {/* Auth Background Image Layer */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: isAuthPage ? 'url("redesign-assets/bg.png")' : 'none',
        backgroundPosition: 'center center',
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        opacity: isAuthPage ? 1 : 0,
        zIndex: 3,
        transition: 'opacity 0.6s ease',
        transform: isAuthPage ? 'scale(1.05)' : 'scale(1)', // Subtle scale shift
      }} />

      {/* Decorative spheres - Always present and moving */}
      {!performanceMode && theme !== 'light' && !customBackground && (
        <>
          <div style={{
            position: 'absolute',
            top: '15%', left: '10%',
            width: '300px', height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0, 229, 255, 0.15), transparent 70%)',
            filter: 'blur(60px)',
            animation: 'float 15s infinite ease-in-out'
          }}></div>
          <div style={{
            position: 'absolute',
            bottom: '20%', right: '15%',
            width: '400px', height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(161, 85, 255, 0.1), transparent 70%)',
            filter: 'blur(80px)',
            animation: 'float 22s infinite ease-in-out reverse'
          }}></div>
        </>
      )}
    </div>
  );
};

import { ChatSettingsProvider } from './contexts/ChatSettingsContext';
import { WindowSettingsProvider } from './contexts/WindowSettingsContext';
import { DialogProvider } from './contexts/DialogContext';

function App() {
  const isElectron = !!(window as any).electron;
  const Router = isElectron ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/overlay" element={<Overlay />} />
        <Route path="*" element={
          <DialogProvider>
            <AuthProvider>
              <AppearanceProvider>
                <ChatSettingsProvider>
                  <WindowSettingsProvider>
                    <NotificationProvider>
                      <div className="App" style={{ position: 'relative' }}>
                        <AppBackground />
                        <TitleBar />
                        <ElectronHandler />
                        <div className="app-content" style={{ position: 'relative', zIndex: 1 }}>
                          <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/invite/:code" element={<InvitePage />} />
                            <Route path="/docs" element={<Docs />} />
                            <Route path="/policy" element={<Policy />} />
                            <Route path="/" element={<Home />} />
                            <Route path="/*" element={<Home />} />
                          </Routes>
                        </div>
                      </div>
                    </NotificationProvider>
                  </WindowSettingsProvider>
                </ChatSettingsProvider>
              </AppearanceProvider>
            </AuthProvider>
          </DialogProvider>
        } />
      </Routes>
    </Router>
  );
}

export default App;

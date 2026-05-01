import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';
import ReconnectingOverlay from '../components/ReconnectingOverlay';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
};

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://maxcord.fun';
const OVERLAY_DELAY = 60000; // 1 minute in ms

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, logout } = useAuth();
  const { addNotification } = useNotifications();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(true); // Default to true to prevent flash
  const [showOverlay, setShowOverlay] = useState(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity, // Keep trying
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      newSocket.on('connect', () => {
        console.log('Successfully connected to Socket.io');
        setConnected(true);
        setShowOverlay(false);
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
        setConnected(false);
        
        // Start 3-minute timer
        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            setShowOverlay(true);
          }, OVERLAY_DELAY);
        }
      });

      newSocket.on('connect_error', (err) => {
        setConnected(false);
        if (!disconnectTimerRef.current) {
          disconnectTimerRef.current = setTimeout(() => {
            setShowOverlay(true);
          }, OVERLAY_DELAY);
        }
      });

      newSocket.on('notification', (data: any) => {
        addNotification({
          title: 'Модерация',
          content: data.message,
          type: data.type === 'moderation_violation' ? 'warning' : 'info'
        });
      });

      newSocket.on('account-banned', (data: any) => {
        addNotification({
          title: 'Блокировка аккаунта',
          content: data.message,
          type: 'error'
        });
        setTimeout(() => logout(), 5000);
      });

      setSocket(newSocket);

      return () => { 
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        newSocket.close(); 
      };
    }
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {showOverlay && <ReconnectingOverlay />}
      {children}
    </SocketContext.Provider>
  );
};

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

let socketInstance = null;

export function useWebSocket() {
  const { user, token } = useAuthStore();
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Map());

  useEffect(() => {
    if (!user?.id || !token) return;

    if (!socketInstance || !socketInstance.connected) {
      const socketURL = import.meta.env.VITE_API_URL || '/';
      socketInstance = io(socketURL, {
        auth: { userId: user.id },
        extraHeaders: { Authorization: `Bearer ${token}` },
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        transports: ['websocket'],
      });
    }

    const socket = socketInstance;
    setConnected(socket.connected);

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [user?.id, token]);

  const on = (event, handler) => {
    if (!socketInstance) return;
    socketInstance.on(event, handler);
    return () => socketInstance?.off(event, handler);
  };

  const off = (event, handler) => {
    socketInstance?.off(event, handler);
  };

  return { connected, on, off, socket: socketInstance };
}

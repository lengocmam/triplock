import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const socket = io(url, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('reconnect', () => setConnected(true));

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socketRef, connected };
}
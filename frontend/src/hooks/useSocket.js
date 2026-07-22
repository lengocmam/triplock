import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);

  useEffect(() => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    socketRef.current = io(url);

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return socketRef;
}
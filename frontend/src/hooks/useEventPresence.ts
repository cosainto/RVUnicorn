import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

export type PresenceStatus = 'HERE_NOW' | 'GOING' | 'MAYBE' | 'NOT_GOING';

export interface PresenceEntry {
  userId: string;
  presenceStatus: PresenceStatus;
  user: { id: string; firstName: string; lastName?: string; username?: string; profilePicture?: string | null };
}

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useEventPresence(eventId: string | undefined) {
  const { user } = useAuth() as any;
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [lifecycle, setLifecycle] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const socket = io(`${SOCKET_URL}/events`, {
      query: { eventId, userId: user?.id || '' },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('presence:snapshot', (data: { lifecycle: string; presence: PresenceEntry[] }) => {
      setLifecycle(data.lifecycle);
      setPresence(data.presence);
    });

    socket.on('presence:arrived', (data: { userId: string; user?: any }) => {
      setPresence(prev => prev.map(p =>
        p.userId === data.userId ? { ...p, presenceStatus: 'HERE_NOW' as PresenceStatus } : p
      ));
    });

    socket.on('presence:departed', (data: { userId: string }) => {
      setPresence(prev => prev.map(p =>
        p.userId === data.userId ? { ...p, presenceStatus: 'GOING' as PresenceStatus } : p
      ));
    });

    return () => { socket.disconnect(); };
  }, [eventId, user?.id]);

  const hereNow = presence.filter(p => p.presenceStatus === 'HERE_NOW');
  const going = presence.filter(p => p.presenceStatus === 'GOING');
  const maybe = presence.filter(p => p.presenceStatus === 'MAYBE');

  return { presence, hereNow, going, maybe, lifecycle };
}

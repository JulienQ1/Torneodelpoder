'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomSnapshot, TieBreakRequest } from '@/shared/types/room';
import type { ImportResult } from '@/shared/types/socket';
import { emitAck, getSocket } from './socket';
import { loadSession } from './session';

export interface Notice {
  id: number;
  level: 'info' | 'error';
  message: string;
}

export interface RoomController {
  snapshot: RoomSnapshot | null;
  participantId: string | null;
  connected: boolean;
  closed: string | null;
  notices: Notice[];
  dismissNotice: (id: number) => void;
  actions: {
    addManual: (url: string) => Promise<ImportResult>;
    addPlaylist: (url: string) => Promise<ImportResult>;
    removeSong: (songId: string) => Promise<void>;
    dedupe: () => Promise<{ removed: number }>;
    setVoteTimer: (seconds: number | null) => Promise<void>;
    start: () => Promise<void>;
    next: () => Promise<void>;
    resolveTie: (resolution: TieBreakRequest) => Promise<void>;
    vote: (side: 'A' | 'B') => Promise<void>;
  };
}

/**
 * Subscribes to a room's realtime state and exposes typed action helpers.
 * Handles reconnect by re-resuming the stored session automatically.
 */
export function useRoomSocket(roomId: string): RoomController {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const participantIdRef = useRef<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);

  const pushNotice = useCallback((level: Notice['level'], message: string) => {
    setNotices((prev) => [...prev, { id: Date.now() + Math.random(), level, message }]);
  }, []);

  const dismissNotice = useCallback((id: number) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const resume = () => {
      const session = loadSession();
      if (session && session.roomId === roomId) {
        participantIdRef.current = session.participantId;
        setParticipantId(session.participantId);
        emitAck('room:resume', {
          roomId,
          participantId: session.participantId,
        }).catch((err: Error) => setClosed(err.message));
      }
    };

    const onConnect = () => {
      setConnected(true);
      resume();
    };
    const onDisconnect = () => setConnected(false);
    const onState = (snap: RoomSnapshot) => setSnapshot(snap);
    const onClosed = (p: { reason: string }) => setClosed(p.reason);
    const onNotice = (p: { level: 'info' | 'error'; message: string }) =>
      pushNotice(p.level, p.message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:state', onState);
    socket.on('room:closed', onClosed);
    socket.on('room:notice', onNotice);

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:state', onState);
      socket.off('room:closed', onClosed);
      socket.off('room:notice', onNotice);
    };
  }, [roomId, pushNotice]);

  const actions = {
    addManual: (url: string) =>
      emitAck<[{ roomId: string; url: string }], ImportResult>('songs:addManual', {
        roomId,
        url,
      }),
    addPlaylist: (url: string) =>
      emitAck<[{ roomId: string; url: string }], ImportResult>('songs:addPlaylist', {
        roomId,
        url,
      }),
    removeSong: (songId: string) =>
      emitAck<[{ roomId: string; songId: string }], void>('songs:remove', {
        roomId,
        songId,
      }),
    dedupe: () =>
      emitAck<[{ roomId: string }], { removed: number }>('songs:dedupe', { roomId }),
    setVoteTimer: (seconds: number | null) =>
      emitAck<[{ roomId: string; seconds: number | null }], void>('room:setVoteTimer', {
        roomId,
        seconds,
      }),
    start: () => emitAck<[{ roomId: string }], void>('tournament:start', { roomId }),
    next: () => emitAck<[{ roomId: string }], void>('tournament:next', { roomId }),
    resolveTie: (resolution: TieBreakRequest) =>
      emitAck<[{ roomId: string; resolution: TieBreakRequest }], void>(
        'tournament:resolveTie',
        { roomId, resolution },
      ),
    vote: (side: 'A' | 'B') =>
      emitAck<[{ roomId: string; side: 'A' | 'B' }], void>('vote:cast', {
        roomId,
        side,
      }),
  };

  return {
    snapshot,
    participantId,
    connected,
    closed,
    notices,
    dismissNotice,
    actions,
  };
}

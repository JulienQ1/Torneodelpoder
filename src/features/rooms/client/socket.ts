'use client';

import { io, type Socket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@/shared/types/socket';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** Lazily create the one shared socket connection for the whole app. */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({
      path: '/api/socket',
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

/**
 * Promise wrapper around an emit-with-ack. Rejects with the server's message
 * so callers can `try/catch` naturally instead of dealing with callbacks.
 */
export function emitAck<Args extends unknown[], T>(
  event: keyof ClientToServerEvents,
  ...args: [...Args]
): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    // socket.io types the emit tuple per-event; we bridge through unknown here.
    (s.emit as (e: string, ...a: unknown[]) => void)(
      event,
      ...args,
      (res: Ack<T>) => {
        if (res.ok) resolve(res.data);
        else reject(new Error(res.error));
      },
    );
  });
}

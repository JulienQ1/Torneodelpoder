import type { Song, SongInput } from './song';
import type { RoomSettings, RoomSnapshot, TieBreakRequest } from './room';

/**
 * The typed Socket.IO contract shared by client and server.
 *
 * Keeping events in one strongly-typed file means the browser and the server
 * cannot drift: a renamed event or changed payload is a compile error on both
 * sides. All acknowledgements use the `Ack<T>` discriminated union so errors
 * are handled uniformly.
 */

export type Ack<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface ImportResult {
  added: Song[];
  duplicatesSkipped: number;
}

/** Events the client emits to the server. */
export interface ClientToServerEvents {
  'room:create': (
    payload: { nickname: string; title?: string },
    ack: (res: Ack<{ roomId: string; participantId: string }>) => void,
  ) => void;

  'room:join': (
    payload: { code: string; nickname: string },
    ack: (res: Ack<{ roomId: string; participantId: string }>) => void,
  ) => void;

  /** Re-attach an existing participant (e.g. after a reconnect/refresh). */
  'room:resume': (
    payload: { roomId: string; participantId: string },
    ack: (res: Ack<{ roomId: string; participantId: string }>) => void,
  ) => void;

  'room:leave': (payload: { roomId: string }, ack: (res: Ack) => void) => void;

  // --- Lobby: song management (admin only) ---
  'songs:addManual': (
    payload: { roomId: string; url: string },
    ack: (res: Ack<ImportResult>) => void,
  ) => void;

  'songs:addPlaylist': (
    payload: { roomId: string; url: string },
    ack: (res: Ack<ImportResult>) => void,
  ) => void;

  'songs:addRaw': (
    payload: { roomId: string; song: SongInput },
    ack: (res: Ack<ImportResult>) => void,
  ) => void;

  'songs:remove': (
    payload: { roomId: string; songId: string },
    ack: (res: Ack) => void,
  ) => void;

  'songs:dedupe': (
    payload: { roomId: string },
    ack: (res: Ack<{ removed: number }>) => void,
  ) => void;

  /** Admin saves the room's current songs as a reusable playlist. */
  'playlist:save': (
    payload: { roomId: string; name?: string },
    ack: (res: Ack<{ code: string }>) => void,
  ) => void;

  /** Admin loads a saved playlist (by code) into the lobby. */
  'playlist:load': (
    payload: { roomId: string; code: string },
    ack: (res: Ack<ImportResult>) => void,
  ) => void;

  /** Admin sets (or clears with null) the per-match vote time limit. Lobby only. */
  'room:setVoteTimer': (
    payload: { roomId: string; seconds: number | null },
    ack: (res: Ack) => void,
  ) => void;

  /** Admin updates presentation settings (hide votes/media, bracket visibility). */
  'room:setSettings': (
    payload: { roomId: string; settings: Partial<RoomSettings> },
    ack: (res: Ack) => void,
  ) => void;

  // --- Tournament control (admin only) ---
  'tournament:start': (
    payload: { roomId: string },
    ack: (res: Ack) => void,
  ) => void;

  /** Reveal the current match's votes (step 1). `force` overrides "all voted". */
  'tournament:reveal': (
    payload: { roomId: string; force?: boolean },
    ack: (res: Ack) => void,
  ) => void;

  /** Advance to the next match after a reveal (step 2). */
  'tournament:next': (
    payload: { roomId: string },
    ack: (res: Ack) => void,
  ) => void;

  /** Undo: un-reveal the current match, or restore the previous match. */
  'tournament:goBack': (
    payload: { roomId: string },
    ack: (res: Ack) => void,
  ) => void;

  'tournament:resolveTie': (
    payload: { roomId: string; resolution: TieBreakRequest },
    ack: (res: Ack) => void,
  ) => void;

  // --- Voting (any participant) ---
  'vote:cast': (
    payload: { roomId: string; side: 'A' | 'B' },
    ack: (res: Ack) => void,
  ) => void;
}

/** Events the server emits to clients. */
export interface ServerToClientEvents {
  /** Full authoritative snapshot; sent on every meaningful state change. */
  'room:state': (snapshot: RoomSnapshot) => void;
  /** A match just concluded (drives winner animation). */
  'match:completed': (payload: { matchId: string; winnerId: string }) => void;
  /** The tournament finished. */
  'tournament:completed': (payload: { championId: string }) => void;
  /** Non-fatal server notice for the client to surface. */
  'room:notice': (payload: { level: 'info' | 'error'; message: string }) => void;
  /** The room no longer exists (admin left / expired). */
  'room:closed': (payload: { reason: string }) => void;
}

export interface SocketData {
  participantId?: string;
  roomId?: string;
}

'use client';

/** Persisted identity so a refresh can re-join the same room seamlessly. */
export interface StoredSession {
  roomId: string;
  participantId: string;
  nickname: string;
}

const KEY = 'torneo.session';

export function saveSession(session: StoredSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

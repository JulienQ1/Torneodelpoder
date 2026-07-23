import type { Match, Round, Tournament } from '@/shared/types/tournament';
import type { Song } from '@/shared/types/song';

export function currentMatch(t: Tournament | null): Match | null {
  if (!t || !t.currentMatchId) return null;
  return t.matches[t.currentMatchId] ?? null;
}

export function song(t: Tournament, id: string | null): Song | null {
  return id ? (t.songs[id] ?? null) : null;
}

/** How many matches are done vs total (for a progress bar). */
export function progress(t: Tournament): { done: number; total: number } {
  const all = Object.values(t.matches);
  return {
    done: all.filter((m) => m.status === 'completed').length,
    total: all.length,
  };
}

/** Round that the current match belongs to (for a "Round of 16" heading). */
export function currentRound(t: Tournament): Round | null {
  const m = currentMatch(t);
  if (!m) return null;
  return t.rounds[m.roundIndex] ?? null;
}

/** Label for a match's two competitors, resolving unknowns to a placeholder. */
export function competitorNames(t: Tournament, m: Match): [string, string] {
  const a = song(t, m.songAId);
  const b = song(t, m.songBId);
  return [a?.title ?? 'TBD', b?.title ?? 'TBD'];
}

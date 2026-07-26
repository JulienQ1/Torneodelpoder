import type { Tournament } from '@/shared/types/tournament';

export interface RankedSong {
  songId: string;
  /** 1-based final placement (1 = champion). Distinct per song. */
  rank: number;
  /** Total votes this song received across all its matches. */
  votes: number;
  /** Number of matches it won. */
  wins: number;
  /**
   * Index of the round in which it was eliminated (higher = survived longer).
   * The champion is never eliminated and gets the highest possible tier.
   */
  eliminatedRoundIndex: number;
}

/**
 * Rank every song in a *completed* tournament.
 *
 * Single-elimination doesn't inherently produce an exact 3rd/4th/… order, so
 * we rank by how far each song advanced (the round it was eliminated in — later
 * is better; the champion is top), and break ties by total votes received, then
 * wins, then title. This yields a full, distinct 1..N ordering.
 */
export function computeRanking(t: Tournament): RankedSong[] {
  const maxRound = t.rounds.length; // champion tier (never eliminated)

  const rows: Array<RankedSong & { title: string }> = Object.values(t.songs).map(
    (song) => {
      let votes = 0;
      let wins = 0;
      let eliminatedRoundIndex = maxRound; // assume survived unless a loss is found

      for (const m of Object.values(t.matches)) {
        const isA = m.songAId === song.id;
        const isB = m.songBId === song.id;
        if (!isA && !isB) continue;
        votes += isA ? m.votesA : m.votesB;
        if (m.status === 'completed') {
          if (m.winnerId === song.id) {
            wins += 1;
          } else {
            // Eliminated here. In single-elim a song loses at most once.
            eliminatedRoundIndex = m.roundIndex;
          }
        }
      }

      return {
        songId: song.id,
        rank: 0,
        votes,
        wins,
        eliminatedRoundIndex,
        title: song.title,
      };
    },
  );

  rows.sort(
    (a, b) =>
      b.eliminatedRoundIndex - a.eliminatedRoundIndex ||
      b.votes - a.votes ||
      b.wins - a.wins ||
      a.title.localeCompare(b.title),
  );

  return rows.map(({ title: _title, ...r }, i) => ({ ...r, rank: i + 1 }));
}

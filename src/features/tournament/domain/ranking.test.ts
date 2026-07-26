import { describe, expect, it } from 'vitest';
import type { Song } from '@/shared/types/song';
import { completeMatch, generateTournament, startTournament } from './bracket';
import { computeRanking } from './ranking';

function makeSongs(n: number): Song[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    title: `Song ${i}`,
    artist: `A${i}`,
    source: 'youtube' as const,
    sourceId: `yt${i}`,
    thumbnail: '',
    duration: 0,
    url: '',
  }));
}

/** Play the whole tournament, always awarding side A. */
function play(n: number, seed: number) {
  let t = startTournament(generateTournament(makeSongs(n), { seed, id: 't' }));
  let guard = 0;
  while (t.status === 'running') {
    if (guard++ > n * 4) throw new Error('stuck');
    const m = t.matches[t.currentMatchId!]!;
    t = completeMatch(t, m.id, m.songAId!);
  }
  return t;
}

describe('computeRanking', () => {
  it('ranks every song with distinct 1..N placements', () => {
    const t = play(8, 3);
    const ranking = computeRanking(t);
    expect(ranking).toHaveLength(8);
    expect(ranking.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // Champion is rank 1 and equals the tournament champion.
    expect(ranking[0]!.songId).toBe(t.championId);
  });

  it('places the final loser second', () => {
    const t = play(4, 1);
    const ranking = computeRanking(t);
    const final = t.rounds[t.rounds.length - 1]!;
    const finalMatch = t.matches[final.matchIds[0]!]!;
    const runnerUp = finalMatch.winnerId === finalMatch.songAId ? finalMatch.songBId : finalMatch.songAId;
    expect(ranking[1]!.songId).toBe(runnerUp);
  });

  it('ranks a song eliminated later above one eliminated earlier', () => {
    const t = play(8, 9);
    const ranking = computeRanking(t);
    for (let i = 1; i < ranking.length; i++) {
      // Elimination round is non-increasing down the ranking.
      expect(ranking[i]!.eliminatedRoundIndex).toBeLessThanOrEqual(
        ranking[i - 1]!.eliminatedRoundIndex,
      );
    }
  });
});

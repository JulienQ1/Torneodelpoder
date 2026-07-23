import { describe, expect, it } from 'vitest';
import type { Song } from '@/shared/types/song';
import {
  completeMatch,
  finalMatch,
  generateTournament,
  matchesInPlayOrder,
  nextPlayableMatch,
  startTournament,
} from './bracket';

function makeSongs(n: number): Song[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    title: `Song ${i}`,
    artist: `Artist ${i}`,
    source: 'youtube' as const,
    sourceId: `yt${i}`,
    thumbnail: '',
    duration: 180,
    url: `https://youtu.be/yt${i}`,
  }));
}

/** Play out a whole tournament, always picking song A as the winner. */
function playToCompletion(entrants: number, seed: number) {
  let t = startTournament(
    generateTournament(makeSongs(entrants), { seed, id: 't' }),
  );
  let guard = 0;
  while (t.status === 'running') {
    if (guard++ > entrants * 4) throw new Error('did not terminate');
    const current = t.currentMatchId ? t.matches[t.currentMatchId] : null;
    expect(current).toBeTruthy();
    expect(current!.status).toBe('active');
    expect(current!.songAId).not.toBeNull();
    expect(current!.songBId).not.toBeNull();
    t = completeMatch(t, current!.id, current!.songAId!);
  }
  return t;
}

describe('generateTournament — structure', () => {
  it('rejects fewer than 2 songs', () => {
    expect(() => generateTournament(makeSongs(1))).toThrow();
  });

  it('creates no Sudden Death round for a power-of-two count', () => {
    const t = generateTournament(makeSongs(16), { seed: 1 });
    expect(t.suddenDeathMatchCount).toBe(0);
    expect(t.rounds.some((r) => r.isSuddenDeath)).toBe(false);
    expect(t.rounds[0]!.name).toBe('Round of 16');
  });

  it('creates a Sudden Death round for 36 songs', () => {
    const t = generateTournament(makeSongs(36), { seed: 1 });
    expect(t.bracketSize).toBe(32);
    expect(t.suddenDeathMatchCount).toBe(4);
    const sd = t.rounds[0]!;
    expect(sd.isSuddenDeath).toBe(true);
    expect(sd.matchIds).toHaveLength(4);
    expect(t.rounds[1]!.name).toBe('Round of 32');
    expect(finalMatch(t).roundIndex).toBe(t.rounds.length - 1);
  });

  it('names the closing rounds conventionally', () => {
    const t = generateTournament(makeSongs(8), { seed: 3 });
    const names = t.rounds.map((r) => r.name);
    expect(names).toEqual(['Quarterfinals', 'Semifinals', 'Final']);
  });
});

describe('generateTournament — invariants across many sizes', () => {
  const sizes = [2, 3, 5, 8, 15, 16, 18, 22, 31, 32, 36, 37, 64, 70, 100, 128];

  it.each(sizes)('%i entrants → exactly (n-1) matches', (n) => {
    const t = generateTournament(makeSongs(n), { seed: 7 });
    expect(Object.keys(t.matches)).toHaveLength(n - 1);
  });

  it.each(sizes)('%i entrants → every song appears as a competitor', (n) => {
    const t = generateTournament(makeSongs(n), { seed: 9 });
    const seen = new Set<string>();
    for (const m of Object.values(t.matches)) {
      if (m.slotA.kind === 'song') seen.add(m.slotA.songId);
      if (m.slotB.kind === 'song') seen.add(m.slotB.songId);
    }
    // Every entrant enters somewhere (either Sudden Death or a bye seed).
    expect(seen.size).toBe(n);
  });

  it.each(sizes)('%i entrants → a single champion emerges', (n) => {
    const t = playToCompletion(n, 42);
    expect(t.status).toBe('completed');
    expect(t.championId).not.toBeNull();
    expect(t.championId).toBe(finalMatch(t).winnerId);
    // Every match completed.
    for (const m of Object.values(t.matches)) {
      expect(m.status).toBe('completed');
      expect(m.winnerId).not.toBeNull();
    }
  });
});

describe('progression', () => {
  it('plays Sudden Death before the main bracket', () => {
    const t = startTournament(generateTournament(makeSongs(36), { seed: 5 }));
    // First active match must be a Sudden Death match.
    const first = t.matches[t.currentMatchId!]!;
    expect(first.roundIndex).toBe(0);
  });

  it('activates the next match after completing one', () => {
    let t = startTournament(generateTournament(makeSongs(8), { seed: 2 }));
    const first = t.matches[t.currentMatchId!]!;
    t = completeMatch(t, first.id, first.songAId!);
    expect(t.matches[first.id]!.status).toBe('completed');
    // A fresh match is now active and pointed to by currentMatchId.
    expect(t.currentMatchId).not.toBeNull();
    expect(t.matches[t.currentMatchId!]!.status).toBe('active');
    expect(t.currentMatchId).not.toBe(first.id);
  });

  it('propagates a Sudden Death winner into the main bracket', () => {
    let t = startTournament(generateTournament(makeSongs(3), { seed: 11 }));
    // 3 songs → bracket 2, 1 SD match, 1 bye. Total 2 matches.
    expect(Object.keys(t.matches)).toHaveLength(2);
    const sd = matchesInPlayOrder(t)[0]!;
    expect(sd.roundIndex).toBe(0);
    const winner = sd.songAId!;
    t = completeMatch(t, sd.id, winner);
    // The final now includes the SD winner as one competitor.
    const fin = finalMatch(t);
    const competitors = [fin.songAId, fin.songBId];
    expect(competitors).toContain(winner);
    // Only 2 matches total, so the final is now the active match.
    expect(fin.status).toBe('active');
  });

  it('rejects an invalid winner', () => {
    const t = startTournament(generateTournament(makeSongs(4), { seed: 1 }));
    const m = t.matches[t.currentMatchId!]!;
    expect(() => completeMatch(t, m.id, 'not-a-song')).toThrow();
  });

  it('records the tie-break method used', () => {
    let t = startTournament(generateTournament(makeSongs(2), { seed: 1 }));
    const m = t.matches[t.currentMatchId!]!;
    t = completeMatch(t, m.id, m.songAId!, 'coin-flip');
    expect(t.matches[m.id]!.tieBreak).toBe('coin-flip');
  });
});

describe('fairness / determinism', () => {
  it('is reproducible for a fixed seed', () => {
    const a = generateTournament(makeSongs(36), { seed: 123, id: 't' });
    const b = generateTournament(makeSongs(36), { seed: 123, id: 't' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different brackets for different seeds', () => {
    const a = generateTournament(makeSongs(36), { seed: 1, id: 't' });
    const b = generateTournament(makeSongs(36), { seed: 2, id: 't' });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('distributes Sudden Death winners across different first-round matches', () => {
    // With 36 songs there are 4 SD winners feeding 16 first-round matches.
    // They should not all land in the same match (no clustering bias).
    const t = generateTournament(makeSongs(36), { seed: 8 });
    const firstMainRound = t.rounds[1]!;
    let matchesContainingSdWinner = 0;
    for (const id of firstMainRound.matchIds) {
      const m = t.matches[id]!;
      const hasSd =
        m.slotA.kind === 'match' || m.slotB.kind === 'match';
      if (hasSd) matchesContainingSdWinner++;
    }
    // 4 winners spread across distinct matches (at least 2 distinct matches).
    expect(matchesContainingSdWinner).toBeGreaterThanOrEqual(2);
  });
});

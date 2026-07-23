import { describe, expect, it } from 'vitest';
import type { Song } from '@/shared/types/song';
import { RoomManager } from '@/features/rooms/server/roomManager';
import { ArchiveError, buildArchivePayload } from './tournamentArchive';

function songs(n: number): Song[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    title: `Song ${i}`,
    artist: `A${i}`,
    source: (i % 2 ? 'youtube' : 'spotify') as Song['source'],
    sourceId: `id${i}`,
    thumbnail: `thumb${i}`,
    duration: 100 + i,
    url: `https://x/${i}`,
  }));
}

/** Build a finished room by playing every match with side A winning. */
function finishedRoom(n: number) {
  const mgr = new RoomManager();
  const { room, participantId: admin } = mgr.createRoom('Alice', 'Grand Prix');
  mgr.addSongs(room.id, admin, songs(n));
  mgr.start(room.id, admin);
  let guard = 0;
  while (mgr.snapshot(room.id).phase === 'in-progress') {
    if (guard++ > n * 4) throw new Error('did not finish');
    mgr.castVote(room.id, admin, 'A');
    mgr.advance(room.id, admin);
  }
  return mgr.getRoom(room.id)!;
}

describe('buildArchivePayload', () => {
  it('refuses to archive a tournament that is not finished', () => {
    const mgr = new RoomManager();
    const { room, participantId } = mgr.createRoom('A');
    mgr.addSongs(room.id, participantId, songs(4));
    mgr.start(room.id, participantId);
    expect(() => buildArchivePayload(mgr.getRoom(room.id)!)).toThrow(ArchiveError);
  });

  it('captures songs, rounds, matches, and champion for a 6-song tournament', () => {
    const room = finishedRoom(6);
    const payload = buildArchivePayload(room);

    // 6 songs → bracket 4, 2 sudden death, total 5 matches (n-1).
    expect(payload.songs).toHaveLength(6);
    expect(payload.tournament.bracketSize).toBe(4);
    expect(payload.tournament.suddenDeathMatches).toBe(2);
    expect(payload.matches).toHaveLength(5);
    expect(payload.tournament.entrantCount).toBe(6);

    // Champion is set and refers to a real song temp id.
    expect(payload.tournament.championTempId).not.toBeNull();
    const tempIds = new Set(payload.songs.map((s) => s.tempId));
    expect(tempIds.has(payload.tournament.championTempId!)).toBe(true);

    // Metadata round-trips.
    const s0 = payload.songs.find((s) => s.tempId === 's0')!;
    expect(s0).toMatchObject({ source: 'spotify', sourceId: 'id0', thumbnail: 'thumb0' });

    // Rounds include the sudden death round.
    expect(payload.rounds.some((r) => r.isSuddenDeath)).toBe(true);
  });

  it('records the tie-break method on a coin-flipped match', () => {
    const mgr = new RoomManager();
    const { room, participantId: admin } = mgr.createRoom('A');
    mgr.addSongs(room.id, admin, songs(2)); // single final match
    mgr.start(room.id, admin);
    mgr.advance(room.id, admin); // 0-0 tie → pending
    mgr.resolveTie(room.id, admin, { method: 'coin-flip' });

    const payload = buildArchivePayload(mgr.getRoom(room.id)!);
    expect(payload.matches).toHaveLength(1);
    expect(payload.matches[0]!.tieBreak).toBe('coin-flip');
  });
});

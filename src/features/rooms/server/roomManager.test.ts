import { beforeEach, describe, expect, it } from 'vitest';
import type { Song } from '@/shared/types/song';
import { RoomError, RoomManager } from './roomManager';

function songs(n: number): Song[] {
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

describe('RoomManager', () => {
  let mgr: RoomManager;
  beforeEach(() => {
    mgr = new RoomManager();
  });

  it('creates a room with a joinable code and an admin', () => {
    const { room, participantId } = mgr.createRoom('Alice', 'My Tourney');
    expect(room.adminId).toBe(participantId);
    expect(room.participants[participantId]!.isAdmin).toBe(true);
    expect(room.code).toMatch(/^[A-Z2-9]{4}$/);
  });

  it('lets a second player join by code (case-insensitive)', () => {
    const { room } = mgr.createRoom('Alice');
    const joined = mgr.joinRoom(room.code.toLowerCase(), 'Bob');
    expect(joined.room.id).toBe(room.id);
    expect(Object.keys(joined.room.participants)).toHaveLength(2);
  });

  it('rejects an unknown join code', () => {
    expect(() => mgr.joinRoom('ZZZZ', 'Nobody')).toThrow(RoomError);
  });

  it('only the admin can add songs and start', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    expect(() => mgr.addSongs(room.id, bob, songs(2))).toThrow(RoomError);
    mgr.addSongs(room.id, admin, songs(4));
    expect(() => mgr.start(room.id, bob)).toThrow(RoomError);
  });

  it('will not start with fewer than two songs', () => {
    const { room, participantId } = mgr.createRoom('Alice');
    mgr.addSongs(room.id, participantId, songs(1));
    expect(() => mgr.start(room.id, participantId)).toThrow(RoomError);
  });

  it('runs a full 4-song tournament via votes to a champion', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.addSongs(room.id, admin, songs(4));
    mgr.start(room.id, admin);

    let guard = 0;
    while (mgr.snapshot(room.id).phase === 'in-progress') {
      if (guard++ > 20) throw new Error('did not finish');
      // Both players vote for side A → clear winner, no tie.
      mgr.castVote(room.id, admin, 'A');
      mgr.castVote(room.id, bob, 'A');
      const { completed } = mgr.advance(room.id, admin);
      expect(completed).not.toBeNull();
    }
    const snap = mgr.snapshot(room.id);
    expect(snap.phase).toBe('finished');
    expect(snap.tournament!.championId).not.toBeNull();
  });

  it('enters a pending-tie state on an even split and resolves by admin choice', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.addSongs(room.id, admin, songs(2)); // single final match
    mgr.start(room.id, admin);

    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'B'); // 1-1 tie
    const { completed } = mgr.advance(room.id, admin);
    expect(completed).toBeNull();
    expect(mgr.snapshot(room.id).awaitingTieBreak).toBe(true);

    // Voting is blocked while a tie is pending.
    expect(() => mgr.castVote(room.id, bob, 'A')).toThrow(RoomError);

    const match = mgr.getRoom(room.id)!.tournament!;
    const chosen = match.matches[match.currentMatchId!]!.songBId!;
    const res = mgr.resolveTie(room.id, admin, { method: 'admin-choice', side: 'B' });
    expect(res.completed.winnerId).toBe(chosen);
    expect(mgr.snapshot(room.id).phase).toBe('finished');
  });

  it('resolves a tie by coin flip to one of the two competitors', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    mgr.addSongs(room.id, admin, songs(2));
    mgr.start(room.id, admin);
    // 0-0 is a tie too.
    mgr.advance(room.id, admin);
    const t = mgr.getRoom(room.id)!.tournament!;
    const m = t.matches[t.currentMatchId!]!;
    const options = [m.songAId, m.songBId];
    const res = mgr.resolveTie(room.id, admin, { method: 'coin-flip' });
    expect(options).toContain(res.completed.winnerId);
  });

  it('promotes a new admin when the admin leaves', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    const after = mgr.leaveRoom(room.id, admin);
    expect(after).not.toBeNull();
    expect(after!.adminId).toBe(bob);
    expect(after!.participants[bob]!.isAdmin).toBe(true);
  });

  it('closes the room when the last participant leaves', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const after = mgr.leaveRoom(room.id, admin);
    expect(after).toBeNull();
    expect(mgr.getRoom(room.id)).toBeUndefined();
  });

  it('configures and validates the vote timer (lobby only)', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    mgr.setVoteTimer(room.id, admin, 30);
    expect(mgr.getRoom(room.id)!.voteDurationSeconds).toBe(30);
    expect(() => mgr.setVoteTimer(room.id, admin, 2)).toThrow(RoomError); // too short
    expect(() => mgr.setVoteTimer(room.id, admin, 9999)).toThrow(RoomError); // too long
    mgr.setVoteTimer(room.id, admin, null); // off
    expect(mgr.getRoom(room.id)!.voteDurationSeconds).toBeNull();
  });

  it('sets a deadline when a timer is configured and clears it on a tie', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.setVoteTimer(room.id, admin, 30);
    mgr.addSongs(room.id, admin, songs(2));
    mgr.start(room.id, admin);
    expect(mgr.snapshot(room.id).deadline).toBeGreaterThan(Date.now());

    // Force a tie → deadline cleared, pending tie set.
    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'B');
    mgr.autoAdvance(room.id);
    expect(mgr.snapshot(room.id).awaitingTieBreak).toBe(true);
    expect(mgr.snapshot(room.id).deadline).toBeNull();
  });

  it('auto-advances by current votes without an admin actor', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.setVoteTimer(room.id, admin, 15);
    mgr.addSongs(room.id, admin, songs(4));
    mgr.start(room.id, admin);
    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'A');
    const { completed } = mgr.autoAdvance(room.id);
    expect(completed).not.toBeNull();
  });

  it('has no deadline when the timer is off', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    mgr.addSongs(room.id, admin, songs(4));
    mgr.start(room.id, admin);
    expect(mgr.snapshot(room.id).deadline).toBeNull();
  });

  it('de-duplicates staged songs', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const list = songs(3);
    mgr.addSongs(room.id, admin, [...list, ...list]); // merge already dedupes
    expect(mgr.getRoom(room.id)!.songs).toHaveLength(3);
  });
});

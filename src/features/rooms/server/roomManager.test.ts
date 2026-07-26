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
      mgr.reveal(room.id, admin); // everyone voted → no force needed
      const { completed } = mgr.next(room.id, admin);
      expect(completed).not.toBeNull();
    }
    const snap = mgr.snapshot(room.id);
    expect(snap.phase).toBe('finished');
    expect(snap.tournament!.championId).not.toBeNull();
  });

  it('reveals votes before advancing; next requires a reveal', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.addSongs(room.id, admin, songs(4));
    mgr.start(room.id, admin);
    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'A');
    // Cannot advance before revealing.
    expect(() => mgr.next(room.id, admin)).toThrow(RoomError);
    mgr.reveal(room.id, admin);
    expect(mgr.snapshot(room.id).revealed).toBe(true);
    const { completed } = mgr.next(room.id, admin);
    expect(completed).not.toBeNull();
  });

  it('blocks reveal until everyone voted unless forced', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    mgr.joinRoom(room.code, 'Bob'); // Bob won't vote
    mgr.addSongs(room.id, admin, songs(4));
    mgr.start(room.id, admin);
    mgr.castVote(room.id, admin, 'A');
    expect(mgr.snapshot(room.id).allVoted).toBe(false);
    expect(() => mgr.reveal(room.id, admin)).toThrow(RoomError); // not all voted
    mgr.reveal(room.id, admin, true); // force
    expect(mgr.snapshot(room.id).revealed).toBe(true);
  });

  it('enters a pending-tie state on an even split and resolves by admin choice', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.addSongs(room.id, admin, songs(2)); // single final match
    mgr.start(room.id, admin);

    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'B'); // 1-1 tie
    mgr.reveal(room.id, admin);
    expect(mgr.snapshot(room.id).awaitingTieBreak).toBe(true);

    // Voting is blocked while revealed / a tie is pending.
    expect(() => mgr.castVote(room.id, bob, 'A')).toThrow(RoomError);
    // next() refuses while tied.
    expect(() => mgr.next(room.id, admin)).toThrow(RoomError);

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
    // 0-0 is a tie too — force reveal since nobody voted.
    mgr.reveal(room.id, admin, true);
    expect(mgr.snapshot(room.id).awaitingTieBreak).toBe(true);
    const t = mgr.getRoom(room.id)!.tournament!;
    const m = t.matches[t.currentMatchId!]!;
    const options = [m.songAId, m.songBId];
    const res = mgr.resolveTie(room.id, admin, { method: 'coin-flip' });
    expect(options).toContain(res.completed.winnerId);
  });

  it('go back un-reveals, then restores the previous match', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.addSongs(room.id, admin, songs(4));
    mgr.start(room.id, admin);
    const firstMatchId = mgr.getRoom(room.id)!.tournament!.currentMatchId!;

    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'A');
    mgr.reveal(room.id, admin);
    // Go back once → un-reveal, still on the same match.
    mgr.goBack(room.id, admin);
    expect(mgr.snapshot(room.id).revealed).toBe(false);
    expect(mgr.getRoom(room.id)!.tournament!.currentMatchId).toBe(firstMatchId);

    // Complete it, then go back → restores the completed match as active again.
    mgr.reveal(room.id, admin);
    mgr.next(room.id, admin);
    expect(mgr.getRoom(room.id)!.tournament!.currentMatchId).not.toBe(firstMatchId);
    mgr.goBack(room.id, admin);
    expect(mgr.getRoom(room.id)!.tournament!.currentMatchId).toBe(firstMatchId);
    expect(mgr.getRoom(room.id)!.tournament!.matches[firstMatchId]!.status).not.toBe('completed');
  });

  it('hides the vote split from participants until revealed', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.addSongs(room.id, admin, songs(2));
    mgr.start(room.id, admin);
    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'A');

    const bobView = mgr.snapshot(room.id, bob);
    expect(bobView.voteTally.hidden).toBe(true);
    expect(bobView.voteTally.a).toBe(0);
    expect(bobView.voteTally.votedCount).toBe(2); // progress still visible

    const adminView = mgr.snapshot(room.id, admin);
    expect(adminView.voteTally.hidden).toBe(false);
    expect(adminView.voteTally.a).toBe(2);

    mgr.reveal(room.id, admin);
    expect(mgr.snapshot(room.id, bob).voteTally.hidden).toBe(false);
    expect(mgr.snapshot(room.id, bob).voteTally.a).toBe(2);
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
    mgr.autoReveal(room.id);
    expect(mgr.snapshot(room.id).awaitingTieBreak).toBe(true);
    expect(mgr.snapshot(room.id).deadline).toBeNull();
  });

  it('auto-reveals (does not complete) when the timer expires', () => {
    const { room, participantId: admin } = mgr.createRoom('Alice');
    const { participantId: bob } = mgr.joinRoom(room.code, 'Bob');
    mgr.setVoteTimer(room.id, admin, 15);
    mgr.addSongs(room.id, admin, songs(4));
    mgr.start(room.id, admin);
    mgr.castVote(room.id, admin, 'A');
    mgr.castVote(room.id, bob, 'A');
    const { revealed } = mgr.autoReveal(room.id);
    expect(revealed).toBe(true);
    expect(mgr.snapshot(room.id).revealed).toBe(true);
    expect(mgr.snapshot(room.id).deadline).toBeNull();
    // The admin still advances at their own pace.
    const { completed } = mgr.next(room.id, admin);
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

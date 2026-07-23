import type { Room } from '@/shared/types/room';
import type { TieBreakMethod } from '@/shared/types/tournament';
import { getPrisma, isPersistenceEnabled } from './prisma';

/**
 * Normalised, DB-agnostic snapshot of a finished room. Built purely from the
 * in-memory state (no I/O) so it can be unit-tested, then written by
 * `archiveRoom`. Song references use the in-memory song id as a temporary key;
 * the writer resolves those to catalogue/join-table ids.
 */
export interface ArchivePayload {
  room: { id: string; code: string; title: string };
  songs: Array<{
    tempId: string;
    source: 'youtube' | 'spotify';
    sourceId: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
    url: string;
  }>;
  participants: Array<{ nickname: string; isAdmin: boolean }>;
  tournament: {
    entrantCount: number;
    bracketSize: number;
    suddenDeathMatches: number;
    championTempId: string | null;
  };
  rounds: Array<{ index: number; name: string; isSuddenDeath: boolean }>;
  matches: Array<{
    roundIndex: number;
    matchIndex: number;
    songATempId: string | null;
    songBTempId: string | null;
    votesA: number;
    votesB: number;
    winnerTempId: string | null;
    tieBreak: TieBreakMethod | null;
  }>;
}

export class ArchiveError extends Error {}

/** Pure: turn a finished room into a normalised archive payload. */
export function buildArchivePayload(room: Room): ArchivePayload {
  const t = room.tournament;
  if (!t) throw new ArchiveError('Room has no tournament to archive.');
  if (t.status !== 'completed') {
    throw new ArchiveError('Only completed tournaments can be archived.');
  }

  return {
    room: { id: room.id, code: room.code, title: t.title },
    songs: Object.values(t.songs).map((s) => ({
      tempId: s.id,
      source: s.source,
      sourceId: s.sourceId,
      title: s.title,
      artist: s.artist,
      thumbnail: s.thumbnail,
      duration: s.duration,
      url: s.url,
    })),
    participants: Object.values(room.participants).map((p) => ({
      nickname: p.nickname,
      isAdmin: p.isAdmin,
    })),
    tournament: {
      entrantCount: t.entrantCount,
      bracketSize: t.bracketSize,
      suddenDeathMatches: t.suddenDeathMatchCount,
      championTempId: t.championId,
    },
    rounds: t.rounds.map((r) => ({
      index: r.index,
      name: r.name,
      isSuddenDeath: r.isSuddenDeath,
    })),
    matches: Object.values(t.matches).map((m) => ({
      roundIndex: m.roundIndex,
      matchIndex: m.matchIndex,
      songATempId: m.songAId,
      songBTempId: m.songBId,
      votesA: m.votesA,
      votesB: m.votesB,
      winnerTempId: m.winnerId,
      tieBreak: m.tieBreak,
    })),
  };
}

const tieBreakToDb: Record<TieBreakMethod, 'coin_flip' | 'admin_choice'> = {
  'coin-flip': 'coin_flip',
  'admin-choice': 'admin_choice',
};

export type ArchiveResult =
  | { persisted: true; roomId: string }
  | { persisted: false; reason: string };

/**
 * Persist a finished room to Postgres. No-op (never throws) when persistence is
 * disabled or the write fails — archiving must never disrupt the live game.
 */
export async function archiveRoom(room: Room): Promise<ArchiveResult> {
  if (!isPersistenceEnabled()) return { persisted: false, reason: 'disabled' };
  const prisma = getPrisma();
  if (!prisma) return { persisted: false, reason: 'disabled' };

  let payload: ArchivePayload;
  try {
    payload = buildArchivePayload(room);
  } catch (err) {
    return { persisted: false, reason: (err as Error).message };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Upsert songs into the global catalogue (dedupe by source+sourceId).
      const songIdByTemp = new Map<string, string>();
      for (const s of payload.songs) {
        const record = await tx.song.upsert({
          where: { source_sourceId: { source: s.source, sourceId: s.sourceId } },
          create: {
            source: s.source,
            sourceId: s.sourceId,
            title: s.title,
            artist: s.artist,
            thumbnail: s.thumbnail,
            duration: s.duration,
            url: s.url,
          },
          update: { title: s.title, artist: s.artist, thumbnail: s.thumbnail },
        });
        songIdByTemp.set(s.tempId, record.id);
      }

      // 2. Room shell (idempotent by id).
      await tx.room.upsert({
        where: { id: payload.room.id },
        create: {
          id: payload.room.id,
          code: payload.room.code,
          title: payload.room.title,
          phase: 'finished',
          finishedAt: new Date(),
        },
        update: { phase: 'finished', finishedAt: new Date() },
      });

      // 3. Roster (join table) — map in-memory song id → TournamentSong id.
      const tsIdByTemp = new Map<string, string>();
      for (const s of payload.songs) {
        const dbSongId = songIdByTemp.get(s.tempId)!;
        const ts = await tx.tournamentSong.upsert({
          where: { roomId_songId: { roomId: payload.room.id, songId: dbSongId } },
          create: { roomId: payload.room.id, songId: dbSongId },
          update: {},
        });
        tsIdByTemp.set(s.tempId, ts.id);
      }

      // 4. Tournament + rounds.
      const tournament = await tx.tournament.upsert({
        where: { roomId: payload.room.id },
        create: {
          roomId: payload.room.id,
          entrantCount: payload.tournament.entrantCount,
          bracketSize: payload.tournament.bracketSize,
          suddenDeathMatches: payload.tournament.suddenDeathMatches,
          championSongId: payload.tournament.championTempId
            ? tsIdByTemp.get(payload.tournament.championTempId)
            : null,
        },
        update: {},
      });

      const roundIdByIndex = new Map<number, string>();
      for (const r of payload.rounds) {
        const round = await tx.round.upsert({
          where: { tournamentId_index: { tournamentId: tournament.id, index: r.index } },
          create: {
            tournamentId: tournament.id,
            index: r.index,
            name: r.name,
            isSuddenDeath: r.isSuddenDeath,
          },
          update: {},
        });
        roundIdByIndex.set(r.index, round.id);
      }

      // 5. Matches.
      for (const m of payload.matches) {
        await tx.match.create({
          data: {
            tournamentId: tournament.id,
            roundId: roundIdByIndex.get(m.roundIndex)!,
            matchIndex: m.matchIndex,
            songAId: m.songATempId ? tsIdByTemp.get(m.songATempId) : null,
            songBId: m.songBTempId ? tsIdByTemp.get(m.songBTempId) : null,
            votesA: m.votesA,
            votesB: m.votesB,
            winnerId: m.winnerTempId ? tsIdByTemp.get(m.winnerTempId) : null,
            tieBreak: m.tieBreak ? tieBreakToDb[m.tieBreak] : null,
          },
        });
      }
    });

    return { persisted: true, roomId: payload.room.id };
  } catch (err) {
    console.error('[archive] failed to persist room:', err);
    return { persisted: false, reason: (err as Error).message };
  }
}

// --------------------------------------------------------------------------
// Read side — powers history & basic statistics.
// --------------------------------------------------------------------------

export interface ArchivedSummary {
  roomId: string;
  title: string;
  code: string;
  finishedAt: string | null;
  entrantCount: number;
  bracketSize: number;
  suddenDeathMatches: number;
  champion: { title: string; artist: string; thumbnail: string } | null;
}

/** Most recently finished tournaments (newest first). */
export async function listArchivedTournaments(limit = 20): Promise<ArchivedSummary[]> {
  const prisma = getPrisma();
  if (!prisma) return [];

  const rooms = await prisma.room.findMany({
    where: { phase: 'finished' },
    orderBy: { finishedAt: 'desc' },
    take: limit,
    include: {
      tournament: {
        include: {
          matches: {
            where: { round: { isSuddenDeath: false } },
            include: { winner: { include: { song: true } } },
          },
        },
      },
    },
  });

  return rooms
    .filter((r) => r.tournament)
    .map((r) => {
      const t = r.tournament!;
      const champTsId = t.championSongId;
      const champMatch = t.matches.find((m) => m.winnerId === champTsId);
      const champSong = champMatch?.winner?.song ?? null;
      return {
        roomId: r.id,
        title: r.title,
        code: r.code,
        finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        entrantCount: t.entrantCount,
        bracketSize: t.bracketSize,
        suddenDeathMatches: t.suddenDeathMatches,
        champion: champSong
          ? { title: champSong.title, artist: champSong.artist, thumbnail: champSong.thumbnail }
          : null,
      };
    });
}

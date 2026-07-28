import { NextResponse } from 'next/server';
import { loadPlaylist } from '@/features/persistence/server/playlistStore';

export const dynamic = 'force-dynamic';

/** Public preview of a saved playlist (name + songs) by its code. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const info = await loadPlaylist(code);
  if (!info) {
    return NextResponse.json({ error: 'Playlist not found.' }, { status: 404 });
  }
  return NextResponse.json({
    code: info.code,
    name: info.name,
    songCount: info.songCount,
    songs: info.songs,
  });
}

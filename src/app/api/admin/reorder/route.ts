import { NextResponse } from 'next/server';
import { reorderPhotos } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { ids?: string[] } | null;
  if (!body || !Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  try {
    const photos = await reorderPhotos(body.ids);
    return NextResponse.json({ photos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'reorder failed' }, { status: 500 });
  }
}

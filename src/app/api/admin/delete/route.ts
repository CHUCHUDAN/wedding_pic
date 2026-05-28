import { NextResponse } from 'next/server';
import { removePhoto } from '@/lib/store';

export const runtime = 'nodejs';

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 });
  try {
    await removePhoto(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'delete failed' }, { status: 500 });
  }
}

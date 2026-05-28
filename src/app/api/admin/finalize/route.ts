import { NextResponse } from 'next/server';
import { addPhotosFromUploaded } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 接收 client upload 完成後的 metadata，一次性寫入索引（原子）
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { uploads?: Array<{ url?: string; pathname?: string }> }
    | null;
  if (!body || !Array.isArray(body.uploads) || body.uploads.length === 0) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const items = body.uploads
    .filter((u): u is { url: string; pathname: string } =>
      !!u && typeof u.url === 'string' && typeof u.pathname === 'string'
    )
    .filter((u) => u.pathname.startsWith('photos/')); // 限制只接受 photos/ 路徑
  if (items.length === 0) {
    return NextResponse.json({ error: 'no valid uploads' }, { status: 400 });
  }
  try {
    const photos = await addPhotosFromUploaded(items);
    return NextResponse.json({ photos });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'finalize failed' }, { status: 500 });
  }
}

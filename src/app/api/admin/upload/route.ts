import { NextResponse } from 'next/server';
import { addPhotos } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const form = await req.formData();
  // 同時支援單檔 (file) 與多檔 (files) 欄位
  const raw = [...form.getAll('files'), ...form.getAll('file')];
  const files = raw.filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  try {
    const photos = await addPhotos(files);
    // 回傳 photos 陣列；同時保留 photo（第一張）讓舊呼叫端相容
    return NextResponse.json({ photos, photo: photos[0] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'upload failed' }, { status: 500 });
  }
}

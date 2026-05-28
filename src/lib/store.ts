import { put, del, list } from '@vercel/blob';

export type Photo = {
  id: string;
  url: string;
  pathname: string;
  width?: number;
  height?: number;
  uploadedAt: number;
};

const INDEX_PATH = 'index/photos.json';

function hasBlobToken(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function requireBlobToken(): void {
  if (!hasBlobToken()) {
    throw new Error(
      '尚未設定 BLOB_READ_WRITE_TOKEN。請在 Vercel 專案 Storage 建立 Blob store，' +
      '或在本機 .env.local 填入 token 後重啟 dev server。'
    );
  }
}

async function findIndexUrl(): Promise<string | null> {
  const { blobs } = await list({ prefix: 'index/' });
  const found = blobs.find((b) => b.pathname === INDEX_PATH);
  return found ? found.url : null;
}

export async function readIndex(): Promise<Photo[]> {
  // 本機尚未設定 Blob token 時，回傳空清單而不是 500
  if (!hasBlobToken()) return [];
  try {
    const url = await findIndexUrl();
    if (!url) return [];
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as Photo[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function writeIndex(photos: Photo[]): Promise<void> {
  requireBlobToken();
  const existingUrl = await findIndexUrl();
  if (existingUrl) {
    try { await del(existingUrl); } catch { /* ignore */ }
  }
  await put(INDEX_PATH, JSON.stringify(photos), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

export async function addPhoto(file: File): Promise<Photo> {
  requireBlobToken();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const pathname = `photos/${id}.${ext}`;
  const blob = await put(pathname, file, {
    access: 'public',
    contentType: file.type || 'image/jpeg',
    addRandomSuffix: false,
  });
  const photo: Photo = {
    id,
    url: blob.url,
    pathname: blob.pathname,
    uploadedAt: Date.now(),
  };
  const list = await readIndex();
  list.unshift(photo);
  await writeIndex(list);
  return photo;
}

export async function removePhoto(id: string): Promise<void> {
  const list = await readIndex();
  const target = list.find((p) => p.id === id);
  if (!target) return;
  try {
    await del(target.url);
  } catch {
    // ignore
  }
  await writeIndex(list.filter((p) => p.id !== id));
}

export async function reorderPhotos(orderedIds: string[]): Promise<Photo[]> {
  const list = await readIndex();
  const map = new Map(list.map((p) => [p.id, p]));
  const next: Photo[] = [];
  for (const id of orderedIds) {
    const p = map.get(id);
    if (p) {
      next.push(p);
      map.delete(id);
    }
  }
  // append any leftover (新上傳但尚未排序的)
  for (const leftover of map.values()) next.push(leftover);
  await writeIndex(next);
  return next;
}

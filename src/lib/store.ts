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

// Module-scope 快取：寫完 index 後直接記住新 URL，避免每次都要靠 list() 找。
// Vercel Blob 的 list() 有 eventual consistency，剛寫完不一定马上看得到最新狀態。
let cachedIndexUrl: string | null = null;

async function findIndexUrl(): Promise<string | null> {
  if (cachedIndexUrl) return cachedIndexUrl;
  const { blobs } = await list({ prefix: 'index/' });
  const found = blobs.find((b) => b.pathname === INDEX_PATH);
  if (found) cachedIndexUrl = found.url;
  return cachedIndexUrl;
}

// Promise.race fallback：只有「顯示用」（SSR）才能啟用，避免使用者本機網路慢時整頁卡 30 秒。
// 寫入流程絕不使用 timeout，否則 readIndex 拿到 [] 會讓 removePhoto / reorderPhotos
// 誤以為「找不到要刪的照片」而 no-op 或把整份 index 蓋空，造成「刪不掉」。
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.finally(() => { if (t) clearTimeout(t); }),
    new Promise<T>((resolve) => {
      t = setTimeout(() => {
        if (typeof window === 'undefined') {
          // eslint-disable-next-line no-console
          console.warn(`[store] ${label} timed out after ${ms}ms — returning fallback (僅顯示用)`);
        }
        resolve(fallback);
      }, ms);
    }),
  ]);
}

export type ReadIndexOptions = {
  /** 超過 ms 仍未完成則回傳空陣列。僅供 SSR 顯示用；mutation 流程請勿傳。 */
  timeoutMs?: number;
};

export async function readIndex(opts: ReadIndexOptions = {}): Promise<Photo[]> {
  if (!hasBlobToken()) return [];
  const work = doReadIndex();
  if (opts.timeoutMs && opts.timeoutMs > 0) {
    return withTimeout(work, opts.timeoutMs, [], 'readIndex');
  }
  return work;
}

async function doReadIndex(): Promise<Photo[]> {
  try {
    const url = await findIndexUrl();
    if (!url) return [];
    const bust = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    const res = await fetch(bust, { cache: 'no-store' });
    if (res.status === 404) {
      // 快取的 URL 失效（被別的程序砸了），清掉重試一次
      cachedIndexUrl = null;
      const fresh = await findIndexUrl();
      if (!fresh) return [];
      const bust2 = `${fresh}${fresh.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const res2 = await fetch(bust2, { cache: 'no-store' });
      if (!res2.ok) return [];
      const data2 = (await res2.json()) as Photo[];
      return Array.isArray(data2) ? data2 : [];
    }
    if (!res.ok) return [];
    const data = (await res.json()) as Photo[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function writeIndex(photos: Photo[]): Promise<void> {
  requireBlobToken();
  // 先 put 新的，再 del 舊的，避免「中間有一段時間 index 不存在」造成讀者 404。
  // 伺服器如果不允許同名覆寫，才退回 del→put。
  const oldUrl = cachedIndexUrl;
  let putUrl: string | null = null;
  try {
    const blob = await put(INDEX_PATH, JSON.stringify(photos), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 0,
    });
    putUrl = blob.url;
    cachedIndexUrl = blob.url;
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/already exists|overwrite|conflict/i.test(msg)) {
      try {
        if (oldUrl) await del(oldUrl);
        else {
          const found = await findIndexUrl();
          if (found) await del(found);
        }
      } catch { /* ignore */ }
      const blob = await put(INDEX_PATH, JSON.stringify(photos), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 0,
      });
      putUrl = blob.url;
      cachedIndexUrl = blob.url;
    } else {
      throw e;
    }
  }
  // 若覆寫後 URL 變了，砸掉舊的（best-effort）
  if (oldUrl && putUrl && oldUrl !== putUrl) {
    try { await del(oldUrl); } catch { /* ignore */ }
  }
}

export async function addPhoto(file: File): Promise<Photo> {
  const [photo] = await addPhotos([file]);
  return photo;
}

export async function addPhotos(files: File[]): Promise<Photo[]> {
  requireBlobToken();
  // 先平行上傳所有檔案到 Blob（不動 index）
  const uploaded = await Promise.all(
    files.map(async (file) => {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      // 用 performance-friendly 但更不易碰撞的 id
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`;
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
      return photo;
    })
  );
  // 一次性讀寫 index，避免多次請求競態
  const list = await readIndex();
  const next = [...uploaded, ...list];
  await writeIndex(next);
  return uploaded;
}

// client upload 完成後，由前端把 metadata 送過來，一次寫入 index
export async function addPhotosFromUploaded(
  items: Array<{ url: string; pathname: string }>
): Promise<Photo[]> {
  requireBlobToken();
  if (items.length === 0) return [];
  const now = Date.now();
  const photos: Photo[] = items.map((u, i) => ({
    id: pathnameToId(u.pathname) || `${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
    url: u.url,
    pathname: u.pathname,
    uploadedAt: now,
  }));
  const list = await readIndex();
  const next = [...photos, ...list];
  await writeIndex(next);
  return photos;
}

function pathnameToId(pathname: string): string {
  // photos/<id>.<ext> 或 photos/<id>-<randomSuffix>.<ext>
  const file = pathname.split('/').pop() || pathname;
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(0, dot) : file;
}

export async function removePhoto(id: string): Promise<boolean> {
  // mutation：一定要拿到真實 list（不能 timeout）；否則會讓「刪不掉」限際情況發生
  const list = await readIndex();
  const target = list.find((p) => p.id === id);
  if (!target) return false;
  try {
    await del(target.url);
  } catch {
    // 圖片實體刪不掉不影響 index 更新
  }
  await writeIndex(list.filter((p) => p.id !== id));
  return true;
}

export async function reorderPhotos(orderedIds: string[]): Promise<Photo[]> {
  const list = await readIndex();
  if (list.length === 0) return [];
  const map = new Map(list.map((p) => [p.id, p]));
  const next: Photo[] = [];
  for (const id of orderedIds) {
    const p = map.get(id);
    if (p) {
      next.push(p);
      map.delete(id);
    }
  }
  // 新上傳但尚未排序的接在後面
  for (const leftover of map.values()) next.push(leftover);
  await writeIndex(next);
  return next;
}

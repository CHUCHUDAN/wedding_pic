'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import type { Photo } from '@/lib/store';

const ACCEPTED = /^image\/(jpe?g|png|webp|gif|avif|heic|heif)$/i;
const SOFT_LIMIT_MB = 30; // 超過僅警告（client upload 支援更大，但會慢）

export default function AdminClient({ initialPhotos }: { initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // 序列化所有會動到 index 的請求，避免並行寫入造成 race（已刪的照片復活、或新上傳消失）
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = mutationQueue.current.then(task, task);
    // 即使前一個失敗也繼續排隊；但不要把 reject 帶到下一個
    mutationQueue.current = next.catch(() => undefined);
    return next;
  }

  function notify(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg });
    setTimeout(() => setFlash(null), 2800);
  }

  async function uploadFiles(files: FileList | File[]) {
    const all = Array.from(files);
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const f of all) {
      if (!ACCEPTED.test(f.type)) {
        rejected.push(`${f.name}（格式不支援）`);
      } else {
        accepted.push(f);
      }
    }
    if (rejected.length > 0) {
      notify('err', `已略過：${rejected.slice(0, 3).join('、')}${rejected.length > 3 ? ' …' : ''}`);
    }
    if (accepted.length === 0) return;
    const oversized = accepted.filter((f) => f.size > SOFT_LIMIT_MB * 1024 * 1024);
    if (oversized.length > 0) {
      const ok = confirm(
        `有 ${oversized.length} 張超過 ${SOFT_LIMIT_MB}MB，可能會上傳較久，確定要繼續嗎？`
      );
      if (!ok) {
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
    }

    setUploading(true);
    setProgress({ done: 0, total: accepted.length });
    try {
      // 1) 透過 Vercel Blob 「client upload」直接從瀏覽器上傳到 Blob
      //    這可繞過 Vercel Serverless function 4.5MB 的 request body 限制
      const uploads: Array<{ url: string; pathname: string }> = [];
      // 為了讓進度可預期且減低瀏覽器併發壓力，採用序列上傳
      for (let i = 0; i < accepted.length; i++) {
        const file = accepted[i];
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeBase = file.name
          .slice(0, file.name.lastIndexOf('.') >= 0 ? file.name.lastIndexOf('.') : file.name.length)
          .replace(/[^a-zA-Z0-9-_]+/g, '-')
          .slice(0, 40) || 'photo';
        // 用「photos/<safeBase>.<ext>」當基本路徑，server 端會自動加 random suffix 防撞名
        const blob = await upload(`photos/${safeBase}.${ext}`, file, {
          access: 'public',
          handleUploadUrl: '/api/admin/upload',
          contentType: file.type || 'image/jpeg',
        });
        uploads.push({ url: blob.url, pathname: blob.pathname });
        setProgress({ done: i + 1, total: accepted.length });
      }

      // 2) 完成後一次性寫入 index（序列化，避免與其它操作 race）
      const res = await enqueue(() =>
        fetch('/api/admin/finalize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ uploads }),
        })
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || '寫入索引失敗');
      }
      const { photos: newOnes } = (await res.json()) as { photos: Photo[] };
      setPhotos((prev) => [...newOnes, ...prev]);
      notify('ok', `已上傳 ${newOnes.length} 張`);
    } catch (e: any) {
      notify('err', e?.message || '上傳失敗');
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDelete(id: string) {
    if (!confirm('確定刪除這張照片？此動作無法復原。')) return;
    const prev = photos;
    setPhotos((p) => p.filter((x) => x.id !== id));
    try {
      const res = await enqueue(() =>
        fetch(`/api/admin/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      );
      if (!res.ok) {
        setPhotos(prev);
        notify('err', '刪除失敗');
      } else {
        notify('ok', '已刪除');
      }
    } catch {
      setPhotos(prev);
      notify('err', '刪除失敗');
    }
  }

  async function persistOrder(next: Photo[]) {
    try {
      const res = await enqueue(() =>
        fetch('/api/admin/reorder', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ids: next.map((p) => p.id) }),
        })
      );
      if (!res.ok) notify('err', '排序儲存失敗');
      else notify('ok', '排序已儲存');
    } catch {
      notify('err', '排序儲存失敗');
    }
  }

  function onDragStart(id: string) { dragId.current = id; }
  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    setOverId(id);
  }
  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = dragId.current;
    dragId.current = null;
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    setPhotos((curr) => {
      const next = [...curr];
      const from = next.findIndex((p) => p.id === sourceId);
      const to = next.findIndex((p) => p.id === targetId);
      if (from < 0 || to < 0) return curr;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistOrder(next);
      return next;
    });
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <h2>後台管理</h2>
        <div className="right">
          <a className="btn" href="/" target="_blank">查看網站 ↗</a>
          <button className="btn" onClick={logout}>登出</button>
        </div>
      </div>

      <div className="admin-content">
        {flash && <div className={`flash ${flash.kind}`}>{flash.msg}</div>}

        <label
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          {uploading ? (
            <>
              {progress
                ? `上傳中… ${progress.done} / ${progress.total}`
                : '上傳中…請稍候'}
            </>
          ) : (
            <>
              <div style={{ fontSize: 18, marginBottom: 6 }}>📸 點此或拖曳照片到這裡上傳</div>
              <div style={{ fontSize: 13 }}>支援多張同時上傳，建議單張不超過 {SOFT_LIMIT_MB}MB</div>
            </>
          )}
        </label>

        <div style={{ marginBottom: 12, color: 'var(--ink-soft)', fontSize: 14 }}>
          目前共 {photos.length} 張 · 拖曳卡片可調整顯示順序（前面的會先出現）
        </div>

        <div className="admin-grid">
          {photos.map((p, i) => (
            <div
              key={p.id}
              className={`admin-card ${overId === p.id ? 'over' : ''}`}
              draggable
              onDragStart={() => onDragStart(p.id)}
              onDragOver={(e) => onDragOver(e, p.id)}
              onDrop={(e) => onDrop(e, p.id)}
              onDragEnd={() => { dragId.current = null; setOverId(null); }}
            >
              <div className="thumb-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" />
              </div>
              <div className="actions">
                <span className="order">#{i + 1}</span>
                <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => onDelete(p.id)}>刪除</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

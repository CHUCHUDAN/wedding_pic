'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Photo } from '@/lib/store';

export default function AdminClient({ initialPhotos }: { initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const dragId = useRef<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function notify(kind: 'ok' | 'err', msg: string) {
    setFlash({ kind, msg });
    setTimeout(() => setFlash(null), 2800);
  }

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const newOnes: Photo[] = [];
      for (const file of arr) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || '上傳失敗');
        }
        const { photo } = (await res.json()) as { photo: Photo };
        newOnes.push(photo);
      }
      setPhotos((prev) => [...newOnes, ...prev]);
      notify('ok', `已上傳 ${newOnes.length} 張`);
    } catch (e: any) {
      notify('err', e?.message || '上傳失敗');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onDelete(id: string) {
    if (!confirm('確定刪除這張照片？此動作無法復原。')) return;
    const prev = photos;
    setPhotos((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/admin/delete?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      setPhotos(prev);
      notify('err', '刪除失敗');
    } else {
      notify('ok', '已刪除');
    }
  }

  async function persistOrder(next: Photo[]) {
    const res = await fetch('/api/admin/reorder', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: next.map((p) => p.id) }),
    });
    if (!res.ok) notify('err', '排序儲存失敗');
    else notify('ok', '排序已儲存');
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
            <>上傳中…請稍候</>
          ) : (
            <>
              <div style={{ fontSize: 18, marginBottom: 6 }}>📸 點此或拖曳照片到這裡上傳</div>
              <div style={{ fontSize: 13 }}>支援多張同時上傳，建議單張不超過 10MB</div>
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

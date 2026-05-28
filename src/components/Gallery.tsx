'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Photo } from '@/lib/store';

export default function Gallery({ photos }: { photos: Photo[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const close = useCallback(() => setOpenIdx(null), []);
  const prev = useCallback(() => {
    setOpenIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);
  const next = useCallback(() => {
    setOpenIdx((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [openIdx, close, prev, next]);

  return (
    <>
      <div className="gallery">
        {photos.map((p, idx) => (
          <button
            key={p.id}
            className="thumb"
            onClick={() => setOpenIdx(idx)}
            aria-label="放大照片"
            style={{ border: 'none', padding: 0 }}
          >
            {/* 使用原生 img 以避免 next/image 對未知尺寸的限制 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="婚紗照片" loading="lazy" />
          </button>
        ))}
      </div>

      {openIdx !== null && (
        <div className="lightbox" onClick={close} role="dialog" aria-modal="true">
          <button className="close" onClick={close} aria-label="關閉">✕</button>
          {photos.length > 1 && (
            <>
              <button
                className="nav prev"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="上一張"
              >‹</button>
              <button
                className="nav next"
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="下一張"
              >›</button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[openIdx].url}
            alt="放大照片"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="counter">{openIdx + 1} / {photos.length}</div>
        </div>
      )}
    </>
  );
}

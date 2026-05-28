import Link from 'next/link';
import { readIndex } from '@/lib/store';
import Gallery from '@/components/Gallery';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  // 顯示用：超過 15 秒未拿到就先顯空相簿，避免使用者一直看到「轉圈」
const photos = await readIndex({ timeoutMs: 15000 });
  const totalPages = Math.max(1, Math.ceil(photos.length / PAGE_SIZE));
  const pageRaw = parseInt(searchParams.page || '1', 10);
  const page = Math.min(Math.max(1, isNaN(pageRaw) ? 1 : pageRaw), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pagePhotos = photos.slice(start, start + PAGE_SIZE);

  return (
    <main>
      <section className="hero">
        <div className="eyebrow">Our Wedding Album</div>
        <h1>我們的婚紗故事</h1>
        <div className="divider" />
        <p>感謝每一位見證我們愛情的你，願這些瞬間，永遠如初見般動人。</p>
      </section>

      <div className="container">
        {photos.length === 0 ? (
          <div className="empty">— 照片即將上線 —</div>
        ) : (
          <>
            <Gallery photos={pagePhotos} />
            <Pager page={page} totalPages={totalPages} />
          </>
        )}
      </div>

      <footer className="footer">
        © {new Date().getFullYear()} · Made with love
        <span style={{ margin: '0 10px', opacity: .4 }}>·</span>
        <Link href="/admin" style={{ opacity: .55 }}>Admin</Link>
      </footer>
    </main>
  );
}

function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  return (
    <nav className="pager" aria-label="Pagination">
      <Link className={page === 1 ? 'disabled' : ''} href={`/?page=${page - 1}`}>‹</Link>
      {pages.map((p) =>
        p === page ? (
          <span key={p} className="current">{p}</span>
        ) : (
          <Link key={p} href={`/?page=${p}`}>{p}</Link>
        )
      )}
      <Link className={page === totalPages ? 'disabled' : ''} href={`/?page=${page + 1}`}>›</Link>
    </nav>
  );
}

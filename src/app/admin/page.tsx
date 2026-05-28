import { readIndex } from '@/lib/store';
import AdminClient from '@/components/AdminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminPage() {
  // 顯示用：超過 15 秒未拿到先給空。使用者仍可上傳、之後重整理就會看到。
  const photos = await readIndex({ timeoutMs: 15000 });
  return <AdminClient initialPhotos={photos} />;
}

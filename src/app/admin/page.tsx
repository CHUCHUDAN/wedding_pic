import { readIndex } from '@/lib/store';
import AdminClient from '@/components/AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const photos = await readIndex();
  return <AdminClient initialPhotos={photos} />;
}

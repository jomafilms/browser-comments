import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/auth-server';
import { countOrphanComments } from '@/lib/db';
import AdminDashboard from './AdminDashboard';

// Admin home — session-gated. No valid owner session → bounce to the login /
// create-owner page. Replaces the old `/?admin=SECRET` panel.
export default async function AdminPage() {
  const session = await getServerSession(await headers());
  if (!session) redirect('/admin/login');

  // Orphan tickets (no project) are invisible to every client link — surface
  // a count so legacy data can't silently disappear. Server-side query; the
  // check stays out of any API shape.
  const orphanCount = await countOrphanComments().catch(() => 0);

  return <AdminDashboard ownerEmail={session.user.email} orphanCount={orphanCount} />;
}

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession } from '@/lib/auth-server';
import AdminDashboard from './AdminDashboard';

// Admin home — session-gated. No valid owner session → bounce to the login /
// create-owner page. Replaces the old `/?admin=SECRET` panel.
export default async function AdminPage() {
  const session = await getServerSession(await headers());
  if (!session) redirect('/admin/login');

  return <AdminDashboard ownerEmail={session.user.email} />;
}

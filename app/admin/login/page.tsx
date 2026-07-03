import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getServerSession, ownerExists } from '@/lib/auth-server';
import AuthForm from '../AuthForm';

// Owner login. First run (no owner yet) shows a "create owner account" form —
// the single bootstrap signup, after which signup is closed. If already signed
// in, skip straight to the dashboard.
export default async function LoginPage() {
  const session = await getServerSession(await headers());
  if (session) redirect('/admin');

  const hasOwner = await ownerExists();
  return <AuthForm mode={hasOwner ? 'login' : 'create'} />;
}

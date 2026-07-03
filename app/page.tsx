import { redirect } from 'next/navigation';

// The admin panel moved to /admin (behind a real owner login). `/` is a stub
// redirect for now; the landing-page lane replaces this root with a real
// marketing/install landing page.
export default function Home() {
  redirect('/admin');
}

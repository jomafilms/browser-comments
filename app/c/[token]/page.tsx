import { redirect } from 'next/navigation';

// The magic link lands on the Comments dashboard — never the capture canvas.
// (Capture is an explicit ＋ Capture action in the header.) Invalid tokens are
// handled by the comments page itself.
export default async function ClientPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/c/${token}/comments`);
}

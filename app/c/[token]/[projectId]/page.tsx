import { redirect } from 'next/navigation';

// Legacy capture URL: /c/{token}/{projectId} predates the /capture segment and
// lives in old bookmarks — keep it working forever by forwarding to the
// canonical route. (Named siblings like /comments win over this dynamic
// segment, so only real project ids land here.)
export default async function LegacyCaptureRedirect({
  params,
}: {
  params: Promise<{ token: string; projectId: string }>;
}) {
  const { token, projectId } = await params;
  redirect(`/c/${token}/capture/${projectId}`);
}

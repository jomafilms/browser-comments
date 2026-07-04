import { headers } from 'next/headers';
import { buildLlmsBlock } from '../_landing/constants';

// Serve the agent-integration block at /llms.txt so a coding agent can fetch it
// directly and self-configure. We resolve the API base from the request so the
// served block points at THIS instance's real origin, not a placeholder.
export const dynamic = 'force-dynamic';

export async function GET() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'your-instance.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;

  return new Response(buildLlmsBlock(origin) + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

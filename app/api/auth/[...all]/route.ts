import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth-server';
import { ensureSchema } from '@/lib/db';

// Better Auth's catch-all handler (sign-in, sign-up, sign-out, session, ...).
// ensureSchema() runs first so the auth tables exist on a fresh zero-config
// deploy before Better Auth issues its first query.
const handlers = toNextJsHandler(auth);

export async function GET(request: Request) {
  await ensureSchema();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  await ensureSchema();
  return handlers.POST(request);
}

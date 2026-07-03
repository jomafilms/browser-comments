import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { pool, withClient, ensureSchema } from '@/lib/db';

// Better Auth — the owner's real login for the admin surface. Email + password,
// a single self-hosted owner account, sessions in Postgres. Reuses the existing
// pg pool (no second connection) — Better Auth wraps it with Kysely internally.
//
// This is separate from lib/auth.ts (request auth helpers): that file swaps its
// requireAdmin internals to accept EITHER a session from here OR the legacy
// ADMIN_SECRET bearer. Client magic-link tokens and agent API tokens are
// untouched — they never go through Better Auth.
export const auth = betterAuth({
  database: pool,
  // BETTER_AUTH_SECRET / BETTER_AUTH_URL are auto-read from env; passed
  // explicitly for clarity. Set BETTER_AUTH_SECRET in prod — without it Better
  // Auth falls back to a generated secret (with a warning) that changes per
  // cold start, which invalidates sessions. See .env.example.
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // sliding: refresh once per day of use
  },
  hooks: {
    // Single-owner instance: allow the FIRST sign-up (bootstrap), reject every
    // one after. There is no public signup path — the create-owner form calls
    // the same endpoint, so this hook is the one gate. disableSignUp is NOT
    // used because it would also block this bootstrap signup.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/sign-up/email') return;
      if (await ownerExists()) {
        throw new APIError('FORBIDDEN', {
          message: 'Sign-up is disabled. This instance already has an owner.',
        });
      }
    }),
  },
  // nextCookies() MUST be last — it flushes Set-Cookie from server actions.
  plugins: [nextCookies()],
});

// Does the instance already have an owner? Backs the first-run create-owner UI
// and the single-owner signup gate. withClient ensures the schema exists first.
export async function ownerExists(): Promise<boolean> {
  return withClient(async (client) => {
    const result = await client.query('SELECT 1 FROM "user" LIMIT 1');
    return result.rows.length > 0;
  });
}

// Server-side session lookup for admin server components / guards. Ensures the
// auth tables exist before the first query on a fresh self-hosted deploy.
export async function getServerSession(headers: Headers) {
  await ensureSchema();
  return auth.api.getSession({ headers });
}

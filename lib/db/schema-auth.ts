import { PoolClient } from 'pg';

// Better Auth tables (owner login for the admin surface). This is the exact DDL
// emitted by `npx @better-auth/cli generate` against lib/auth-server.ts for
// better-auth 1.6.x, made idempotent (IF NOT EXISTS) so it runs safely on a
// blank DB or an existing install. Better Auth owns these tables at runtime;
// we only create them here so `npm run init-db` / the lazy fallback provision
// them for self-hosters without a separate migrate step.
//
// Keep in sync with better-auth: after adding a plugin or upgrading, re-run
//   npx @better-auth/cli generate --config lib/auth-server.ts
// and fold any new tables/columns in here (still additive, still idempotent).
export async function applyAuthSchema(client: PoolClient): Promise<void> {
  // "user" is a reserved word in Postgres — always double-quoted.
  await client.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      "id" text NOT NULL PRIMARY KEY,
      "name" text NOT NULL,
      "email" text NOT NULL UNIQUE,
      "emailVerified" boolean NOT NULL,
      "image" text,
      "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "id" text NOT NULL PRIMARY KEY,
      "expiresAt" timestamptz NOT NULL,
      "token" text NOT NULL UNIQUE,
      "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updatedAt" timestamptz NOT NULL,
      "ipAddress" text,
      "userAgent" text,
      "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "account" (
      "id" text NOT NULL PRIMARY KEY,
      "accountId" text NOT NULL,
      "providerId" text NOT NULL,
      "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
      "accessToken" text,
      "refreshToken" text,
      "idToken" text,
      "accessTokenExpiresAt" timestamptz,
      "refreshTokenExpiresAt" timestamptz,
      "scope" text,
      "password" text,
      "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updatedAt" timestamptz NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "verification" (
      "id" text NOT NULL PRIMARY KEY,
      "identifier" text NOT NULL,
      "value" text NOT NULL,
      "expiresAt" timestamptz NOT NULL,
      "createdAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updatedAt" timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
    CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
    CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
  `);
}

import { Pool, PoolClient } from 'pg';
import { randomBytes } from 'crypto';
import { ensureSchema } from './schema';

// For local development, use standard pg Pool
// For production with Neon, use @neondatabase/serverless
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Run a query function with a pooled client, releasing it afterwards.
// Also lazily initializes the schema (memoized — one real check per cold
// start), which is what keeps a fresh deploy zero-config: the first request
// builds the schema, `npm run init-db` is the canonical explicit runner.
export async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export function generateToken(): string {
  return randomBytes(16).toString('hex');
}

export default pool;

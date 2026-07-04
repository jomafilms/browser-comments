// Back-compat facade over lib/db/* — every pre-split import keeps working.
// New code can import from here too; the split modules are an internal layout.
//
// Schema migrations run via `npm run init-db` (canonical) or lazily on the
// first withClient() call per cold start (zero-config fallback for fresh
// deploys). See lib/db/schema.ts.

export * from './db/types';
export * from './db/refs';
export { pool, withClient, generateToken } from './db/pool';
export { initDB, ensureSchema } from './db/schema';
export * from './db/comments';
export * from './db/comments-write';
export * from './db/clients';
export * from './db/projects';
export * from './db/decisions';
export * from './db/assignees';
export * from './db/branding';
export * from './db/webhooks';
export * from './db/notifications';

export { default } from './db/pool';

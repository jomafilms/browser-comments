import { randomBytes } from 'crypto';
import { withClient } from './pool';
import { TokenContext, Webhook, WebhookEvent } from './types';

// 32 random bytes → 64 hex chars. This is the HMAC signing key handed to the
// webhook consumer once at creation; we store it plain (it is not a password).
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

export async function createWebhook(data: {
  clientId: number;
  projectId: number | null;
  url: string;
  events: WebhookEvent[];
}): Promise<Webhook> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `INSERT INTO webhooks (client_id, project_id, url, secret, events)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.clientId, data.projectId, data.url, generateWebhookSecret(), data.events]
    );
    return result.rows[0];
  });
}

// Webhooks visible to a token. A project token sees only its project's hooks;
// a client token sees every hook under the client (project-specific + all-project).
export async function listWebhooksByContext(ctx: TokenContext): Promise<Webhook[]> {
  return withClient(async (dbClient) => {
    const result = ctx.projectId
      ? await dbClient.query(
          `SELECT * FROM webhooks WHERE project_id = $1 ORDER BY created_at DESC`,
          [ctx.projectId]
        )
      : await dbClient.query(
          `SELECT * FROM webhooks WHERE client_id = $1 ORDER BY created_at DESC`,
          [ctx.clientId]
        );
    return result.rows;
  });
}

export async function listAllWebhooks(): Promise<Webhook[]> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM webhooks ORDER BY created_at DESC`);
    return result.rows;
  });
}

export async function getWebhookById(id: number): Promise<Webhook | null> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(`SELECT * FROM webhooks WHERE id = $1`, [id]);
    return result.rows[0] || null;
  });
}

// A token owns a webhook when it is in the token's scope (project or client).
export async function verifyWebhookScope(ctx: TokenContext, id: number): Promise<boolean> {
  if (!Number.isInteger(id)) return false;
  const hook = await getWebhookById(id);
  if (!hook) return false;
  return ctx.projectId ? hook.project_id === ctx.projectId : hook.client_id === ctx.clientId;
}

export async function deleteWebhook(id: number): Promise<void> {
  await withClient((dbClient) => dbClient.query(`DELETE FROM webhooks WHERE id = $1`, [id]));
}

// Active hooks that should receive `event` for a comment in (clientId, projectId).
// A null project_id hook fires for every project under the client.
export async function getWebhooksForDelivery(
  clientId: number,
  projectId: number | null,
  event: WebhookEvent
): Promise<Webhook[]> {
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `SELECT * FROM webhooks
       WHERE active = TRUE
         AND client_id = $1
         AND (project_id IS NULL OR project_id = $2)
         AND $3 = ANY(events)`,
      [clientId, projectId, event]
    );
    return result.rows;
  });
}

// Record the outcome of a delivery attempt (status 0 = network error/timeout).
export async function recordWebhookDelivery(id: number, status: number): Promise<void> {
  await withClient((dbClient) =>
    dbClient.query(
      `UPDATE webhooks SET last_status = $1, last_fired_at = NOW() WHERE id = $2`,
      [status, id]
    )
  );
}

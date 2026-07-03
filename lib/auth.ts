import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { withClient, resolveToken, TokenContext, verifyCommentOwnershipByContext } from '@/lib/db';
import { auth } from '@/lib/auth-server';

// Single home for request authentication. Routes only ever call these helpers.
// Admin auth accepts EITHER a Better Auth owner session (the /admin login) OR
// the legacy ADMIN_SECRET bearer (deprecated break-glass / back-compat). Client
// magic-link tokens and agent API tokens are unrelated and untouched.

export type AuthResult =
  | { ok: true; ctx: TokenContext }
  | { ok: false; response: NextResponse };

// Token can arrive as `Authorization: Bearer <token>`, in the JSON body, or as
// `?token=` (kept for magic links — deprecated for API clients, not removed).
export function extractToken(request: NextRequest, bodyToken?: unknown): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  if (typeof bodyToken === 'string' && bodyToken.length > 0) return bodyToken;
  return new URL(request.url).searchParams.get('token');
}

export async function requireToken(request: NextRequest, bodyToken?: unknown): Promise<AuthResult> {
  const token = extractToken(request, bodyToken);
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Token required' }, { status: 401 }) };
  }
  const ctx = await resolveToken(token);
  if (!ctx) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }
  return { ok: true, ctx };
}

// Timing-safe string compare — hash both sides to equalize length first.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Does the request carry the legacy admin secret?
// `Authorization: Bearer <ADMIN_SECRET>` is the supported header; `?admin=` is
// still accepted for backwards compatibility (deprecated — secrets in URLs leak
// via logs and referers). Deprecated in favor of the owner session below.
function hasLegacyAdminSecret(request: NextRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;

  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ') && safeEqual(header.slice(7), adminSecret)) return true;

  const legacy = new URL(request.url).searchParams.get('admin');
  return legacy !== null && safeEqual(legacy, adminSecret);
}

// Is there a valid Better Auth owner session on this request?
async function hasOwnerSession(request: NextRequest): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    return !!session;
  } catch {
    return false;
  }
}

// Admin = a real owner session OR the legacy secret. Checks the secret first
// (a cheap, in-process compare) before the session lookup (a DB round trip).
export async function isAdmin(request: NextRequest): Promise<boolean> {
  if (hasLegacyAdminSecret(request)) return true;
  return hasOwnerSession(request);
}

// Returns null when authorized, or the 401 response to send back.
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (await isAdmin(request)) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// --- Ownership checks: does this token context own the resource? ---

export async function verifyProjectScope(ctx: TokenContext, projectId: number): Promise<boolean> {
  if (!Number.isInteger(projectId)) return false;
  if (ctx.projectId) return ctx.projectId === projectId;
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      'SELECT id FROM projects WHERE id = $1 AND client_id = $2',
      [projectId, ctx.clientId]
    );
    return result.rows.length > 0;
  });
}

export async function verifyCommentScope(ctx: TokenContext, commentId: number): Promise<boolean> {
  if (!Number.isInteger(commentId)) return false;
  return verifyCommentOwnershipByContext(ctx, commentId);
}

// All comment ids must belong to the token's scope.
export async function verifyCommentsScope(ctx: TokenContext, commentIds: number[]): Promise<boolean> {
  if (commentIds.length === 0 || !commentIds.every(Number.isInteger)) return false;
  return withClient(async (dbClient) => {
    const result = ctx.projectId
      ? await dbClient.query(
          'SELECT COUNT(*)::int AS n FROM comments WHERE id = ANY($1) AND project_id = $2',
          [commentIds, ctx.projectId]
        )
      : await dbClient.query(
          `SELECT COUNT(*)::int AS n FROM comments c
           JOIN projects p ON c.project_id = p.id
           WHERE c.id = ANY($1) AND p.client_id = $2`,
          [commentIds, ctx.clientId]
        );
    return result.rows[0].n === new Set(commentIds).size;
  });
}

// A decision is in scope via its own project_id, or via its linked comment's
// project. Orphan decisions (neither) are invisible to token reads, so deny.
export async function verifyDecisionScope(ctx: TokenContext, decisionId: number): Promise<boolean> {
  if (!Number.isInteger(decisionId)) return false;
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      `SELECT d.id FROM decision_items d
       LEFT JOIN comments c ON d.comment_id = c.id
       JOIN projects p ON COALESCE(d.project_id, c.project_id) = p.id
       WHERE d.id = $1 AND p.client_id = $2 AND ($3::int IS NULL OR p.id = $3)`,
      [decisionId, ctx.clientId, ctx.projectId]
    );
    return result.rows.length > 0;
  });
}

// Assignees are client-level — any token under the client may manage them.
export async function verifyAssigneeScope(ctx: TokenContext, assigneeId: number): Promise<boolean> {
  if (!Number.isInteger(assigneeId)) return false;
  return withClient(async (dbClient) => {
    const result = await dbClient.query(
      'SELECT id FROM assignees WHERE id = $1 AND client_id = $2',
      [assigneeId, ctx.clientId]
    );
    return result.rows.length > 0;
  });
}

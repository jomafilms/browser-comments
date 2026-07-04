import { after } from 'next/server';
import { Comment, Project, WebhookEvent } from './db/types';
import {
  getClientById,
  getProjectById,
  getWebhooksForDelivery,
  recordWebhookDelivery,
} from './db';
import { deliverWebhook } from './webhook-delivery';
import { notifyEmailCommentCreated, notifyEmailCommentResolved } from './email-notify';

// The single notification fan-out. Both write paths (POST /api/comments,
// POST /api/widget) call onCommentCreated; the PATCH path calls
// onCommentUpdated. Everything runs via after() so it never adds latency to
// the widget/API response (Vercel Fluid keeps the function alive to finish it).
//
// This is intentionally channel-shaped: today the only channel is webhooks, but
// the later email lane hangs its channel here without touching the call sites.

// What changed on an update, for the payload + for gating which updates notify.
export interface CommentChange {
  field: 'status' | 'assignee';
  from?: string | null;
  to?: string | null;
}

// Sanitized comment for outbound payloads: stable external ids (uuid/ref),
// the feedback itself, and metadata — never image_data, never the serial db id.
function serializeComment(comment: Comment, project: Project | null) {
  return {
    uuid: comment.uuid,
    ref: comment.ref,
    display_number: comment.display_number,
    url: comment.url,
    page_section: comment.page_section,
    status: comment.status,
    priority: comment.priority,
    priority_number: comment.priority_number,
    assignee: comment.assignee,
    submitter_name: comment.submitter_name,
    text_annotations: comment.text_annotations,
    device_category: comment.device_category,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    project: project
      ? { id: project.id, name: project.name, ref_prefix: project.ref_prefix }
      : null,
  };
}

async function dispatch(
  event: WebhookEvent,
  comment: Comment,
  baseUrl: string,
  change?: CommentChange
): Promise<void> {
  if (comment.client_id == null) return; // orphan comment — nothing to scope to

  const hooks = await getWebhooksForDelivery(comment.client_id, comment.project_id, event);
  if (hooks.length === 0) return;

  const project = comment.project_id ? await getProjectById(comment.project_id) : null;
  const client = await getClientById(comment.client_id);
  const data = serializeComment(comment, project);
  const timestamp = new Date().toISOString();
  const ticketRef = comment.ref ?? comment.display_number;
  // Prefer a trusted canonical URL over the request Host (which a comment
  // submitter could spoof, since the widget key is public).
  const base = process.env.WEBHOOK_BASE_URL || baseUrl;

  await Promise.all(
    hooks.map(async (hook) => {
      // Dashboard deep-link uses the token that owns the hook's scope; the
      // recipient already holds that token (they registered the hook with it).
      const token = hook.project_id ? project?.token : client?.token;
      const links = {
        api: `${base}/api/comments/${comment.uuid}`,
        dashboard: token ? `${base}/c/${token}/comments?c=${ticketRef}` : null,
      };
      const payload = { event, timestamp, data, ...(change ? { change } : {}), links };
      const status = await deliverWebhook(hook.url, hook.secret, event, JSON.stringify(payload));
      await recordWebhookDelivery(hook.id, status);
    })
  );
}

// Fire-and-forget: schedule after the response is sent. Errors are swallowed so
// a bad webhook target (or mail outage) never surfaces as a 500 on the write
// path. Webhooks and email are independent channels — one failing never blocks
// the other.
export function onCommentCreated(comment: Comment, baseUrl: string): void {
  after(() => dispatch('comment.created', comment, baseUrl).catch((err) => {
    console.error('webhook comment.created dispatch failed:', err);
  }));
  after(() => notifyEmailCommentCreated(comment, baseUrl).catch((err) => {
    console.error('email comment.created dispatch failed:', err);
  }));
}

export function onCommentUpdated(comment: Comment, change: CommentChange, baseUrl: string): void {
  after(() => dispatch('comment.updated', comment, baseUrl, change).catch((err) => {
    console.error('webhook comment.updated dispatch failed:', err);
  }));
  // Resolved notice fires only on a real open→resolved transition.
  if (change.field === 'status' && change.to === 'resolved') {
    after(() => notifyEmailCommentResolved(comment, baseUrl).catch((err) => {
      console.error('email comment.resolved dispatch failed:', err);
    }));
  }
}

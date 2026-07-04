import { Comment } from './db/types';
import { getClientById, getProjectById, resolveBranding, getNotificationSettings } from './db';
import { emailEnabled, emailLinkBase, sendEmail } from './email';
import { instantEmail, resolvedEmail, pausedEmail } from './email-templates';

// The email notification channel. Hung off lib/notify.ts's after() hooks
// alongside webhooks, so it never adds latency to the write path and a mail
// outage can never surface as a 500. All sends are opt-in per client.

function dashboardLink(base: string, token: string | null, ref: string): string {
  return token ? `${base}/c/${token}/comments?c=${encodeURIComponent(ref)}` : base;
}

// The widget captures feedback as text annotations; join them into a readable note.
function commentNote(comment: Comment): string | null {
  const parts = (comment.text_annotations || []).map((a) => a.text).filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// --- Instant new-ticket cap: bound per-client email volume ---
// In-memory, per-instance best-effort (same caveat as lib/rate-limit.ts). A
// burst above the cap folds into a single "paused" notice, then drops for the
// rest of the hour — the dashboard/polling is the real safety net.
const INSTANT_CAP = parseInt(process.env.EMAIL_INSTANT_CAP_PER_HOUR || '20', 10);
const HOUR_MS = 60 * 60 * 1000;
type Counter = { count: number; windowStart: number };
const instantCounters = new Map<number, Counter>();

function instantVerdict(clientId: number): 'send' | 'pause-notice' | 'drop' {
  const now = Date.now();
  const c = instantCounters.get(clientId);
  if (!c || now - c.windowStart >= HOUR_MS) {
    instantCounters.set(clientId, { count: 1, windowStart: now });
    return 'send';
  }
  c.count++;
  if (c.count <= INSTANT_CAP) return 'send';
  if (c.count === INSTANT_CAP + 1) return 'pause-notice'; // one heads-up, then silence
  return 'drop';
}

const ref = (comment: Comment): string => comment.ref ?? String(comment.display_number);

// New ticket → instant email, if the client opted into 'instant'.
export async function notifyEmailCommentCreated(comment: Comment, baseUrl: string): Promise<void> {
  if (!emailEnabled() || comment.client_id == null) return;

  const settings = await getNotificationSettings(comment.client_id);
  if (settings.newTicket !== 'instant' || settings.recipients.length === 0) return;

  const verdict = instantVerdict(comment.client_id);
  if (verdict === 'drop') return;

  const client = await getClientById(comment.client_id);
  if (!client) return;
  const branding = await resolveBranding(comment.project_id, comment.client_id);
  const base = emailLinkBase(baseUrl);
  const dashboardUrl = dashboardLink(base, client.token, ref(comment));

  if (verdict === 'pause-notice') {
    const { subject, html, text } = pausedEmail({ branding, cap: INSTANT_CAP, dashboardUrl });
    await sendEmail({ to: settings.recipients, subject, html, text });
    return;
  }

  const project = comment.project_id ? await getProjectById(comment.project_id) : null;
  const { subject, html, text } = instantEmail({
    branding,
    ref: ref(comment),
    projectName: project?.name ?? null,
    pageSection: comment.page_section,
    submitterName: comment.submitter_name,
    comment: commentNote(comment),
    dashboardUrl,
  });
  await sendEmail({ to: settings.recipients, subject, html, text });
}

// Ticket resolved → notice to the recipients list, if opted in. (The widget
// captures no submitter email, so we notify the client's recipients.)
export async function notifyEmailCommentResolved(comment: Comment, baseUrl: string): Promise<void> {
  if (!emailEnabled() || comment.client_id == null) return;

  const settings = await getNotificationSettings(comment.client_id);
  if (!settings.resolvedNotice || settings.recipients.length === 0) return;

  const client = await getClientById(comment.client_id);
  if (!client) return;
  const branding = await resolveBranding(comment.project_id, comment.client_id);
  const project = comment.project_id ? await getProjectById(comment.project_id) : null;
  const dashboardUrl = dashboardLink(emailLinkBase(baseUrl), client.token, ref(comment));

  const { subject, html, text } = resolvedEmail({
    branding,
    ref: ref(comment),
    projectName: project?.name ?? null,
    pageSection: comment.page_section,
    dashboardUrl,
  });
  await sendEmail({ to: settings.recipients, subject, html, text });
}

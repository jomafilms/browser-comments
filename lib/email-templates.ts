import { Branding } from './db/types';

// Hand-rolled HTML email templates (no React Email dependency — one file, easy
// to read). Plain and readable, no marketing chrome, no tracking pixels. Header
// and footer come from the operator's resolved branding, so the mail wears the
// self-hoster's brand, not browser-comments'.

// Escape untrusted text before interpolating into HTML.
function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CONTAINER =
  'max-width:560px;margin:0 auto;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2937;';
const MUTED = 'color:#6b7280;font-size:13px;';
const BUTTON =
  'display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;';

function header(branding: Branding): string {
  if (branding.logoUrl) {
    return `<img src="${esc(branding.logoUrl)}" alt="${esc(branding.companyName || 'Logo')}" style="max-height:40px;margin-bottom:16px;" />`;
  }
  const name = branding.companyName || 'Feedback';
  return `<div style="font-size:18px;font-weight:700;margin-bottom:16px;">${esc(name)}</div>`;
}

// `manage` says where this mail is switched off. Client-facing mail points at
// client settings; the owner digest is env-driven, so it says so instead.
function footer(branding: Branding, manage = 'Manage notifications in your client settings.'): string {
  const support = branding.supportEmail
    ? `Questions? <a href="mailto:${esc(branding.supportEmail)}" style="color:#2563eb;">${esc(branding.supportEmail)}</a>`
    : 'You are receiving this because you are listed as a notification recipient.';
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="${MUTED}">${support}<br/>${esc(manage)}</p>`;
}

// Wrap body content in the branded shell.
function shell(branding: Branding, body: string, manage?: string): string {
  return `<div style="${CONTAINER}">${header(branding)}${body}${footer(branding, manage)}</div>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${esc(url)}" style="${BUTTON}">${esc(label)}</a></p>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// --- Instant: one new ticket ---
export function instantEmail(opts: {
  branding: Branding;
  ref: string;
  projectName: string | null;
  pageSection: string;
  submitterName: string | null;
  comment: string | null;
  dashboardUrl: string;
}): RenderedEmail {
  const { branding, ref, projectName, pageSection, submitterName, comment, dashboardUrl } = opts;
  const who = submitterName ? esc(submitterName) : 'Someone';
  const proj = projectName ? ` in ${esc(projectName)}` : '';
  const subject = `New feedback ${ref}${projectName ? ` — ${projectName}` : ''}`;
  const body = `
    <p style="font-size:15px;">${who} submitted new feedback${proj}.</p>
    <table style="font-size:14px;border-collapse:collapse;margin:12px 0;">
      <tr><td style="${MUTED}padding:2px 12px 2px 0;">Ticket</td><td>${esc(ref)}</td></tr>
      <tr><td style="${MUTED}padding:2px 12px 2px 0;">Page</td><td>${esc(pageSection)}</td></tr>
      ${comment ? `<tr><td style="${MUTED}padding:2px 12px 2px 0;vertical-align:top;">Note</td><td>${esc(comment)}</td></tr>` : ''}
    </table>
    ${button(dashboardUrl, 'View ticket')}`;
  const text = `${who} submitted new feedback${projectName ? ` in ${projectName}` : ''}.
Ticket: ${ref}
Page: ${pageSection}${comment ? `\nNote: ${comment}` : ''}
View: ${dashboardUrl}`;
  return { subject, html: shell(branding, body), text };
}

// --- Resolved notice ---
export function resolvedEmail(opts: {
  branding: Branding;
  ref: string;
  projectName: string | null;
  pageSection: string;
  dashboardUrl: string;
}): RenderedEmail {
  const { branding, ref, projectName, pageSection, dashboardUrl } = opts;
  const subject = `Resolved: ${ref}${projectName ? ` — ${projectName}` : ''}`;
  const body = `
    <p style="font-size:15px;">Ticket <strong>${esc(ref)}</strong>${projectName ? ` in ${esc(projectName)}` : ''} was marked resolved.</p>
    <p style="${MUTED}">Page: ${esc(pageSection)}</p>
    ${button(dashboardUrl, 'View ticket')}`;
  const text = `Ticket ${ref}${projectName ? ` in ${projectName}` : ''} was marked resolved.
Page: ${pageSection}
View: ${dashboardUrl}`;
  return { subject, html: shell(branding, body), text };
}

// --- Rate-limit "paused" notice (instant emails hit the hourly cap) ---
export function pausedEmail(opts: {
  branding: Branding;
  cap: number;
  dashboardUrl: string;
}): RenderedEmail {
  const { branding, cap, dashboardUrl } = opts;
  const subject = 'New-feedback emails paused for this hour';
  const body = `
    <p style="font-size:15px;">More than ${cap} new tickets came in this hour, so per-ticket emails
    are paused until next hour to avoid flooding your inbox.</p>
    <p style="${MUTED}">Nothing is lost — every ticket is in your dashboard.</p>
    ${button(dashboardUrl, 'Open dashboard')}`;
  const text = `More than ${cap} new tickets came in this hour, so per-ticket emails are paused until next hour.
Every ticket is in your dashboard: ${dashboardUrl}`;
  return { subject, html: shell(branding, body), text };
}

// --- Digest: grouped by project ---
export interface DigestGroup {
  projectName: string | null;
  lines: { ref: string | null; pageSection: string; kind: 'created' | 'resolved' }[];
}

export function digestEmail(opts: {
  branding: Branding;
  cadence: 'hourly' | 'daily';
  groups: DigestGroup[];
  total: number;
  dashboardUrl: string;
}): RenderedEmail {
  const { branding, cadence, groups, total, dashboardUrl } = opts;
  const window = cadence === 'hourly' ? 'past hour' : 'past day';
  const subject = `Feedback digest — ${total} ${total === 1 ? 'update' : 'updates'} (${window})`;

  const groupHtml = groups
    .map((g) => {
      const items = g.lines
        .map(
          (l) =>
            `<li style="margin:4px 0;font-size:14px;">
               <strong>${esc(l.ref || '—')}</strong>
               <span style="${MUTED}">${l.kind === 'resolved' ? 'resolved' : 'new'} · ${esc(l.pageSection)}</span>
             </li>`
        )
        .join('');
      return `<div style="margin:16px 0;">
        <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${esc(g.projectName || 'Unassigned')}</div>
        <ul style="margin:0;padding-left:18px;">${items}</ul>
      </div>`;
    })
    .join('');

  const body = `
    <p style="font-size:15px;">${total} ticket ${total === 1 ? 'update' : 'updates'} in the ${window}.</p>
    ${groupHtml}
    ${button(dashboardUrl, 'Open dashboard')}`;

  const text =
    `${total} ticket update(s) in the ${window}.\n\n` +
    groups
      .map(
        (g) =>
          `${g.projectName || 'Unassigned'}:\n` +
          g.lines.map((l) => `  - ${l.ref || '—'} (${l.kind}) ${l.pageSection}`).join('\n')
      )
      .join('\n\n') +
    `\n\nDashboard: ${dashboardUrl}`;

  return { subject, html: shell(branding, body), text };
}

// --- Owner digest: every client, one email ---
// The operator's daily roll-up. Grouped client → project; one line per ticket,
// each linking straight to that ticket in the client's portal. No screenshots:
// they live in the DB as base64 and every major mail client blocks data: URIs,
// so a thumbnail would render as a broken image — the link carries it instead.
export interface OwnerDigestLine {
  ref: string | null;
  note: string | null;
  pageSection: string;
  submitterName: string | null;
  kind: 'created' | 'resolved';
  url: string | null; // deep link to the ticket, null when the client has no token
}

export interface OwnerDigestProject {
  projectName: string | null;
  lines: OwnerDigestLine[];
}

export interface OwnerDigestClient {
  clientName: string | null;
  projects: OwnerDigestProject[];
}

// Keep a ticket to one line in the inbox; the link has the full story.
const NOTE_MAX = 80;
function oneLine(note: string | null): string {
  const flat = (note || '').replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  return flat.length > NOTE_MAX ? `${flat.slice(0, NOTE_MAX - 1)}…` : flat;
}

function ownerLine(l: OwnerDigestLine): string {
  const label = esc(l.ref || '—');
  const linked = l.url
    ? `<a href="${esc(l.url)}" style="color:#2563eb;text-decoration:none;font-weight:600;">${label}</a>`
    : `<strong>${label}</strong>`;
  const note = oneLine(l.note);
  const detail = note || l.pageSection;
  const who = l.submitterName ? ` — ${esc(l.submitterName)}` : '';
  const tag = l.kind === 'resolved' ? `<span style="${MUTED}">resolved · </span>` : '';
  return `<li style="margin:5px 0;font-size:14px;line-height:1.4;">
    ${linked} ${tag}${esc(detail)}<span style="${MUTED}">${who}</span>
  </li>`;
}

export function ownerDigestEmail(opts: {
  branding: Branding;
  clients: OwnerDigestClient[];
  created: number;
  resolved: number;
  truncated?: boolean;
  adminUrl: string;
}): RenderedEmail {
  const { branding, clients, created, resolved, truncated, adminUrl } = opts;

  const counts = [
    created > 0 ? `${created} new` : null,
    resolved > 0 ? `${resolved} resolved` : null,
  ].filter(Boolean);
  const summary = counts.length > 0 ? counts.join(', ') : 'no activity';
  const subject = `Feedback digest — ${summary}`;

  const clientHtml = clients
    .map((c) => {
      const projects = c.projects
        .map(
          (p) => `<div style="margin:10px 0 10px 2px;">
            <div style="font-weight:600;font-size:13px;color:#374151;margin-bottom:2px;">${esc(p.projectName || 'No project')}</div>
            <ul style="margin:0;padding-left:18px;">${p.lines.map(ownerLine).join('')}</ul>
          </div>`
        )
        .join('');
      return `<div style="margin:20px 0;">
        <div style="font-size:15px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">${esc(c.clientName || 'Unassigned')}</div>
        ${projects}
      </div>`;
    })
    .join('');

  const overflow = truncated
    ? `<p style="${MUTED}">Busy day — this is the first ${clients.reduce((n, c) => n + c.projects.reduce((m, p) => m + p.lines.length, 0), 0)} tickets. The rest are in the admin.</p>`
    : '';

  const body = `
    <p style="font-size:15px;">Since your last digest, across all clients: <strong>${esc(summary)}</strong>.</p>
    ${clientHtml}
    ${overflow}
    ${button(adminUrl, 'Open admin')}`;

  const text =
    `Feedback digest — ${summary}\n\n` +
    clients
      .map(
        (c) =>
          `${c.clientName || 'Unassigned'}\n` +
          c.projects
            .map(
              (p) =>
                `  ${p.projectName || 'No project'}:\n` +
                p.lines
                  .map((l) => {
                    const detail = oneLine(l.note) || l.pageSection;
                    const who = l.submitterName ? ` — ${l.submitterName}` : '';
                    const tag = l.kind === 'resolved' ? 'resolved · ' : '';
                    return `    - ${l.ref || '—'} ${tag}${detail}${who}${l.url ? `\n      ${l.url}` : ''}`;
                  })
                  .join('\n')
            )
            .join('\n')
      )
      .join('\n\n') +
    (truncated ? '\n\n(Truncated — the rest are in the admin.)' : '') +
    `\n\nAdmin: ${adminUrl}`;

  const manage = 'You are the instance owner. Set OWNER_DIGEST_TO to change or stop this digest.';
  return { subject, html: shell(branding, body, manage), text };
}

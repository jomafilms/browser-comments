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

function footer(branding: Branding): string {
  const support = branding.supportEmail
    ? `Questions? <a href="mailto:${esc(branding.supportEmail)}" style="color:#2563eb;">${esc(branding.supportEmail)}</a>`
    : 'You are receiving this because you are listed as a notification recipient.';
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
    <p style="${MUTED}">${support}<br/>Manage notifications in your client settings.</p>`;
}

// Wrap body content in the branded shell.
function shell(branding: Branding, body: string): string {
  return `<div style="${CONTAINER}">${header(branding)}${body}${footer(branding)}</div>`;
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

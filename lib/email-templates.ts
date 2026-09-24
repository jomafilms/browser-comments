// Client-facing email templates: instant new-ticket, resolved notice, the
// rate-limit pause notice, and the per-client digest. Shared chrome (escape,
// shell, header/footer, button) lives in email-shell.ts.

import { Branding } from './db/types';
import { esc, shell, button, MUTED, RenderedEmail } from './email-shell';

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


// The OPERATOR's cross-client digest — one daily email covering every client,
// as opposed to the per-client templates in email-templates.ts.

import { Branding } from './db/types';
import { esc, shell, button, MUTED, RenderedEmail } from './email-shell';

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

// The digest is split into sections so feedback from OTHER people leads and the
// operator's own tickets sit below — when you file most of your own tickets,
// an undifferentiated list buries the handful you actually need to read.
export interface OwnerDigestSection {
  title: string | null; // null = render with no heading (the single-section case)
  clients: OwnerDigestClient[];
  count: number;
  /** false in a single-submitter section ("From you") where the name is implied by the heading. */
  showSubmitter?: boolean;
}

// Keep a ticket to one line in the inbox; the link has the full story.
const NOTE_MAX = 80;
function oneLine(note: string | null): string {
  const flat = (note || '').replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  return flat.length > NOTE_MAX ? `${flat.slice(0, NOTE_MAX - 1)}…` : flat;
}

function ownerLine(l: OwnerDigestLine, showSubmitter = true): string {
  const label = esc(l.ref || '—');
  const linked = l.url
    ? `<a href="${esc(l.url)}" style="color:#2563eb;text-decoration:none;font-weight:600;">${label}</a>`
    : `<strong>${label}</strong>`;
  const note = oneLine(l.note);
  const detail = note || l.pageSection;
  const who = showSubmitter && l.submitterName ? ` — ${esc(l.submitterName)}` : '';
  const tag = l.kind === 'resolved' ? `<span style="${MUTED}">resolved · </span>` : '';
  return `<li style="margin:5px 0;font-size:14px;line-height:1.4;">
    ${linked} ${tag}${esc(detail)}<span style="${MUTED}">${who}</span>
  </li>`;
}

export function ownerDigestEmail(opts: {
  branding: Branding;
  sections: OwnerDigestSection[];
  created: number;
  resolved: number;
  truncated?: boolean;
  adminUrl: string;
}): RenderedEmail {
  const { branding, sections, created, resolved, truncated, adminUrl } = opts;

  const shown = sections.filter((s) => s.clients.length > 0);
  const counts = [
    created > 0 ? `${created} new` : null,
    resolved > 0 ? `${resolved} resolved` : null,
  ].filter(Boolean);
  const summary = counts.length > 0 ? counts.join(', ') : 'no activity';
  // Lead the subject with the split when there is one — the whole point is that
  // "3 from others" is the number worth seeing in a notification list.
  const subject =
    shown.length > 1
      ? `Feedback digest — ${shown.map((s) => `${s.count} ${s.title?.toLowerCase() ?? ''}`.trim()).join(', ')}`
      : `Feedback digest — ${summary}`;

  const renderClients = (clients: OwnerDigestClient[], showSubmitter: boolean) => clients
    .map((c) => {
      const projects = c.projects
        .map(
          (p) => `<div style="margin:10px 0 10px 2px;">
            <div style="font-weight:600;font-size:13px;color:#374151;margin-bottom:2px;">${esc(p.projectName || 'No project')}</div>
            <ul style="margin:0;padding-left:18px;">${p.lines.map((l) => ownerLine(l, showSubmitter)).join('')}</ul>
          </div>`
        )
        .join('');
      return `<div style="margin:20px 0;">
        <div style="font-size:15px;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">${esc(c.clientName || 'Unassigned')}</div>
        ${projects}
      </div>`;
    })
    .join('');

  const sectionHtml = shown
    .map((sec) => {
      const heading = sec.title
        ? `<div style="margin:26px 0 2px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;">${esc(sec.title)} · ${sec.count}</div>`
        : '';
      return `${heading}${renderClients(sec.clients, sec.showSubmitter !== false)}`;
    })
    .join('');

  const shownLines = shown.reduce((n, sec) => n + sec.count, 0);
  const overflow = truncated
    ? `<p style="${MUTED}">Busy day — this is the first ${shownLines} tickets. The rest are in the admin.</p>`
    : '';

  const body = `
    <p style="font-size:15px;">Since your last digest, across all clients: <strong>${esc(summary)}</strong>.</p>
    ${sectionHtml}
    ${overflow}
    ${button(adminUrl, 'Open admin')}`;

  const clientsText = (clients: OwnerDigestClient[], showSubmitter: boolean) =>
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
                    const who = showSubmitter && l.submitterName ? ` — ${l.submitterName}` : '';
                    const tag = l.kind === 'resolved' ? 'resolved · ' : '';
                    return `    - ${l.ref || '—'} ${tag}${detail}${who}${l.url ? `\n      ${l.url}` : ''}`;
                  })
                  .join('\n')
            )
            .join('\n')
      )
      .join('\n\n');

  const text =
    `${subject}\n\n` +
    shown
      .map(
        (sec) =>
          (sec.title ? `== ${sec.title.toUpperCase()} (${sec.count}) ==\n\n` : '') +
          clientsText(sec.clients, sec.showSubmitter !== false)
      )
      .join('\n\n') +
    (truncated ? '\n\n(Truncated — the rest are in the admin.)' : '') +
    `\n\nAdmin: ${adminUrl}`;

  const manage = 'You are the instance owner. Set OWNER_DIGEST_TO to change or stop this digest.';
  return { subject, html: shell(branding, body, manage), text };
}

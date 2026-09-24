import {
  getBranding,
  getOwnerDigestCheckpoint,
  getOwnerDigestItems,
  touchOwnerDigestAt,
  OwnerDigestItem,
} from './db';
import { sendEmail } from './email';
import { ticketLink } from './portal-links';
import {
  ownerDigestEmail,
  OwnerDigestClient,
  OwnerDigestProject,
  OwnerDigestSection,
} from './email-templates-owner';
import { RenderedEmail } from './email-shell';
import { Branding } from './db/types';

// Orchestration for the owner digest — one daily cross-client email to the
// operator. Kept out of the cron route so the route stays a thin auth + tick
// wrapper, and so this is unit-testable on its own.
//
// Opt-in via OWNER_DIGEST_TO (comma-separated). Unset → nothing runs, which is
// the right default for every fork that isn't Annie's instance.

const WINDOW = '24 hours';

// Submitter names that count as "you" — their tickets sort into a section below
// the rest, so feedback from other people leads. Comma-separated, matched
// case-insensitively against comments.submitter_name. Unset = no split, which
// is the right default for a fork whose operator doesn't file their own tickets.
function selfNames(): string[] {
  return (process.env.OWNER_DIGEST_SELF_NAMES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isSelf(submitterName: string | null, names: string[]): boolean {
  if (names.length === 0 || !submitterName) return false;
  return names.includes(submitterName.trim().toLowerCase());
}

export interface OwnerDigestResult {
  status: 'disabled' | 'not-due' | 'empty' | 'sent' | 'skipped' | 'failed';
  total?: number;
  error?: string;
}

export function ownerDigestRecipients(): string[] {
  return (process.env.OWNER_DIGEST_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// items arrive pre-sorted by client, then project (see getOwnerDigestItems), so
// a single pass builds the nested groups without re-sorting.
function groupByClientAndProject(items: OwnerDigestItem[], base: string): OwnerDigestClient[] {
  const byClient = new Map<string, { group: OwnerDigestClient; projects: Map<string, OwnerDigestProject> }>();

  for (const item of items) {
    const clientKey = String(item.clientId ?? 'unassigned');
    let entry = byClient.get(clientKey);
    if (!entry) {
      entry = { group: { clientName: item.clientName, projects: [] }, projects: new Map() };
      byClient.set(clientKey, entry);
    }

    const projectKey = String(item.projectId ?? 'none');
    let project = entry.projects.get(projectKey);
    if (!project) {
      project = { projectName: item.projectName, lines: [] };
      entry.projects.set(projectKey, project);
      entry.group.projects.push(project);
    }

    // Prefer the ref in the URL (human-readable, survives a copy/paste into
    // the portal's jump-to box); fall back to the legacy display number.
    const linkId = item.ref ?? item.displayNumber;
    project.lines.push({
      ref: item.ref ?? (item.displayNumber != null ? `#${item.displayNumber}` : null),
      note: item.note,
      pageSection: item.pageSection,
      submitterName: item.submitterName,
      kind: item.kind,
      url: linkId != null && item.clientToken ? ticketLink(base, item.clientToken, linkId) : null,
    });
  }

  return [...byClient.values()].map((e) => e.group);
}

// Build the email from a set of items. Pure (no DB, no network) and exported so
// the exact production rendering can be exercised in a test or a preview.
export function buildOwnerDigest(
  items: OwnerDigestItem[],
  truncated: boolean,
  base: string,
  branding: Branding
): RenderedEmail {
  // Split "from others" above "from you". With no self-names configured — or
  // when every ticket falls on one side — this collapses to a single untitled
  // section, i.e. exactly the original layout.
  const names = selfNames();
  const mine = items.filter((i) => isSelf(i.submitterName, names));
  const theirs = items.filter((i) => !isSelf(i.submitterName, names));

  const sections: OwnerDigestSection[] =
    mine.length === 0 || theirs.length === 0
      ? [{ title: null, clients: groupByClientAndProject(items, base), count: items.length }]
      : [
          { title: 'From others', clients: groupByClientAndProject(theirs, base), count: theirs.length },
          // showSubmitter: false — every line here is yours, so repeating the
          // name on all of them is noise the heading already covers.
          { title: 'From you', clients: groupByClientAndProject(mine, base), count: mine.length, showSubmitter: false },
        ];

  return ownerDigestEmail({
    branding,
    sections,
    created: items.filter((i) => i.kind === 'created').length,
    resolved: items.filter((i) => i.kind === 'resolved').length,
    truncated,
    adminUrl: `${base}/admin`,
  });
}

// Run the owner digest for this tick. `due` is decided by the caller (the cron
// route owns the clock), so this stays a pure "build it and send it" step.
export async function runOwnerDigest(base: string, due: boolean, tz: string): Promise<OwnerDigestResult> {
  const recipients = ownerDigestRecipients();
  if (recipients.length === 0) return { status: 'disabled' };
  // Check the clock before the DB: this runs on all 24 hourly ticks, and 23 of
  // them have no reason to open a connection.
  if (!due) return { status: 'not-due' };

  const checkpoint = await getOwnerDigestCheckpoint(tz);
  // Already sent on today's local date — never twice in one day, but never
  // skipping tomorrow either.
  if (!checkpoint.dueToday) return { status: 'not-due' };

  const { items, truncated, asOf } = await getOwnerDigestItems(checkpoint.since, WINDOW);
  if (items.length === 0) {
    // Nothing happened — send nothing, and leave the checkpoint where it is so
    // the next digest still covers this quiet window.
    return { status: 'empty' };
  }

  const branding = await getBranding('instance');
  const { subject, html, text } = buildOwnerDigest(items, truncated, base, branding);

  const result = await sendEmail({ to: recipients, subject, html, text });
  if (result.ok || result.skipped) {
    // Advance on a real send, and also when there was nothing deliverable
    // (EMAIL_ALLOWLIST emptied the recipients) — otherwise every later tick
    // re-attempts the same window forever.
    await touchOwnerDigestAt(asOf);
    return { status: result.ok ? 'sent' : 'skipped', total: items.length };
  }
  // A real send failure leaves the checkpoint alone, so the window is preserved
  // and nothing is lost — but note the retry is the next DUE tick, i.e. ~24h
  // away, not the next hourly tick.
  return { status: 'failed', total: items.length, error: result.error };
}

import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import {
  getDigestClients,
  getDigestItems,
  touchLastDigestAt,
  resolveBranding,
  DigestClient,
  DigestItem,
} from '@/lib/db';
import { emailEnabled, emailLinkBase, sendEmail } from '@/lib/email';
import { digestEmail, DigestGroup } from '@/lib/email-templates';

// Hourly digest tick (registered in vercel.json). Each run decides who is due:
// hourly-cadence clients every tick; daily-cadence clients once per day at the
// local digest hour. Guarded by CRON_SECRET (Vercel attaches it as a Bearer).

export const dynamic = 'force-dynamic';

// Default daily send hour, in America/Los_Angeles (a setting later if asked).
const DIGEST_HOUR = parseInt(process.env.EMAIL_DIGEST_HOUR || '9', 10);
const DIGEST_TZ = process.env.EMAIL_DIGEST_TZ || 'America/Los_Angeles';

function timingSafeEqualStr(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// Cron auth: require CRON_SECRET and a matching Bearer. Without the secret set,
// the endpoint is closed (returns 401) so it can't be triggered anonymously.
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') && timingSafeEqualStr(header.slice(7), secret);
}

function currentHourIn(tz: string): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  return parseInt(hour, 10) % 24; // some ICU builds render midnight as "24"
}

function isDue(client: DigestClient, localHour: number): boolean {
  return client.cadence === 'hourly'
    ? client.hourlyDue
    : client.dailyWindowOk && localHour === DIGEST_HOUR;
}

function groupByProject(items: DigestItem[]): DigestGroup[] {
  const byProject = new Map<string, DigestGroup>();
  for (const item of items) {
    const key = String(item.projectId ?? 'unassigned');
    let group = byProject.get(key);
    if (!group) {
      group = { projectName: item.projectName, lines: [] };
      byProject.set(key, group);
    }
    group.lines.push({ ref: item.ref, pageSection: item.pageSection, kind: item.kind });
  }
  return [...byProject.values()];
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!emailEnabled()) {
    return NextResponse.json({ skipped: 'email disabled (no provider configured)' });
  }

  const base = emailLinkBase(new URL(request.url).origin);
  const localHour = currentHourIn(DIGEST_TZ);
  const clients = await getDigestClients();

  let sent = 0;
  let empty = 0;
  let skipped = 0;
  let failed = 0;

  for (const client of clients) {
    if (!isDue(client, localHour)) continue;

    const interval = client.cadence === 'hourly' ? '1 hour' : '24 hours';
    const items = await getDigestItems(client.id, client.since, interval);
    if (items.length === 0) {
      empty++;
      continue; // skip empty digests; leave the checkpoint so nothing is missed
    }

    const branding = await resolveBranding(null, client.id);
    const dashboardUrl = client.token ? `${base}/c/${client.token}/comments` : base;
    const { subject, html, text } = digestEmail({
      branding,
      cadence: client.cadence,
      groups: groupByProject(items),
      total: items.length,
      dashboardUrl,
    });

    const result = await sendEmail({ to: client.recipients, subject, html, text });
    if (result.ok) {
      await touchLastDigestAt(client.id); // advance on a real send
      sent++;
    } else if (result.skipped) {
      // Nothing to deliver (e.g. EMAIL_ALLOWLIST emptied the recipients) — advance
      // the checkpoint anyway so the same window doesn't re-attempt every hour.
      await touchLastDigestAt(client.id);
      skipped++;
    } else {
      failed++; // real send error — leave the checkpoint so it retries next tick
    }
  }

  return NextResponse.json({ ok: true, considered: clients.length, sent, empty, skipped, failed });
}

import { withClient } from './pool';
import { refSelectSql } from './refs';
import { DigestCadence, NewTicketMode, NotificationSettings } from './types';

// Per-client email notification settings (v6 schema) + the queries the digest
// cron needs. Storage/validation live here; sending lives in lib/email*.ts.

const NEW_TICKET_MODES: NewTicketMode[] = ['instant', 'digest', 'off'];
const DIGEST_CADENCES: DigestCadence[] = ['hourly', 'daily'];

const MAX_RECIPIENTS = 20;
const MAX_EMAIL_LENGTH = 254;
// Deliberately permissive — real validity is proven by a successful send, not a regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const NOTIFICATION_DEFAULTS: Required<NotificationSettings> = {
  recipients: [],
  newTicket: 'off',
  digestCadence: 'daily',
  resolvedNotice: false,
};

// Validate + normalize untrusted input into a clean NotificationSettings.
// Throws on malformed email so the API can surface a 400.
export function normalizeNotificationSettings(input: unknown): NotificationSettings {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('notification settings must be an object');
  }
  const raw = input as Record<string, unknown>;

  const recipients: string[] = [];
  if (raw.recipients !== undefined) {
    if (!Array.isArray(raw.recipients)) throw new Error('recipients must be an array of emails');
    for (const entry of raw.recipients) {
      const email = String(entry).trim().toLowerCase();
      if (email === '') continue;
      if (email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
        throw new Error(`invalid recipient email: ${email.slice(0, 80)}`);
      }
      if (!recipients.includes(email)) recipients.push(email);
    }
    if (recipients.length > MAX_RECIPIENTS) {
      throw new Error(`too many recipients (max ${MAX_RECIPIENTS})`);
    }
  }

  const newTicket =
    raw.newTicket === undefined
      ? NOTIFICATION_DEFAULTS.newTicket
      : NEW_TICKET_MODES.includes(raw.newTicket as NewTicketMode)
        ? (raw.newTicket as NewTicketMode)
        : (() => {
            throw new Error('newTicket must be instant, digest, or off');
          })();

  const digestCadence =
    raw.digestCadence === undefined
      ? NOTIFICATION_DEFAULTS.digestCadence
      : DIGEST_CADENCES.includes(raw.digestCadence as DigestCadence)
        ? (raw.digestCadence as DigestCadence)
        : (() => {
            throw new Error('digestCadence must be hourly or daily');
          })();

  return {
    recipients,
    newTicket,
    digestCadence,
    resolvedNotice: raw.resolvedNotice === true,
  };
}

// Effective settings for a client, defaults filled in. Never throws on stored
// data — normalization happens on write.
export async function getNotificationSettings(clientId: number): Promise<Required<NotificationSettings>> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT notification_settings FROM clients WHERE id = $1`,
      [clientId]
    );
    const stored = (result.rows[0]?.notification_settings || {}) as NotificationSettings;
    return { ...NOTIFICATION_DEFAULTS, ...stored };
  });
}

export async function updateNotificationSettings(
  clientId: number,
  settings: NotificationSettings
): Promise<NotificationSettings> {
  const normalized = normalizeNotificationSettings(settings);
  return withClient(async (client) => {
    const result = await client.query(
      `UPDATE clients SET notification_settings = $1 WHERE id = $2 RETURNING notification_settings`,
      [JSON.stringify(normalized), clientId]
    );
    return result.rows[0]?.notification_settings || normalized;
  });
}

// A client that opted into digests, with everything the cron needs. The
// due-ness windows are computed DB-side (NOW()) so we never round-trip the
// naive last_digest_at timestamp through JS and shift its timezone.
export interface DigestClient {
  id: number;
  token: string | null;
  name: string;
  recipients: string[];
  cadence: DigestCadence;
  since: string | null; // last_digest_at as a naive wall-clock string (DB tz), null if never sent
  hourlyDue: boolean; // ≥ ~1h since the last digest (or never)
  dailyWindowOk: boolean; // ≥ ~20h since the last digest (or never) — pair with the 9am local check
}

export async function getDigestClients(): Promise<DigestClient[]> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT id, token, name,
              notification_settings->>'digestCadence' AS cadence,
              notification_settings->'recipients' AS recipients,
              last_digest_at::text AS since,
              (last_digest_at IS NULL OR last_digest_at < NOW() - INTERVAL '55 minutes') AS hourly_due,
              (last_digest_at IS NULL OR last_digest_at < NOW() - INTERVAL '20 hours') AS daily_window_ok
       FROM clients
       WHERE notification_settings->>'newTicket' = 'digest'
         AND jsonb_array_length(COALESCE(notification_settings->'recipients', '[]'::jsonb)) > 0`
    );
    return result.rows.map((r) => ({
      id: r.id,
      token: r.token,
      name: r.name,
      recipients: (r.recipients as string[]) || [],
      cadence: r.cadence === 'hourly' ? 'hourly' : 'daily',
      since: r.since,
      hourlyDue: r.hourly_due,
      dailyWindowOk: r.daily_window_ok,
    }));
  });
}

export interface DigestItem {
  ref: string | null;
  projectId: number | null;
  projectName: string | null;
  pageSection: string;
  submitterName: string | null;
  kind: 'created' | 'resolved';
  createdAt: Date;
}

// Tickets created OR resolved since `since` for a client. `since` is a naive
// wall-clock string in the DB timezone (from getDigestClients); when null (no
// prior digest) we fall back to the cadence window so the first digest is bounded.
export async function getDigestItems(
  clientId: number,
  since: string | null,
  fallbackInterval: string
): Promise<DigestItem[]> {
  const REF_SELECT = refSelectSql('p');
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT c.project_id, p.name AS project_name, c.page_section, c.submitter_name,
              c.status, c.created_at, c.updated_at, ${REF_SELECT}
       FROM comments c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.client_id = $1
         AND (
           c.created_at > COALESCE($2::timestamp, NOW() - $3::interval)
           OR (c.status = 'resolved' AND c.updated_at > COALESCE($2::timestamp, NOW() - $3::interval))
         )
       ORDER BY p.name NULLS FIRST, c.created_at DESC`,
      [clientId, since, fallbackInterval]
    );
    return result.rows.map((r) => {
      const createdSince = since === null || new Date(r.created_at) > new Date(since);
      return {
        ref: r.ref,
        projectId: r.project_id,
        projectName: r.project_name,
        pageSection: r.page_section,
        submitterName: r.submitter_name,
        // A ticket both created and resolved in-window counts as 'created' (new work).
        kind: createdSince ? 'created' : 'resolved',
        createdAt: r.created_at,
      } as DigestItem;
    });
  });
}

// Advance the digest checkpoint to now (DB clock) after a successful send.
export async function touchLastDigestAt(clientId: number): Promise<void> {
  await withClient((client) =>
    client.query(`UPDATE clients SET last_digest_at = NOW() WHERE id = $1`, [clientId])
  );
}

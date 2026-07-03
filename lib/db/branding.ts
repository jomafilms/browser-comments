import { withClient } from './pool';
import { Branding } from './types';

// Operator branding for client-facing surfaces (self-hosting devs put their
// company info here). Three levels, resolved per-key: project → client →
// instance. Edit UI lives in the admin (better-auth lane); this module is the
// storage + resolution layer.

const BRANDING_KEYS = ['companyName', 'logoUrl', 'supportEmail'] as const;

const MAX_FIELD_LENGTH = 200;

export type BrandingScope = 'instance' | 'client' | 'project';

const SCOPE_TABLES = { client: 'clients', project: 'projects' } as const;

// Validates and normalizes a branding object. Throws on invalid logoUrl —
// the logo is operator-hosted, so only http(s) URLs are allowed.
export function validateBranding(input: unknown): Branding {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('branding must be an object');
  }
  const raw = input as Record<string, unknown>;
  const out: Branding = {};
  for (const key of BRANDING_KEYS) {
    const value = raw[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' || value.length > MAX_FIELD_LENGTH) {
      throw new Error(`branding.${key} must be a string under ${MAX_FIELD_LENGTH} chars`);
    }
    out[key] = value.trim();
  }
  if (out.logoUrl) {
    let parsed: URL;
    try {
      parsed = new URL(out.logoUrl);
    } catch {
      throw new Error('branding.logoUrl must be a valid URL');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('branding.logoUrl must be http(s)');
    }
  }
  return out;
}

// Merge levels per-key, most specific wins; empty/missing keys fall through
function mergeBranding(...levels: (Branding | null | undefined)[]): Branding {
  const out: Branding = {};
  for (const level of levels) {
    if (!level) continue;
    for (const key of BRANDING_KEYS) {
      if (level[key]) out[key] = level[key];
    }
  }
  return out;
}

// Resolve the effective branding for a scope: project → client → instance.
// When only projectId is known, the client is derived from the project.
export async function resolveBranding(
  projectId?: number | null,
  clientId?: number | null
): Promise<Branding> {
  return withClient(async (client) => {
    const result = await client.query(
      `SELECT
         (SELECT branding FROM instance_settings WHERE id = 1) AS instance,
         (SELECT branding FROM clients WHERE id = COALESCE($2::int, (SELECT client_id FROM projects WHERE id = $1))) AS client,
         (SELECT branding FROM projects WHERE id = $1) AS project`,
      [projectId ?? null, clientId ?? null]
    );
    const row = result.rows[0];
    // Least specific first — later levels override
    return mergeBranding(row.instance, row.client, row.project);
  });
}

// Raw (unmerged) branding for one level — what an edit UI shows
export async function getBranding(scope: BrandingScope, id?: number): Promise<Branding> {
  return withClient(async (client) => {
    if (scope === 'instance') {
      const result = await client.query(`SELECT branding FROM instance_settings WHERE id = 1`);
      return result.rows[0]?.branding || {};
    }
    if (!Number.isInteger(id)) throw new Error(`${scope} branding requires an id`);
    const result = await client.query(
      `SELECT branding FROM ${SCOPE_TABLES[scope]} WHERE id = $1`,
      [id]
    );
    return result.rows[0]?.branding || {};
  });
}

export async function setBranding(
  scope: BrandingScope,
  branding: Branding,
  id?: number
): Promise<Branding> {
  const validated = validateBranding(branding);
  return withClient(async (client) => {
    if (scope === 'instance') {
      const result = await client.query(
        `INSERT INTO instance_settings (id, branding, updated_at) VALUES (1, $1, NOW())
         ON CONFLICT (id) DO UPDATE SET branding = $1, updated_at = NOW()
         RETURNING branding`,
        [JSON.stringify(validated)]
      );
      return result.rows[0].branding;
    }
    if (!Number.isInteger(id)) throw new Error(`${scope} branding requires an id`);
    const result = await client.query(
      `UPDATE ${SCOPE_TABLES[scope]} SET branding = $1 WHERE id = $2 RETURNING branding`,
      [JSON.stringify(validated), id]
    );
    return result.rows[0]?.branding || {};
  });
}

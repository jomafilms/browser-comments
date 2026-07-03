// Ticket ref helpers — pure functions, no DB access.
// A ref is "<PREFIX>-<project_number>", e.g. "LWF-12". Prefixes are unique
// within a client (collisions across clients are allowed; token scope
// disambiguates).

// Valid prefix: starts with a letter, alphanumeric, max 8 chars (VARCHAR(8))
export const REF_PREFIX_RE = /^[A-Za-z][A-Za-z0-9]{0,7}$/;

const REF_RE = /^([A-Za-z][A-Za-z0-9]{0,7})-([0-9]+)$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Parse "LWF-12" → { prefix: 'LWF', number: 12 }, or null if not a ref
export function parseRef(value: string): { prefix: string; number: number } | null {
  const m = REF_RE.exec(value.trim());
  if (!m) return null;
  const number = parseInt(m[2], 10);
  if (number > 2147483647) return null; // keep the bind inside int4 range → 404, not a pg error
  return { prefix: m[1].toUpperCase(), number };
}

// Build the display ref for a comment, or null when it has no project/prefix
export function formatRef(prefix: string | null | undefined, projectNumber: number | null | undefined): string | null {
  if (!prefix || projectNumber == null) return null;
  return `${prefix}-${projectNumber}`;
}

// SQL twin of formatRef — computes the ref for a comments row aliased `c`,
// with the COMMENT's project joined as `projectAlias`. Keep in sync with
// formatRef; this is the only other place the format lives.
export function refSelectSql(projectAlias: string, outputName = 'ref'): string {
  return `CASE WHEN c.project_number IS NOT NULL AND ${projectAlias}.ref_prefix IS NOT NULL THEN ${projectAlias}.ref_prefix || '-' || c.project_number::text END AS ${outputName}`;
}

// Display label for a ticket: the ref when present, else the legacy "#N"
export function formatCommentLabel(
  ref?: string | null,
  displayNumber?: number | null,
  id?: number | null
): string {
  return ref || `#${displayNumber || id || '?'}`;
}

// Auto-generate a prefix from a project name:
// - first word already an acronym ("LWF App UI") → LWF
// - single word ("joma") → first 4 letters uppercased → JOMA
// - multiple words ("Gary Lundgren Film") → initials → GLF
export function generateRefPrefix(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return 'PRJ';
  if (/^[A-Z]{2,8}$/.test(words[0])) return words[0];
  if (words.length === 1) {
    const w = words[0].replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4);
    return w || 'PRJ';
  }
  const initials = words
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4)
    .replace(/^[0-9]+/, ''); // must start with a letter
  return initials || 'PRJ';
}

// Pick a prefix not already used within the client, appending a digit on collision
export function dedupeRefPrefix(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = String(i);
    const candidate = base.slice(0, 8 - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
}

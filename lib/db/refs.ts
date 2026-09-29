// Ticket ref helpers — pure functions, no DB access.
//
// A ref is "<PREFIX>-<project_number>", e.g. "LWF-12". Prefixes are unique
// within a client (collisions across clients are allowed; token scope
// disambiguates).
//
// ─── THE ONE TICKET IDENTITY ────────────────────────────────────────────────
// `ref` is the ONLY ticket number any human or agent ever sees. `uuid` is the
// stable machine handle. `comments.id` is an internal serial PK and
// `comments.display_number` is a dead legacy per-client counter — neither is
// ever selected into a response, printed, or accepted as a selector.
//
// Why this is a hard rule: display_number counts per CLIENT, project_number
// counts per PROJECT, so on any client with more than one project they drift.
// The drift is often tiny (joma: display 116 vs ref JOMA-114, because the
// client's other project consumed 2 slots), which made the two numbers look
// like the same number with a typo. Humans read the ref off the UI, agents
// read display_number off the API, and they disagreed. One number, no choice.
// ────────────────────────────────────────────────────────────────────────────

// Valid prefix: starts with a letter, alphanumeric, max 8 chars (VARCHAR(8))
export const REF_PREFIX_RE = /^[A-Za-z][A-Za-z0-9]{0,7}$/;

const REF_RE = /^([A-Za-z][A-Za-z0-9]{0,7})-([0-9]+)$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Parse "LWF-12" → { prefix: 'LWF', number: 12 }, or null if not a ref.
// isUuid/parseRef are the primitives parseTicketSelector is built from; both are
// re-exported through the lib/db facade for callers that need one half only.
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

// Display label for a ticket. The ref is the identity; a ticket with no ref
// (only possible for a legacy row with no project — none exist in practice)
// falls back to a short uuid, never to a bare number that could be misread as
// a ref. See THE ONE TICKET IDENTITY above.
export function formatCommentLabel(ref?: string | null, uuid?: string | null): string {
  if (ref) return ref;
  return uuid ? `#${uuid.slice(0, 8)}` : '#?';
}

// A ticket selector accepted from outside: a ref ("LWF-12") or a uuid. Bare
// numbers are deliberately NOT selectors — the same digits mean a different
// ticket depending on which counter the caller happened to read, so we reject
// them loudly instead of resolving one silently.
export type TicketSelector =
  | { kind: 'uuid'; uuid: string }
  | { kind: 'ref'; prefix: string; number: number }
  | { kind: 'invalid'; reason: string };

// The one message every surface uses when a caller passes something that is
// not a ref or uuid, so the fix reads the same from the API, CLI and MCP.
export const SELECTOR_HELP =
  'Ticket selectors must be a ref like "LWF-12" or a uuid. Bare numbers are not accepted: the ticket number shown in the UI is the ref, and a bare number is ambiguous.';

export function parseTicketSelector(value: string): TicketSelector {
  const v = value.trim();
  if (isUuid(v)) return { kind: 'uuid', uuid: v };
  const ref = parseRef(v);
  if (ref) return { kind: 'ref', prefix: ref.prefix, number: ref.number };
  if (/^\d+$/.test(v)) {
    return {
      kind: 'invalid',
      reason: `"${v}" is a bare number. ${SELECTOR_HELP}`,
    };
  }
  return { kind: 'invalid', reason: `"${v}" is not a valid ticket selector. ${SELECTOR_HELP}` };
}

// The single string that identifies a ticket in a URL or in UI state: its ref,
// or its uuid for a legacy row that has no project and therefore no ref. Both
// are unique per ticket, so either one names exactly one ticket. Used by the
// portal (highlight key, ?c= links) and by anything building a ticket link.
export function ticketKey(
  ref: string | null | undefined,
  uuid: string | null | undefined
): string | null {
  return ref ?? uuid ?? null;
}

// Does a bare number look like the tail of this ref? Used ONLY by the portal's
// human-facing "jump to ticket" box and ?c= links, where someone reading
// "JOMA-114" off the screen naturally types "114". Never used to resolve an
// API/CLI/MCP selector — see parseTicketSelector.
export function refTailMatches(ref: string | null | undefined, n: number): boolean {
  if (!ref) return false;
  const parsed = parseRef(ref);
  return parsed !== null && parsed.number === n;
}

// The widget captures feedback as text annotations, not a comment body — join
// them into one readable note. Takes the raw JSONB value so both a typed
// Comment and a raw query row can use it.
export function joinAnnotationTexts(annotations: unknown): string | null {
  if (!Array.isArray(annotations)) return null;
  const parts = annotations
    .map((a) => (a && typeof (a as { text?: unknown }).text === 'string' ? (a as { text: string }).text.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
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

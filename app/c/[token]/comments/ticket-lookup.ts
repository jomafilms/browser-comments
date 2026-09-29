import { Comment } from '@/components/CommentCard';
import { refTailMatches, ticketKey } from '@/lib/db/refs';

// Resolving what a human or a link is pointing at, for the comments page.
//
// A ticket has exactly one number — its ref, e.g. "LWF-12". These helpers match
// that, and nothing that merely looks like it: never an internal row id, never
// the dead per-client counter. Those were different numbers for the same ticket,
// so a lookup on one of them silently returned the wrong ticket. See THE ONE
// TICKET IDENTITY in lib/db/refs.

// Find the ticket a query points at. Matches the ref (case-insensitive), a uuid,
// or the bare number off the END OF THE REF — someone reading "LWF-12" on screen
// naturally types "12". Returns every match, so an ambiguous bare number
// (LWF-12 and EC-12 both under one client token) can be reported rather than
// guessed at.
function findTickets(comments: Comment[], query: string): Comment[] {
  const q = query.trim();
  if (!q) return [];
  const exact = comments.filter(
    (c) => (c.ref && c.ref.toLowerCase() === q.toLowerCase()) || c.uuid === q
  );
  if (exact.length > 0) return exact;
  if (/^\d+$/.test(q)) {
    const n = parseInt(q, 10);
    return comments.filter((c) => refTailMatches(c.ref, n));
  }
  return [];
}

// Point the address bar at one ticket, dropping the legacy ?commentId=. Shared
// so the jump-to box and legacy-link resolution can't drift apart.
export function writeTicketToUrl(token: string, ref: string): void {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete('commentId');
  urlParams.set('c', ref);
  window.history.replaceState({}, '', `/c/${token}/comments?${urlParams.toString()}`);
}

// The key the page highlights on — ticketKey applied to a Comment. This is what
// makes the uuid fallback in notification emails, webhook links and the
// decisions table resolvable rather than dead code.
export function highlightKey(c: Comment): string | null {
  return ticketKey(c.ref, c.uuid);
}

export function matchesHighlight(c: Comment, key: string | null): boolean {
  return key !== null && highlightKey(c) === key;
}

// What to do with a query the user typed: highlight it, or say why not.
type JumpResult =
  | { kind: 'found'; key: string }
  | { kind: 'ambiguous'; message: string }
  | { kind: 'missing'; message: string };

export function resolveJump(comments: Comment[], query: string): JumpResult | null {
  const q = query.trim();
  if (!q) return null;
  const matches = findTickets(comments, q);
  if (matches.length === 1) {
    const key = highlightKey(matches[0]);
    if (key) return { kind: 'found', key };
  }
  if (matches.length > 1) {
    return {
      kind: 'ambiguous',
      message: `"${q}" matches ${matches.map((c) => c.ref).join(', ')}. Type the full ref.`,
    };
  }
  return { kind: 'missing', message: `Ticket ${q} not found in this view.` };
}

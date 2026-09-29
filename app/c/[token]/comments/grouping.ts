import { Comment } from '@/components/CommentCard';

// Sorting and page-section grouping for the comments list. Pure — extracted
// from the page so it stays under the file-size cap and can be unit-tested.
// `sortMode` is CommentsFilterBar's SortMode; taken as a plain string here to
// keep this module free of component imports (the union lives in one place).

const PRIORITY_ORDER: Record<string, number> = { high: 0, med: 1, low: 2 };
const newestFirst = (a: Comment, b: Comment) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

export function sortComments(comments: Comment[], sortMode: string): Comment[] {
  if (sortMode === 'recent') return [...comments].sort(newestFirst);

  if (sortMode === 'resolved-bottom') {
    return [...comments].sort((a, b) => {
      if (a.status === 'resolved' && b.status === 'open') return 1;
      if (a.status === 'open' && b.status === 'resolved') return -1;
      return newestFirst(a, b);
    });
  }

  return [...comments].sort((a, b) => {
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    if (a.priority_number !== b.priority_number) return a.priority_number - b.priority_number;
    return newestFirst(a, b);
  });
}

// Sort and optionally group by page section. resolved-bottom always groups
// (it's only reachable via URL param); recent and priority respect the checkbox.
// Returns one section per page when grouping, else a single headed section.
export function groupComments(
  comments: Comment[],
  sortMode: string,
  groupByPage: boolean
): Record<string, Comment[]> {
  const shouldGroup = sortMode === 'resolved-bottom' || groupByPage;
  if (!shouldGroup) {
    const flatHeader = sortMode === 'recent' ? 'Most Recent First' : 'By Priority';
    return { [flatHeader]: sortComments(comments, sortMode) };
  }

  const grouped = comments.reduce((acc, comment) => {
    const pageSection = comment.page_section || 'Unknown';
    if (!acc[pageSection]) acc[pageSection] = [];
    acc[pageSection].push(comment);
    return acc;
  }, {} as Record<string, Comment[]>);

  for (const pageSection of Object.keys(grouped)) {
    grouped[pageSection] = sortComments(grouped[pageSection], sortMode);
  }
  return grouped;
}

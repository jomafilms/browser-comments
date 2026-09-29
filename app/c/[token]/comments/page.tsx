'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import CommentsFilterBar, { SortMode } from '@/components/CommentsFilterBar';
import CommentsTableView from '@/components/CommentsTableView';
import CommentCard, { Comment } from '@/components/CommentCard';
import ImageModal from '@/components/ImageModal';
import { useClientComments } from '@/lib/hooks/useClientComments';
import { writeTicketToUrl, resolveJump, highlightKey, matchesHighlight } from './ticket-lookup';
import { groupComments } from './grouping';

export default function ClientCommentsPage() {
  const params = useParams();
  const token = params.token as string;

  // Filter/UI state (data + mutations live in useClientComments)
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [selectedProject, setSelectedProject] = useState<string>('all'); // driven by the header scope pill
  const [selectedPage, setSelectedPage] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortMode, setSortMode] = useState<SortMode>('priority');
  const [groupByPage, setGroupByPage] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  // Highlighted ticket, keyed by ref (or uuid if ref-less) — see highlightKey.
  const [highlightedRef, setHighlightedRef] = useState<string | null>(null);
  const [pendingLegacyCommentId, setPendingLegacyCommentId] = useState<number | null>(null);
  const [pendingSelector, setPendingSelector] = useState<string | null>(null);
  // A ?c= that matched nothing — kept so the URL survives and the user is told.
  const [unresolvedSelector, setUnresolvedSelector] = useState<string | null>(null);
  const [searchCommentId, setSearchCommentId] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<{ imageData: string; ref: string | null } | null>(null);
  const [expandedComment, setExpandedComment] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [addNoteToDecisions, setAddNoteToDecisions] = useState(false);

  const {
    comments, projects, pageSections, availableDevices, assignees, decisionNoteKeys,
    loading, error,
    toggleStatus, updatePriority, updateAssignee, addNote, deleteComment, batchUpdatePriority,
  } = useClientComments(token, {
    enabled: isInitialized,
    filters: {
      status: filter, project: selectedProject, page: selectedPage,
      priority: selectedPriority, assignee: selectedAssignee, device: selectedDevice,
    },
    sortMode,
    highlightedRef,
  });

  // Initialize filters from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    const validStatus = statusParam === 'open' || statusParam === 'resolved' || statusParam === 'all';
    if (validStatus) setFilter(statusParam as 'open' | 'resolved' | 'all');
    const projectParam = urlParams.get('project');
    if (projectParam) setSelectedProject(projectParam);
    const pageParam = urlParams.get('page');
    if (pageParam) setSelectedPage(pageParam);
    const priorityParam = urlParams.get('priority');
    if (priorityParam) setSelectedPriority(priorityParam.toLowerCase());
    const assigneeParam = urlParams.get('assignee');
    if (assigneeParam) setSelectedAssignee(assigneeParam);
    const deviceParam = urlParams.get('device');
    if (deviceParam) setSelectedDevice(deviceParam);
    const viewParam = urlParams.get('view');
    if (viewParam === 'table' || viewParam === 'card') setViewMode(viewParam);
    const sortParam = urlParams.get('sort');
    if (sortParam === 'recent' || sortParam === 'resolved-bottom' || sortParam === 'priority') setSortMode(sortParam);
    if (urlParams.get('groupByPage') === 'true') setGroupByPage(true);
    const cParam = urlParams.get('c');
    if (cParam) {
      // ?c= carries the ticket's ref ("LWF-12"). Resolved once comments load.
      setPendingSelector(cParam.trim());
      // Pointing at one ticket means "show me this ticket" — an unrelated
      // default status filter must not hide it. Only a VALID explicit ?status=
      // wins; ?status=garbage was rejected above and must not count as intent.
      if (!validStatus) setFilter('all');
    } else {
      const legacyId = urlParams.get('commentId');
      if (legacyId) {
        const id = parseInt(legacyId);
        if (!isNaN(id)) setPendingLegacyCommentId(id);
      }
    }
    setIsInitialized(true);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    if (!isInitialized) return;
    const urlParams = new URLSearchParams();
    // Always emit the status, 'all' included: it has to survive a refresh, or a
    // deep-linked resolved ticket comes back hidden behind the 'open' default.
    urlParams.set('status', filter);
    if (selectedProject !== 'all') urlParams.set('project', selectedProject);
    if (selectedPage !== 'all') urlParams.set('page', selectedPage);
    if (selectedPriority !== 'all') urlParams.set('priority', selectedPriority);
    if (selectedAssignee !== 'all') urlParams.set('assignee', selectedAssignee);
    if (selectedDevice !== 'all') urlParams.set('device', selectedDevice);
    if (viewMode !== 'card') urlParams.set('view', viewMode);
    urlParams.set('sort', sortMode);
    if (groupByPage) urlParams.set('groupByPage', 'true');
    // Keep the deep-linked ticket in the URL so a refresh, bookmark, or copied
    // link still lands on it. `pendingSelector` matters as much as the resolved
    // ref: this effect runs before the comments arrive, and dropping ?c= for
    // even that moment loses the ticket for anyone who refreshes or copies the
    // URL mid-load. Only an explicit dismiss (the ✕) clears both.
    const deepLink = highlightedRef ?? pendingSelector ?? unresolvedSelector;
    if (deepLink !== null) urlParams.set('c', deepLink);
    const queryString = urlParams.toString();
    const newUrl = queryString ? `/c/${token}/comments?${queryString}` : `/c/${token}/comments`;
    window.history.replaceState({}, '', newUrl);
  }, [filter, selectedProject, selectedPage, selectedPriority, selectedAssignee, selectedDevice, viewMode, sortMode, groupByPage, highlightedRef, pendingSelector, unresolvedSelector, isInitialized, token]);

  // Legacy ?commentId=<row id> links: resolve to the ticket's ref, then rewrite
  // the URL to ?c=<ref> so the link that gets copied onward is a ref.
  useEffect(() => {
    if (pendingLegacyCommentId === null || loading) return;
    const found = comments.find(c => c.id === pendingLegacyCommentId);
    const key = found ? highlightKey(found) : null;
    if (key) {
      setHighlightedRef(key);
      writeTicketToUrl(token, key);
    }
    setPendingLegacyCommentId(null);
  }, [pendingLegacyCommentId, comments, loading, token]);

  // Same lookup as the jump-to box; a deep link records the miss instead of
  // alerting. Gated on `loading`, not on an empty list: `comments` is already
  // filter-reduced, so an active filter can legitimately empty it — and that IS
  // an unresolved deep link, not a still-loading one.
  useEffect(() => {
    if (pendingSelector === null || loading) return;
    const result = resolveJump(comments, pendingSelector);
    if (result?.kind === 'found') {
      setHighlightedRef(result.key);
      setUnresolvedSelector(null);
    } else {
      setUnresolvedSelector(pendingSelector);
    }
    setPendingSelector(null);
  }, [pendingSelector, comments, loading]);

  // The ✕ on the deep-link pill: the only thing that clears ?c=. Both the
  // resolved and the unresolved state have to go, or the effect writes it back.
  const clearDeepLink = () => {
    setHighlightedRef(null);
    setUnresolvedSelector(null);
    setPendingSelector(null);
    setSearchCommentId('');
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.delete('c');
    urlParams.delete('commentId');
    window.history.replaceState({}, '', urlParams.toString() ? `/c/${token}/comments?${urlParams.toString()}` : `/c/${token}/comments`);
  };

  const handleAddNote = async (id: number) => {
    if (!newNote.trim()) return;
    const ok = await addNote(id, newNote, addNoteToDecisions);
    if (ok) { setNewNote(''); setAddNoteToDecisions(false); setExpandedComment(null); }
  };

  // "Jump to" accepts the ref or just its number — an ambiguous one says so
  // instead of guessing, which is how the old lookup hit the wrong ticket.
  const handleJumpTo = (query: string) => {
    const result = resolveJump(comments, query);
    if (!result) return;
    if (result.kind === 'found') {
      setHighlightedRef(result.key);
      setUnresolvedSelector(null);
      writeTicketToUrl(token, result.key);
    } else {
      alert(result.message);
    }
  };

  const handleDeleteComment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) return;
    await deleteComment(id);
  };

  const displayComments = highlightedRef ? comments.filter(c => matchesHighlight(c, highlightedRef)) : comments;

  const groupedComments = groupComments(displayComments, sortMode, groupByPage);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="bg-white p-8 rounded-xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation — the scope pill doubles as the project switcher */}
      <div className="sticky top-0 z-10">
        <ClientNav
          token={token}
          projects={projects}
          selectedProject={selectedProject}
          onProjectChange={setSelectedProject}
        >
          {(highlightedRef || unresolvedSelector) && (
            <div className={`flex items-center gap-2 px-3 py-1 border rounded-lg ${highlightedRef ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
              <span className={`text-sm ${highlightedRef ? 'text-blue-700' : 'text-amber-800'}`}>
                {highlightedRef ?? `${unresolvedSelector} not in this view`}
              </span>
              <button onClick={clearDeepLink} className={`font-bold ${highlightedRef ? 'text-blue-700 hover:text-blue-900' : 'text-amber-800 hover:text-amber-900'}`}>✕</button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleJumpTo(searchCommentId); }} className="hidden sm:flex items-center gap-2">
            <input type="text" value={searchCommentId} onChange={(e) => setSearchCommentId(e.target.value)} placeholder="Jump to e.g. LWF-12" className="w-32 px-2 py-1 border border-gray-300 rounded text-sm" />
            <button type="submit" className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Go</button>
          </form>
        </ClientNav>
      </div>

      <CommentsFilterBar
        status={filter} onStatus={setFilter}
        pages={pageSections} page={selectedPage} onPage={setSelectedPage}
        priority={selectedPriority} onPriority={setSelectedPriority}
        assignees={assignees} assignee={selectedAssignee} onAssignee={setSelectedAssignee}
        devices={availableDevices} device={selectedDevice} onDevice={setSelectedDevice}
        sort={sortMode} onSort={setSortMode}
        groupByPage={groupByPage} onGroupByPage={setGroupByPage}
      />

      {/* Comments */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12"><p className="text-gray-500">Loading...</p></div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No comments found</p>
          </div>
        ) : viewMode === 'table' ? (
          <CommentsTableView comments={displayComments} assignees={assignees} onUpdatePriority={updatePriority} onUpdateAssignee={updateAssignee} onToggleStatus={toggleStatus} onDeleteComment={handleDeleteComment} onSwitchToCardView={() => setViewMode('card')} onBatchUpdatePriority={batchUpdatePriority} />
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedComments).map(([pageSection, sectionComments]) => (
              <div key={pageSection} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">{pageSection.split('/').pop() || pageSection}</h2>
                  <button onClick={() => setViewMode('table')} className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-2" title="Switch to table view">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Table
                  </button>
                </div>
                <div className="space-y-4">
                  {sectionComments.map((comment) => (
                    <CommentCard
                      key={comment.id}
                      comment={comment}
                      isHighlighted={matchesHighlight(comment, highlightedRef)}
                      decisionNoteKeys={decisionNoteKeys}
                      expandedComment={expandedComment}
                      newNote={newNote}
                      addNoteToDecisions={addNoteToDecisions}
                      decisionsLink={`/c/${token}/decisions`}
                      copyLinkUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/c/${token}/comments?c=${encodeURIComponent(highlightKey(comment) ?? '')}`}
                      assignees={assignees}
                      onToggleStatus={toggleStatus}
                      onUpdatePriority={updatePriority}
                      onUpdateAssignee={updateAssignee}
                      onDeleteComment={handleDeleteComment}
                      onExpandImage={(imageData, _id, ref) => setExpandedImage({ imageData, ref })}
                      onSetExpandedComment={setExpandedComment}
                      onSetNewNote={setNewNote}
                      onSetAddNoteToDecisions={setAddNoteToDecisions}
                      onAddNote={handleAddNote}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {expandedImage && (
        <ImageModal
          imageData={expandedImage.imageData}
          commentRef={expandedImage.ref}
          onClose={() => setExpandedImage(null)}
        />
      )}
    </div>
  );
}

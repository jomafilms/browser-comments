'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import CommentsFilterBar, { SortMode } from '@/components/CommentsFilterBar';
import CommentsTableView from '@/components/CommentsTableView';
import CommentCard, { Comment } from '@/components/CommentCard';
import ImageModal from '@/components/ImageModal';
import { useClientComments } from '@/lib/hooks/useClientComments';
import { formatCommentLabel } from '@/lib/db/refs';

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
  const [highlightedDisplayNumber, setHighlightedDisplayNumber] = useState<number | null>(null);
  const [pendingLegacyCommentId, setPendingLegacyCommentId] = useState<number | null>(null);
  const [searchCommentId, setSearchCommentId] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<{ imageData: string; commentId: number; displayNumber: number } | null>(null);
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
    highlightedDisplayNumber,
  });

  // Initialize filters from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    if (statusParam === 'open' || statusParam === 'resolved') setFilter(statusParam);
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
      const num = parseInt(cParam);
      if (!isNaN(num)) setHighlightedDisplayNumber(num);
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
    if (filter !== 'all') urlParams.set('status', filter);
    if (selectedProject !== 'all') urlParams.set('project', selectedProject);
    if (selectedPage !== 'all') urlParams.set('page', selectedPage);
    if (selectedPriority !== 'all') urlParams.set('priority', selectedPriority);
    if (selectedAssignee !== 'all') urlParams.set('assignee', selectedAssignee);
    if (selectedDevice !== 'all') urlParams.set('device', selectedDevice);
    if (viewMode !== 'card') urlParams.set('view', viewMode);
    urlParams.set('sort', sortMode);
    if (groupByPage) urlParams.set('groupByPage', 'true');
    const queryString = urlParams.toString();
    const newUrl = queryString ? `/c/${token}/comments?${queryString}` : `/c/${token}/comments`;
    window.history.replaceState({}, '', newUrl);
  }, [filter, selectedProject, selectedPage, selectedPriority, selectedAssignee, selectedDevice, viewMode, sortMode, groupByPage, isInitialized, token]);

  // Resolve legacy ?commentId=<dbId> links once comments load by mapping to display_number
  useEffect(() => {
    if (pendingLegacyCommentId === null || comments.length === 0) return;
    const found = comments.find(c => c.id === pendingLegacyCommentId);
    if (found) {
      setHighlightedDisplayNumber(found.display_number);
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.delete('commentId');
      urlParams.set('c', found.display_number.toString());
      window.history.replaceState({}, '', `/c/${token}/comments?${urlParams.toString()}`);
    }
    setPendingLegacyCommentId(null);
  }, [pendingLegacyCommentId, comments, token]);

  const handleAddNote = async (id: number) => {
    if (!newNote.trim()) return;
    const ok = await addNote(id, newNote, addNoteToDecisions);
    if (ok) { setNewNote(''); setAddNoteToDecisions(false); setExpandedComment(null); }
  };

  const handleDeleteComment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) return;
    await deleteComment(id);
  };

  const displayComments = highlightedDisplayNumber ? comments.filter(c => c.display_number === highlightedDisplayNumber) : comments;

  const sortComments = (commentsToSort: Comment[]) => {
    if (sortMode === 'recent') {
      return [...commentsToSort].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortMode === 'resolved-bottom') {
      return [...commentsToSort].sort((a, b) => {
        if (a.status === 'resolved' && b.status === 'open') return 1;
        if (a.status === 'open' && b.status === 'resolved') return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      const priorityOrder = { high: 0, med: 1, low: 2 };
      return [...commentsToSort].sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) return priorityOrder[a.priority] - priorityOrder[b.priority];
        if (a.priority_number !== b.priority_number) return a.priority_number - b.priority_number;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  };

  // Sort and optionally group by page section. resolved-bottom always groups
  // (it's only accessible via URL param); recent and priority respect the checkbox.
  const shouldGroup = sortMode === 'resolved-bottom' || groupByPage;
  const flatHeader = sortMode === 'recent' ? 'Most Recent First' : 'By Priority';
  const groupedComments = shouldGroup
    ? displayComments.reduce((acc, comment) => {
        const pageSection = comment.page_section || 'Unknown';
        if (!acc[pageSection]) acc[pageSection] = [];
        acc[pageSection].push(comment);
        return acc;
      }, {} as Record<string, Comment[]>)
    : { [flatHeader]: sortComments(displayComments) };
  if (shouldGroup) {
    Object.keys(groupedComments).forEach(pageSection => { groupedComments[pageSection] = sortComments(groupedComments[pageSection]); });
  }

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
          {highlightedDisplayNumber && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm text-blue-700">{formatCommentLabel(comments.find(c => c.display_number === highlightedDisplayNumber)?.ref, highlightedDisplayNumber)}</span>
              <button onClick={() => { setHighlightedDisplayNumber(null); setSearchCommentId(''); const urlParams = new URLSearchParams(window.location.search); urlParams.delete('c'); urlParams.delete('commentId'); window.history.replaceState({}, '', urlParams.toString() ? `/c/${token}/comments?${urlParams.toString()}` : `/c/${token}/comments`); }} className="text-blue-700 hover:text-blue-900 font-bold">✕</button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); const q = searchCommentId.trim(); if (!q) return; const foundComment = comments.find(c => (c.ref && c.ref.toLowerCase() === q.toLowerCase()) || (/^\d+$/.test(q) && c.display_number === parseInt(q))); if (foundComment) { setHighlightedDisplayNumber(foundComment.display_number); const urlParams = new URLSearchParams(window.location.search); urlParams.delete('commentId'); urlParams.set('c', foundComment.display_number.toString()); window.history.replaceState({}, '', `/c/${token}/comments?${urlParams.toString()}`); } else { alert(`Comment ${q} not found`); } }} className="hidden sm:flex items-center gap-2">
            <input type="text" value={searchCommentId} onChange={(e) => setSearchCommentId(e.target.value)} placeholder="Jump to ref or #" className="w-28 px-2 py-1 border border-gray-300 rounded text-sm" />
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
                      isHighlighted={highlightedDisplayNumber === comment.display_number}
                      decisionNoteKeys={decisionNoteKeys}
                      expandedComment={expandedComment}
                      newNote={newNote}
                      addNoteToDecisions={addNoteToDecisions}
                      decisionsLink={`/c/${token}/decisions`}
                      copyLinkUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/c/${token}/comments?c=${comment.display_number}`}
                      assignees={assignees}
                      onToggleStatus={toggleStatus}
                      onUpdatePriority={updatePriority}
                      onUpdateAssignee={updateAssignee}
                      onDeleteComment={handleDeleteComment}
                      onExpandImage={(imageData, commentId, displayNumber) => setExpandedImage({ imageData, commentId, displayNumber })}
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
          commentId={expandedImage.commentId}
          displayNumber={expandedImage.displayNumber}
          commentRef={comments.find(c => c.id === expandedImage.commentId)?.ref}
          onClose={() => setExpandedImage(null)}
        />
      )}
    </div>
  );
}

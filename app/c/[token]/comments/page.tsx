'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ClientNav from '@/components/ClientNav';
import CommentsTableView from '@/components/CommentsTableView';
import CommentCard, { Comment } from '@/components/CommentCard';
import ImageModal from '@/components/ImageModal';

interface Project {
  id: number;
  name: string;
}

interface Assignee {
  id: number;
  name: string;
}

export default function ClientCommentsPage() {
  const params = useParams();
  const token = params.token as string;

  const [comments, setComments] = useState<Comment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [sortMode, setSortMode] = useState<'recent' | 'resolved-bottom' | 'priority'>('priority');
  const [isInitialized, setIsInitialized] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
  const [searchCommentId, setSearchCommentId] = useState<string>('');
  const [expandedComment, setExpandedComment] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [addNoteToDecisions, setAddNoteToDecisions] = useState(false);
  const [decisionNoteKeys, setDecisionNoteKeys] = useState<Set<string>>(new Set());

  // Initialize filters from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const statusParam = urlParams.get('status');
    if (statusParam === 'open' || statusParam === 'resolved') setFilter(statusParam);
    const projectParam = urlParams.get('project');
    if (projectParam) setSelectedProject(projectParam);
    const priorityParam = urlParams.get('priority');
    if (priorityParam) setSelectedPriority(priorityParam.toLowerCase());
    const assigneeParam = urlParams.get('assignee');
    if (assigneeParam) setSelectedAssignee(assigneeParam);
    const viewParam = urlParams.get('view');
    if (viewParam === 'table' || viewParam === 'card') setViewMode(viewParam);
    const sortParam = urlParams.get('sort');
    if (sortParam === 'recent' || sortParam === 'resolved-bottom' || sortParam === 'priority') setSortMode(sortParam);
    const commentIdParam = urlParams.get('commentId');
    if (commentIdParam) {
      const id = parseInt(commentIdParam);
      if (!isNaN(id)) setHighlightedCommentId(id);
    }
    setIsInitialized(true);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    if (!isInitialized) return;
    const urlParams = new URLSearchParams();
    if (filter !== 'all') urlParams.set('status', filter);
    if (selectedProject !== 'all') urlParams.set('project', selectedProject);
    if (selectedPriority !== 'all') urlParams.set('priority', selectedPriority);
    if (selectedAssignee !== 'all') urlParams.set('assignee', selectedAssignee);
    if (viewMode !== 'card') urlParams.set('view', viewMode);
    urlParams.set('sort', sortMode);
    const queryString = urlParams.toString();
    const newUrl = queryString ? `/c/${token}/comments?${queryString}` : `/c/${token}/comments`;
    window.history.replaceState({}, '', newUrl);
  }, [filter, selectedProject, selectedPriority, selectedAssignee, viewMode, sortMode, isInitialized, token]);

  // Initial data load
  useEffect(() => {
    if (isInitialized) fetchData();
  }, [token, isInitialized]);

  // Refetch comments when filters change (but not on initial load - fetchData handles that)
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  useEffect(() => {
    if (isInitialized && initialLoadDone) fetchComments();
  }, [filter, selectedProject, selectedPriority, selectedAssignee]);

  const fetchDecisionItems = async () => {
    try {
      const response = await fetch(`/api/decisions?token=${token}`);
      const decisions = await response.json();
      const keys = new Set<string>();
      decisions.forEach((d: any) => {
        if (d.comment_id !== null && d.note_index !== null) keys.add(`${d.comment_id}-${d.note_index}`);
      });
      setDecisionNoteKeys(keys);
    } catch (error) {
      console.error('Error fetching decision items:', error);
    }
  };

  const fetchAssignees = async () => {
    try {
      const response = await fetch(`/api/assignees?token=${token}`);
      if (response.ok) {
        setAssignees(await response.json());
      }
    } catch (error) {
      console.error('Error fetching assignees:', error);
    }
  };

  const fetchData = async () => {
    try {
      const projectsRes = await fetch(`/api/projects?token=${token}`);
      if (!projectsRes.ok) { setError('Invalid access link'); setLoading(false); return; }
      setProjects(await projectsRes.json());
      await fetchComments();
      fetchDecisionItems();
      fetchAssignees();
      setInitialLoadDone(true);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    setLoadedImages(new Set());
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('token', token);
      urlParams.append('excludeImages', 'true');
      const response = await fetch(`/api/comments?${urlParams}`);
      if (!response.ok) { setLoading(false); return; }
      let data = await response.json();
      if (filter !== 'all') data = data.filter((c: Comment) => c.status === filter);
      if (selectedProject !== 'all') data = data.filter((c: Comment) => c.project_id === parseInt(selectedProject));
      if (selectedPriority !== 'all') data = data.filter((c: Comment) => c.priority === selectedPriority);
      if (selectedAssignee !== 'all') data = data.filter((c: Comment) => c.assignee === selectedAssignee);
      setComments(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setLoading(false);
    }
  };

  const displayComments = highlightedCommentId ? comments.filter(c => c.id === highlightedCommentId) : comments;

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

  // Load images progressively
  useEffect(() => {
    if (comments.length === 0 || loading) return;

    let aborted = false;
    const sortedCommentIds = sortComments(displayComments).map(c => c.id);

    const loadImagesSequentially = async () => {
      for (const commentId of sortedCommentIds) {
        if (aborted) break;
        if (loadedImages.has(commentId)) continue;
        try {
          const response = await fetch(`/api/comments/${commentId}`);
          if (aborted) break;
          const { image_data } = await response.json();
          if (aborted) break;
          setComments(prev => prev.map(c => c.id === commentId ? { ...c, image_data } : c));
          setLoadedImages(prev => new Set([...prev, commentId]));
        } catch (error) {
          console.error(`Error loading image for comment ${commentId}:`, error);
        }
      }
    };

    loadImagesSequentially();

    return () => { aborted = true; };
  }, [comments.length, loading, sortMode, highlightedCommentId]);

  const toggleStatus = async (id: number, currentStatus: 'open' | 'resolved') => {
    const newStatus = currentStatus === 'open' ? 'resolved' : 'open';
    try {
      await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, priority_number: newStatus === 'resolved' ? 0 : c.priority_number } : c));
    } catch (err) { console.error('Error updating status:', err); }
  };

  const updatePriority = async (id: number, priority: 'high' | 'med' | 'low', priorityNumber: number) => {
    try {
      await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority, priorityNumber }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, priority, priority_number: priorityNumber } : c));
    } catch (err) { console.error('Error updating priority:', err); }
  };

  const updateAssignee = async (id: number, assignee: string) => {
    try {
      await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignee }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, assignee: assignee as Comment['assignee'] } : c));
    } catch (err) { console.error('Error updating assignee:', err); }
  };

  const addNote = async (id: number) => {
    if (!newNote.trim()) return;
    try {
      await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: newNote }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, text_annotations: [...c.text_annotations, { text: newNote, x: 0, y: 0, color: '#000000' }] } : c));
      if (addNoteToDecisions) {
        const comment = comments.find(c => c.id === id);
        const noteIndex = comment ? comment.text_annotations.length : 0;
        await fetch('/api/decisions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteText: newNote, commentId: id, noteIndex, source: 'comment' }) });
        fetchDecisionItems();
      }
      setNewNote(''); setAddNoteToDecisions(false); setExpandedComment(null);
    } catch (error) { console.error('Error adding note:', error); }
  };

  const deleteComment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) return;
    try {
      await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (err) { console.error('Error deleting comment:', err); }
  };

  const batchUpdatePriority = async (updates: Array<{id: number, priorityNumber: number}>) => {
    try {
      await fetch('/api/comments/batch-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) });
      setComments(prev => prev.map(c => { const update = updates.find(u => u.id === c.id); return update ? { ...c, priority_number: update.priorityNumber } : c; }));
    } catch (err) { console.error('Error batch updating priorities:', err); }
  };

  // Group and sort comments by page section
  const groupedComments = displayComments.reduce((acc, comment) => {
    const pageSection = comment.page_section || 'Unknown';
    if (!acc[pageSection]) acc[pageSection] = [];
    acc[pageSection].push(comment);
    return acc;
  }, {} as Record<string, Comment[]>);
  Object.keys(groupedComments).forEach(pageSection => { groupedComments[pageSection] = sortComments(groupedComments[pageSection]); });

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
      {/* Navigation */}
      <div className="sticky top-0 z-10">
        <ClientNav token={token}>
          {highlightedCommentId && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-sm text-blue-700">#{comments.find(c => c.id === highlightedCommentId)?.display_number || highlightedCommentId}</span>
              <button onClick={() => { setHighlightedCommentId(null); setSearchCommentId(''); const urlParams = new URLSearchParams(window.location.search); urlParams.delete('commentId'); window.history.replaceState({}, '', urlParams.toString() ? `/c/${token}/comments?${urlParams.toString()}` : `/c/${token}/comments`); }} className="text-blue-700 hover:text-blue-900 font-bold">✕</button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); const displayNum = parseInt(searchCommentId); if (!isNaN(displayNum) && displayNum > 0) { const foundComment = comments.find(c => c.display_number === displayNum); if (foundComment) { setHighlightedCommentId(foundComment.id); const urlParams = new URLSearchParams(window.location.search); urlParams.set('commentId', foundComment.id.toString()); window.history.replaceState({}, '', `/c/${token}/comments?${urlParams.toString()}`); } else { alert(`Comment #${displayNum} not found`); } }}} className="flex items-center gap-2">
            <input type="number" value={searchCommentId} onChange={(e) => setSearchCommentId(e.target.value)} placeholder="Jump to #" min="1" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
            <button type="submit" className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Go</button>
          </form>
          <Link href={`/c/${token}`} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">New Comment</Link>
        </ClientNav>
      </div>

      {/* Filters */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex gap-1">
              {(['all', 'open', 'resolved'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded capitalize ${filter === f ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{f}</button>
              ))}
            </div>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded max-w-[200px] truncate">
              <option value="all">All Projects</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded">
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="med">Med</option>
              <option value="low">Low</option>
            </select>
            <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded">
              <option value="all">All Assignees</option>
              <option value="Unassigned">Unassigned</option>
              {assignees.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
            <div className="flex gap-1 border-l pl-3">
              {(['recent', 'resolved-bottom', 'priority'] as const).map((s) => (
                <button key={s} onClick={() => setSortMode(s)} className={`px-3 py-1.5 rounded text-sm ${sortMode === s ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}>
                  {s === 'recent' ? 'Recent' : s === 'resolved-bottom' ? 'Resolved to Bottom' : 'Priority'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12"><p className="text-gray-500">Loading...</p></div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No comments found</p>
            <Link href={`/c/${token}`} className="mt-4 inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Create First Comment</Link>
          </div>
        ) : viewMode === 'table' ? (
          <CommentsTableView comments={displayComments} onUpdatePriority={updatePriority} onUpdateAssignee={updateAssignee} onToggleStatus={toggleStatus} onDeleteComment={deleteComment} onSwitchToCardView={() => setViewMode('card')} onBatchUpdatePriority={batchUpdatePriority} />
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedComments).map(([pageSection, sectionComments]) => (
              <div key={pageSection} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">{pageSection}</h2>
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
                      isHighlighted={highlightedCommentId === comment.id}
                      decisionNoteKeys={decisionNoteKeys}
                      expandedComment={expandedComment}
                      newNote={newNote}
                      addNoteToDecisions={addNoteToDecisions}
                      decisionsLink={`/c/${token}/decisions`}
                      copyLinkUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/c/${token}/comments?commentId=${comment.id}`}
                      assignees={assignees}
                      onToggleStatus={toggleStatus}
                      onUpdatePriority={updatePriority}
                      onUpdateAssignee={updateAssignee}
                      onDeleteComment={deleteComment}
                      onExpandImage={setExpandedImage}
                      onSetExpandedComment={setExpandedComment}
                      onSetNewNote={setNewNote}
                      onSetAddNoteToDecisions={setAddNoteToDecisions}
                      onAddNote={addNote}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {expandedImage && <ImageModal imageData={expandedImage} onClose={() => setExpandedImage(null)} />}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CommentsTableView from '@/components/CommentsTableView';
import CommentCard, { Comment } from '@/components/CommentCard';
import ImageModal from '@/components/ImageModal';

export default function CommentsPage() {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComment, setExpandedComment] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [addNoteToDecisions, setAddNoteToDecisions] = useState(false);
  const [sortMode, setSortMode] = useState<'recent' | 'resolved-bottom' | 'priority'>('priority');
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [isInitialized, setIsInitialized] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
  const [searchCommentId, setSearchCommentId] = useState<string>('');
  const [decisionNoteKeys, setDecisionNoteKeys] = useState<Set<string>>(new Set());

  // Initialize filters from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    if (statusParam === 'open' || statusParam === 'resolved') setFilter(statusParam);
    const projectParam = params.get('project');
    if (projectParam) setSelectedProject(projectParam);
    const priorityParam = params.get('priority');
    if (priorityParam) setSelectedPriority(priorityParam.toLowerCase());
    const assigneeParam = params.get('assignee');
    if (assigneeParam) setSelectedAssignee(assigneeParam);
    const viewParam = params.get('view');
    if (viewParam === 'table' || viewParam === 'card') setViewMode(viewParam);
    const sortParam = params.get('sort');
    if (sortParam === 'recent' || sortParam === 'resolved-bottom' || sortParam === 'priority') setSortMode(sortParam);
    const commentIdParam = params.get('commentId');
    if (commentIdParam) {
      const id = parseInt(commentIdParam);
      if (!isNaN(id)) setHighlightedCommentId(id);
    }
    setIsInitialized(true);
  }, []);

  // Update URL when filters change
  useEffect(() => {
    if (!isInitialized) return;
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (selectedProject !== 'all') params.set('project', selectedProject);
    if (selectedPriority !== 'all') params.set('priority', selectedPriority);
    if (selectedAssignee !== 'all') params.set('assignee', selectedAssignee);
    if (viewMode !== 'card') params.set('view', viewMode);
    params.set('sort', sortMode);
    const queryString = params.toString();
    const newUrl = queryString ? `/comments?${queryString}` : '/comments';
    window.history.replaceState({}, '', newUrl);
  }, [filter, selectedProject, selectedPriority, selectedAssignee, viewMode, sortMode, isInitialized]);

  useEffect(() => {
    if (isInitialized) fetchComments();
  }, [filter, selectedProject, selectedPriority, selectedAssignee, isInitialized]);

  const displayComments = highlightedCommentId ? comments.filter(c => c.id === highlightedCommentId) : comments;

  const fetchDecisionItems = async () => {
    try {
      const response = await fetch('/api/decisions');
      const decisions = await response.json();
      const keys = new Set<string>();
      decisions.forEach((decision: any) => {
        if (decision.comment_id !== null && decision.note_index !== null) {
          keys.add(`${decision.comment_id}-${decision.note_index}`);
        }
      });
      setDecisionNoteKeys(keys);
    } catch (error) {
      console.error('Error fetching decision items:', error);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    setLoadedImages(new Set());
    try {
      const params = new URLSearchParams();
      if (selectedProject !== 'all') params.append('projectName', selectedProject);
      if (filter !== 'all') params.append('status', filter);
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);
      if (selectedAssignee !== 'all') params.append('assignee', selectedAssignee);
      params.append('excludeImages', 'true');

      const response = await fetch(`/api/comments?${params}`);
      const data = await response.json();
      if (!response.ok) { setComments([]); setProjects([]); return; }
      setComments(Array.isArray(data) ? data : []);
      const uniqueProjects = Array.from(new Set(data.map((c: Comment) => c.project_name)));
      setProjects(uniqueProjects as string[]);
      fetchDecisionItems();
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load images progressively
  useEffect(() => {
    if (comments.length === 0 || loading) return;
    const sortedCommentIds = sortComments(displayComments).map(c => c.id);
    const loadImagesSequentially = async () => {
      for (const commentId of sortedCommentIds) {
        if (loadedImages.has(commentId)) continue;
        try {
          const response = await fetch(`/api/comments/${commentId}`);
          const { image_data } = await response.json();
          setComments(prev => prev.map(c => c.id === commentId ? { ...c, image_data } : c));
          setLoadedImages(prev => new Set([...prev, commentId]));
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`Error loading image for comment ${commentId}:`, error);
        }
      }
    };
    loadImagesSequentially();
  }, [displayComments.length, loading, sortMode, highlightedCommentId]);

  const toggleStatus = async (id: number, currentStatus: 'open' | 'resolved') => {
    const newStatus = currentStatus === 'open' ? 'resolved' : 'open';
    try {
      await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, priority_number: newStatus === 'resolved' ? 0 : c.priority_number } : c));
    } catch (error) { console.error('Error updating status:', error); }
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
    } catch (error) { console.error('Error deleting comment:', error); }
  };

  const updatePriority = async (id: number, priority: 'high' | 'med' | 'low', priorityNumber: number) => {
    try {
      await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority, priorityNumber }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, priority, priority_number: priorityNumber } : c));
    } catch (error) { console.error('Error updating priority:', error); }
  };

  const batchUpdatePriority = async (updates: Array<{id: number, priorityNumber: number}>) => {
    try {
      await fetch('/api/comments/batch-update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) });
      setComments(prev => prev.map(c => { const update = updates.find(u => u.id === c.id); return update ? { ...c, priority_number: update.priorityNumber } : c; }));
    } catch (error) { console.error('Error batch updating priorities:', error); }
  };

  const updateAssignee = async (id: number, assignee: string) => {
    try {
      await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignee }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, assignee: assignee as Comment['assignee'] } : c));
    } catch (error) { console.error('Error updating assignee:', error); }
  };

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

  // Group comments by project
  const groupedComments = displayComments.reduce((acc, comment) => {
    if (!acc[comment.project_name]) acc[comment.project_name] = [];
    acc[comment.project_name].push(comment);
    return acc;
  }, {} as Record<string, Comment[]>);
  Object.keys(groupedComments).forEach(projectName => { groupedComments[projectName] = sortComments(groupedComments[projectName]); });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800">Comments</h1>
              {highlightedCommentId && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-700">Viewing comment #{highlightedCommentId}</span>
                  <button onClick={() => { setHighlightedCommentId(null); setSearchCommentId(''); const params = new URLSearchParams(window.location.search); params.delete('commentId'); window.history.replaceState({}, '', params.toString() ? `/comments?${params.toString()}` : '/comments'); }} className="text-blue-700 hover:text-blue-900 font-bold">✕</button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <form onSubmit={(e) => { e.preventDefault(); const id = parseInt(searchCommentId); if (!isNaN(id) && id > 0) { setHighlightedCommentId(id); const params = new URLSearchParams(window.location.search); params.set('commentId', id.toString()); window.history.replaceState({}, '', `/comments?${params.toString()}`); }}} className="flex items-center gap-2">
                <input type="number" value={searchCommentId} onChange={(e) => setSearchCommentId(e.target.value)} placeholder="Jump to #" min="1" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
                <button type="submit" className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm">Go</button>
              </form>
              <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">New Comment</button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex gap-1">
              {(['all', 'open', 'resolved'] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded capitalize ${filter === f ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>{f}</button>
              ))}
            </div>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded max-w-[200px] truncate" title={selectedProject}>
              <option value="all">All Projects</option>
              {projects.map((project) => <option key={project} value={project}>{project}</option>)}
            </select>
            <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded">
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="med">Med</option>
              <option value="low">Low</option>
            </select>
            <select value={selectedAssignee} onChange={(e) => setSelectedAssignee(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded">
              <option value="all">All Assignees</option>
              <option value="dev1">Dev1</option>
              <option value="dev2">Dev2</option>
              <option value="dev3">Dev3</option>
              <option value="Sessions">Sessions</option>
              <option value="Annie">Annie</option>
              <option value="Mari">Mari</option>
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

      {/* Comments List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12"><p className="text-gray-500">Loading...</p></div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No comments found</p>
            <button onClick={() => router.push('/')} className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Create First Comment</button>
          </div>
        ) : viewMode === 'table' ? (
          <CommentsTableView comments={displayComments} onUpdatePriority={updatePriority} onUpdateAssignee={updateAssignee} onToggleStatus={toggleStatus} onDeleteComment={deleteComment} onSwitchToCardView={() => setViewMode('card')} onBatchUpdatePriority={batchUpdatePriority} />
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedComments).map(([projectName, projectComments]) => (
              <div key={projectName} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">{projectName}</h2>
                  <button onClick={() => setViewMode('table')} className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-2" title="Switch to table view">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Table
                  </button>
                </div>
                <div className="space-y-4">
                  {projectComments.map((comment) => (
                    <CommentCard
                      key={comment.id}
                      comment={comment}
                      isHighlighted={highlightedCommentId === comment.id}
                      decisionNoteKeys={decisionNoteKeys}
                      expandedComment={expandedComment}
                      newNote={newNote}
                      addNoteToDecisions={addNoteToDecisions}
                      decisionsLink="/decisions"
                      copyLinkUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/comments?commentId=${comment.id}`}
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

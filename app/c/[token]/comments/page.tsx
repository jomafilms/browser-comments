'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import CommentsTableView from '@/components/CommentsTableView';

interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

interface Comment {
  id: number;
  project_id: number;
  url: string;
  project_name: string;
  image_data: string;
  text_annotations: TextAnnotation[];
  status: 'open' | 'resolved';
  priority: 'high' | 'med' | 'low';
  priority_number: number;
  assignee: 'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari';
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  name: string;
}

export default function ClientCommentsPage() {
  const params = useParams();
  const token = params.token as string;

  const [comments, setComments] = useState<Comment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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

  // Initialize filters from URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);

    const statusParam = urlParams.get('status');
    if (statusParam === 'open' || statusParam === 'resolved') {
      setFilter(statusParam);
    }

    const projectParam = urlParams.get('project');
    if (projectParam) {
      setSelectedProject(projectParam);
    }

    const priorityParam = urlParams.get('priority');
    if (priorityParam) {
      setSelectedPriority(priorityParam.toLowerCase());
    }

    const assigneeParam = urlParams.get('assignee');
    if (assigneeParam) {
      setSelectedAssignee(assigneeParam);
    }

    const viewParam = urlParams.get('view');
    if (viewParam === 'table' || viewParam === 'card') {
      setViewMode(viewParam);
    }

    const sortParam = urlParams.get('sort');
    if (sortParam === 'recent' || sortParam === 'resolved-bottom' || sortParam === 'priority') {
      setSortMode(sortParam);
    }

    const commentIdParam = urlParams.get('commentId');
    if (commentIdParam) {
      const id = parseInt(commentIdParam);
      if (!isNaN(id)) {
        setHighlightedCommentId(id);
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
    if (selectedPriority !== 'all') urlParams.set('priority', selectedPriority);
    if (selectedAssignee !== 'all') urlParams.set('assignee', selectedAssignee);
    if (viewMode !== 'card') urlParams.set('view', viewMode);
    urlParams.set('sort', sortMode);

    const queryString = urlParams.toString();
    const newUrl = queryString ? `/c/${token}/comments?${queryString}` : `/c/${token}/comments`;

    window.history.replaceState({}, '', newUrl);
  }, [filter, selectedProject, selectedPriority, selectedAssignee, viewMode, sortMode, isInitialized, token]);

  useEffect(() => {
    if (!isInitialized) return;
    fetchData();
  }, [token, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    fetchComments();
  }, [filter, selectedProject, selectedPriority, selectedAssignee, isInitialized]);

  const fetchDecisionItems = async () => {
    try {
      const response = await fetch(`/api/decisions?token=${token}`);
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

  const fetchData = async () => {
    try {
      const projectsRes = await fetch(`/api/projects?token=${token}`);
      if (!projectsRes.ok) {
        setError('Invalid access link');
        setLoading(false);
        return;
      }
      const projectsData = await projectsRes.json();
      setProjects(projectsData);

      await fetchComments();
      fetchDecisionItems();
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
      if (!response.ok) {
        setLoading(false);
        return;
      }

      let data = await response.json();

      // Apply client-side filters
      if (filter !== 'all') {
        data = data.filter((c: Comment) => c.status === filter);
      }
      if (selectedProject !== 'all') {
        data = data.filter((c: Comment) => c.project_id === parseInt(selectedProject));
      }
      if (selectedPriority !== 'all') {
        data = data.filter((c: Comment) => c.priority === selectedPriority);
      }
      if (selectedAssignee !== 'all') {
        data = data.filter((c: Comment) => c.assignee === selectedAssignee);
      }

      setComments(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setLoading(false);
    }
  };

  // Filter to show only highlighted comment if commentId is set
  const displayComments = highlightedCommentId
    ? comments.filter(c => c.id === highlightedCommentId)
    : comments;

  // Sort comments based on selected mode
  const sortComments = (commentsToSort: Comment[]) => {
    if (sortMode === 'recent') {
      return [...commentsToSort].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortMode === 'resolved-bottom') {
      return [...commentsToSort].sort((a, b) => {
        if (a.status === 'resolved' && b.status === 'open') return 1;
        if (a.status === 'open' && b.status === 'resolved') return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      const priorityOrder = { high: 0, med: 1, low: 2 };
      return [...commentsToSort].sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.priority_number !== b.priority_number) {
          return a.priority_number - b.priority_number;
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  };

  // Load images progressively after comments are loaded
  useEffect(() => {
    if (comments.length === 0 || loading) return;

    const sortedCommentIds = sortComments(displayComments).map(c => c.id);

    const loadImagesSequentially = async () => {
      for (const commentId of sortedCommentIds) {
        if (loadedImages.has(commentId)) continue;

        try {
          const response = await fetch(`/api/comments/${commentId}`);
          const { image_data } = await response.json();

          setComments(prevComments =>
            prevComments.map(comment =>
              comment.id === commentId
                ? { ...comment, image_data }
                : comment
            )
          );

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
      await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      setComments(prev =>
        prev.map(c => c.id === id ? { ...c, status: newStatus, priority_number: newStatus === 'resolved' ? 0 : c.priority_number } : c)
      );
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const updatePriority = async (id: number, priority: 'high' | 'med' | 'low', priorityNumber: number) => {
    try {
      await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority, priorityNumber }),
      });

      setComments(prev =>
        prev.map(c => c.id === id ? { ...c, priority, priority_number: priorityNumber } : c)
      );
    } catch (err) {
      console.error('Error updating priority:', err);
    }
  };

  const updateAssignee = async (id: number, assignee: string) => {
    try {
      await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee }),
      });

      setComments(prev =>
        prev.map(c => c.id === id ? { ...c, assignee: assignee as Comment['assignee'] } : c)
      );
    } catch (err) {
      console.error('Error updating assignee:', err);
    }
  };

  const addNote = async (id: number) => {
    if (!newNote.trim()) return;

    try {
      await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote }),
      });

      setComments(prevComments =>
        prevComments.map(comment =>
          comment.id === id
            ? {
                ...comment,
                text_annotations: [...comment.text_annotations, { text: newNote, x: 0, y: 0, color: '#000000' }]
              }
            : comment
        )
      );

      if (addNoteToDecisions) {
        const comment = comments.find(c => c.id === id);
        const noteIndex = comment ? comment.text_annotations.length : 0;

        try {
          await fetch('/api/decisions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              noteText: newNote,
              commentId: id,
              noteIndex,
              source: 'comment'
            })
          });

          fetchDecisionItems();
        } catch (error) {
          console.error('Error adding to decision table:', error);
        }
      }

      setNewNote('');
      setAddNoteToDecisions(false);
      setExpandedComment(null);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const deleteComment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) return;

    try {
      await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const batchUpdatePriority = async (updates: Array<{id: number, priorityNumber: number}>) => {
    try {
      await fetch('/api/comments/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });

      setComments(prev =>
        prev.map(c => {
          const update = updates.find(u => u.id === c.id);
          return update ? { ...c, priority_number: update.priorityNumber } : c;
        })
      );
    } catch (err) {
      console.error('Error batch updating priorities:', err);
    }
  };

  // Group comments by project
  const groupedComments = displayComments.reduce((acc, comment) => {
    const projectName = comment.project_name || 'Unknown Project';
    if (!acc[projectName]) {
      acc[projectName] = [];
    }
    acc[projectName].push(comment);
    return acc;
  }, {} as Record<string, Comment[]>);

  // Sort each project's comments
  Object.keys(groupedComments).forEach(projectName => {
    groupedComments[projectName] = sortComments(groupedComments[projectName]);
  });

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
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800">Comments</h1>
              {highlightedCommentId && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm text-blue-700">
                    Viewing comment #{highlightedCommentId}
                  </span>
                  <button
                    onClick={() => {
                      setHighlightedCommentId(null);
                      setSearchCommentId('');
                      const urlParams = new URLSearchParams(window.location.search);
                      urlParams.delete('commentId');
                      const newUrl = urlParams.toString() ? `/c/${token}/comments?${urlParams.toString()}` : `/c/${token}/comments`;
                      window.history.replaceState({}, '', newUrl);
                    }}
                    className="text-blue-700 hover:text-blue-900 font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Search by comment # */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const id = parseInt(searchCommentId);
                  if (!isNaN(id) && id > 0) {
                    setHighlightedCommentId(id);
                    const urlParams = new URLSearchParams(window.location.search);
                    urlParams.set('commentId', id.toString());
                    window.history.replaceState({}, '', `/c/${token}/comments?${urlParams.toString()}`);
                  }
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="number"
                  value={searchCommentId}
                  onChange={(e) => setSearchCommentId(e.target.value)}
                  placeholder="Jump to #"
                  min="1"
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  type="submit"
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                >
                  Go
                </button>
              </form>
              <Link
                href={`/c/${token}`}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                New Comment
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            {/* Status Filter */}
            <div className="flex gap-1">
              {(['all', 'open', 'resolved'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded capitalize ${
                    filter === f ? 'bg-blue-500 text-white' : 'bg-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Project Filter */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded max-w-[200px] truncate"
              title={selectedProject}
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="med">Med</option>
              <option value="low">Low</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded"
            >
              <option value="all">All Assignees</option>
              <option value="dev1">Dev1</option>
              <option value="dev2">Dev2</option>
              <option value="dev3">Dev3</option>
              <option value="Sessions">Sessions</option>
              <option value="Annie">Annie</option>
              <option value="Mari">Mari</option>
            </select>

            {/* Sort Options */}
            <div className="flex gap-1 border-l pl-3">
              <button
                onClick={() => setSortMode('recent')}
                className={`px-3 py-1.5 rounded text-sm ${
                  sortMode === 'recent' ? 'bg-purple-500 text-white' : 'bg-gray-200'
                }`}
              >
                Recent
              </button>
              <button
                onClick={() => setSortMode('resolved-bottom')}
                className={`px-3 py-1.5 rounded text-sm ${
                  sortMode === 'resolved-bottom' ? 'bg-purple-500 text-white' : 'bg-gray-200'
                }`}
              >
                Resolved to Bottom
              </button>
              <button
                onClick={() => setSortMode('priority')}
                className={`px-3 py-1.5 rounded text-sm ${
                  sortMode === 'priority' ? 'bg-purple-500 text-white' : 'bg-gray-200'
                }`}
              >
                Priority
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No comments found</p>
            <Link
              href={`/c/${token}`}
              className="mt-4 inline-block px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Create First Comment
            </Link>
          </div>
        ) : viewMode === 'table' ? (
          <CommentsTableView
            comments={displayComments}
            onUpdatePriority={updatePriority}
            onUpdateAssignee={updateAssignee}
            onToggleStatus={toggleStatus}
            onDeleteComment={deleteComment}
            onSwitchToCardView={() => setViewMode('card')}
            onBatchUpdatePriority={batchUpdatePriority}
          />
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedComments).map(([projectName, projectComments]) => (
              <div key={projectName} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">{projectName}</h2>
                  <button
                    onClick={() => setViewMode('table')}
                    className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-2"
                    title="Switch to table view"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Table
                  </button>
                </div>
                <div className="space-y-4">
                  {projectComments.map((comment) => (
                    <div
                      key={comment.id}
                      id={`comment-${comment.id}`}
                      className={`border rounded-lg overflow-hidden hover:shadow-md transition-all ${
                        highlightedCommentId === comment.id
                          ? 'ring-4 ring-blue-500 shadow-lg'
                          : ''
                      }`}
                    >
                      <div className="flex">
                        {/* Image - 65% width */}
                        <div className="w-[65%] bg-gray-100 flex items-center justify-center p-4">
                          {comment.image_data ? (
                            <img
                              src={comment.image_data}
                              alt="Screenshot"
                              className="max-w-full max-h-[60vh] object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => setExpandedImage(comment.image_data)}
                            />
                          ) : (
                            <div className="text-gray-400 text-sm">Loading image...</div>
                          )}
                        </div>

                        {/* Details - 35% width */}
                        <div className="w-[35%] p-4 flex flex-col">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs font-mono">
                                #{comment.id}
                              </span>
                              <button
                                onClick={() => {
                                  const url = `${window.location.origin}/c/${token}/comments?commentId=${comment.id}`;
                                  navigator.clipboard.writeText(url);
                                  alert('Link copied to clipboard!');
                                }}
                                className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs hover:bg-blue-200"
                                title="Copy link to this comment"
                              >
                                🔗
                              </button>
                              <span
                                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                  comment.status === 'open'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {comment.status}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  comment.priority === 'high'
                                    ? 'bg-red-100 text-red-800'
                                    : comment.priority === 'med'
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {comment.priority.toUpperCase()} {comment.priority_number > 0 ? `#${comment.priority_number}` : ''}
                              </span>
                            </div>
                            <button
                              onClick={() => toggleStatus(comment.id, comment.status)}
                              className="text-sm text-blue-500 hover:underline"
                            >
                              {comment.status === 'open' ? 'Resolve' : 'Reopen'}
                            </button>
                          </div>

                          <div className="flex gap-2 mb-3">
                            <select
                              value={comment.priority}
                              onChange={(e) => updatePriority(comment.id, e.target.value as 'high' | 'med' | 'low', comment.priority_number)}
                              className="text-xs px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="high">High</option>
                              <option value="med">Med</option>
                              <option value="low">Low</option>
                            </select>
                            <input
                              type="number"
                              value={comment.priority_number}
                              onChange={(e) => updatePriority(comment.id, comment.priority, parseInt(e.target.value) || 0)}
                              className="text-sm px-3 py-1 border border-gray-300 rounded w-20 text-center"
                              placeholder="#"
                              min="0"
                              style={{ color: '#000', appearance: 'textfield' }}
                            />
                            <select
                              value={comment.assignee}
                              onChange={(e) => updateAssignee(comment.id, e.target.value)}
                              className="text-xs px-2 py-1 border border-gray-300 rounded"
                            >
                              <option value="dev1">Dev1</option>
                              <option value="dev2">Dev2</option>
                              <option value="dev3">Dev3</option>
                              <option value="Sessions">Sessions</option>
                              <option value="Annie">Annie</option>
                              <option value="Mari">Mari</option>
                            </select>
                          </div>

                          {comment.image_data && (
                            <div className="text-sm text-gray-600 mb-3">
                              <button
                                onClick={() => setExpandedImage(comment.image_data)}
                                className="text-blue-500 hover:underline text-left"
                              >
                                View full size →
                              </button>
                            </div>
                          )}

                          <div className="text-sm text-gray-500 mb-3 pb-3 border-b border-gray-200 flex justify-between items-center">
                            <span>
                              {new Date(comment.created_at).toLocaleDateString()} at{' '}
                              {new Date(comment.created_at).toLocaleTimeString()}
                            </span>
                            <button
                              onClick={() => deleteComment(comment.id)}
                              className="text-xs text-red-500 hover:text-red-700 hover:underline"
                            >
                              delete
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto">
                            <p className="font-semibold text-sm mb-2">Notes:</p>
                            {comment.text_annotations && comment.text_annotations.length > 0 ? (
                              <ul className="space-y-2 text-sm">
                                {comment.text_annotations.map((annotation, idx) => {
                                  const isInDecisions = decisionNoteKeys.has(`${comment.id}-${idx}`);
                                  return (
                                    <li key={idx} className="text-gray-700 flex items-start gap-1.5">
                                      <span className="flex-1">{annotation.text}</span>
                                      {isInDecisions && (
                                        <Link
                                          href={`/c/${token}/decisions`}
                                          className="text-green-600 hover:text-green-700 flex-shrink-0"
                                          title="In decision table"
                                        >
                                          ✓
                                        </Link>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-gray-400 text-sm">No notes</p>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              setExpandedComment(expandedComment === comment.id ? null : comment.id)
                            }
                            className="mt-4 text-sm text-blue-500 hover:underline"
                          >
                            {expandedComment === comment.id ? 'Cancel' : 'Add Note'}
                          </button>

                          {expandedComment === comment.id && (
                            <div className="mt-3">
                              <textarea
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Add a note..."
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                                rows={3}
                              />
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`decision-checkbox-${comment.id}`}
                                  checked={addNoteToDecisions}
                                  onChange={(e) => setAddNoteToDecisions(e.target.checked)}
                                  className="cursor-pointer"
                                />
                                <label
                                  htmlFor={`decision-checkbox-${comment.id}`}
                                  className="text-sm text-gray-700 cursor-pointer"
                                >
                                  Add to decision table
                                </label>
                              </div>
                              <button
                                onClick={() => addNote(comment.id)}
                                className="mt-2 w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                              >
                                Save Note
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-4 right-4 bg-white text-black rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200 z-10"
            >
              ✕
            </button>
            <img
              src={expandedImage}
              alt="Expanded screenshot"
              className="max-w-full max-h-[95vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

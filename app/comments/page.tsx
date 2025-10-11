'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

interface Comment {
  id: number;
  url: string;
  project_name: string;
  image_data: string;
  text_annotations: TextAnnotation[];
  status: 'open' | 'resolved';
  created_at: string;
  updated_at: string;
}

export default function CommentsPage() {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [projects, setProjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedComment, setExpandedComment] = useState<number | null>(null);
  const [newNote, setNewNote] = useState('');
  const [sortMode, setSortMode] = useState<'recent' | 'resolved-bottom'>('recent');

  useEffect(() => {
    fetchComments();
  }, [filter, selectedProject]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedProject !== 'all') params.append('projectName', selectedProject);
      if (filter !== 'all') params.append('status', filter);

      const response = await fetch(`/api/comments?${params}`);
      const data = await response.json();
      setComments(data);

      // Extract unique projects
      const uniqueProjects = Array.from(new Set(data.map((c: Comment) => c.project_name)));
      setProjects(uniqueProjects as string[]);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: number, currentStatus: 'open' | 'resolved') => {
    const newStatus = currentStatus === 'open' ? 'resolved' : 'open';
    try {
      await fetch(`/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      // Update the comment locally instead of refetching to maintain scroll position
      setComments(prevComments =>
        prevComments.map(comment =>
          comment.id === id
            ? { ...comment, status: newStatus }
            : comment
        )
      );
    } catch (error) {
      console.error('Error updating status:', error);
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

      // Update the comment locally instead of refetching to maintain scroll position
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

      setNewNote('');
      setExpandedComment(null);
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const deleteComment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }

    try {
      await fetch(`/api/comments/${id}`, {
        method: 'DELETE',
      });

      // Remove the comment from local state
      setComments(prevComments => prevComments.filter(comment => comment.id !== id));
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment. Please try again.');
    }
  };

  // Sort comments based on selected mode
  const sortComments = (commentsToSort: Comment[]) => {
    if (sortMode === 'recent') {
      // Sort by most recent first
      return [...commentsToSort].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else {
      // Sort with resolved at bottom, open ones by most recent
      return [...commentsToSort].sort((a, b) => {
        if (a.status === 'resolved' && b.status === 'open') return 1;
        if (a.status === 'open' && b.status === 'resolved') return -1;
        // If both same status, sort by most recent
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  };

  // Group comments by project
  const groupedComments = comments.reduce((acc, comment) => {
    if (!acc[comment.project_name]) {
      acc[comment.project_name] = [];
    }
    acc[comment.project_name].push(comment);
    return acc;
  }, {} as Record<string, Comment[]>);

  // Sort each project's comments
  Object.keys(groupedComments).forEach(projectName => {
    groupedComments[projectName] = sortComments(groupedComments[projectName]);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Comments</h1>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              New Comment
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg ${
                  filter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('open')}
                className={`px-4 py-2 rounded-lg ${
                  filter === 'open' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setFilter('resolved')}
                className={`px-4 py-2 rounded-lg ${
                  filter === 'resolved' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                }`}
              >
                Resolved
              </button>
            </div>

            {/* Project Filter */}
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>

            {/* Sort Options */}
            <div className="flex gap-2 border-l pl-4">
              <span className="text-sm text-gray-600 self-center">Sort:</span>
              <button
                onClick={() => setSortMode('recent')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  sortMode === 'recent' ? 'bg-purple-500 text-white' : 'bg-gray-200'
                }`}
              >
                Most Recent
              </button>
              <button
                onClick={() => setSortMode('resolved-bottom')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  sortMode === 'resolved-bottom' ? 'bg-purple-500 text-white' : 'bg-gray-200'
                }`}
              >
                Resolved to Bottom
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No comments found</p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Create First Comment
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedComments).map(([projectName, projectComments]) => (
              <div key={projectName} className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4">{projectName}</h2>
                <div className="space-y-4">
                  {projectComments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="flex">
                        {/* Image - 60-70% width */}
                        <div className="w-[65%] bg-gray-100 flex items-center justify-center p-4">
                          <img
                            src={comment.image_data}
                            alt="Screenshot"
                            className="max-w-full max-h-[60vh] object-contain"
                          />
                        </div>

                        {/* Text/Metadata - 30-40% width */}
                        <div className="w-[35%] p-4 flex flex-col">
                          <div className="flex items-start justify-between mb-2">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                comment.status === 'open'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {comment.status}
                            </span>
                            <button
                              onClick={() => toggleStatus(comment.id, comment.status)}
                              className="text-sm text-blue-500 hover:underline"
                            >
                              {comment.status === 'open' ? 'Resolve' : 'Reopen'}
                            </button>
                          </div>

                          <div className="text-sm text-gray-600 mb-3">
                            <p className="font-semibold">URL:</p>
                            <a
                              href={comment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline truncate block"
                            >
                              {comment.url}
                            </a>
                          </div>

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
                                {comment.text_annotations.map((annotation, idx) => (
                                  <li key={idx} className="text-gray-700">
                                    {annotation.text}
                                  </li>
                                ))}
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
    </div>
  );
}

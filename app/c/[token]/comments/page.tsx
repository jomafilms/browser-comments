'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const token = params.token as string;

  const [comments, setComments] = useState<Comment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('open');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    fetchComments();
  }, [filter, selectedProject]);

  const fetchData = async () => {
    try {
      // Fetch projects first to validate token
      const projectsRes = await fetch(`/api/projects?token=${token}`);
      if (!projectsRes.ok) {
        setError('Invalid access link');
        setLoading(false);
        return;
      }
      const projectsData = await projectsRes.json();
      setProjects(projectsData);

      // Fetch comments
      await fetchComments();
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('token', token);
      params.append('excludeImages', 'true');

      const response = await fetch(`/api/comments?${params}`);
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

      setComments(data);
      setLoading(false);

      // Load images progressively
      loadImages(data);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setLoading(false);
    }
  };

  const loadImages = async (commentsToLoad: Comment[]) => {
    for (const comment of commentsToLoad) {
      if (loadedImages.has(comment.id)) continue;

      try {
        const response = await fetch(`/api/comments/${comment.id}`);
        const { image_data } = await response.json();

        setComments(prev =>
          prev.map(c => c.id === comment.id ? { ...c, image_data } : c)
        );
        setLoadedImages(prev => new Set([...prev, comment.id]));

        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`Error loading image for comment ${comment.id}:`, err);
      }
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

  const deleteComment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

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
            <h1 className="text-2xl font-bold text-gray-800">Comments</h1>
            <div className="flex items-center gap-3">
              <Link
                href={`/c/${token}`}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Projects
              </Link>
              <Link
                href={`/c/${token}/decisions`}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Decisions
              </Link>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
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

            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
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
              Go to Projects
            </Link>
          </div>
        ) : (
          <CommentsTableView
            comments={comments}
            onUpdatePriority={updatePriority}
            onUpdateAssignee={updateAssignee}
            onToggleStatus={toggleStatus}
            onDeleteComment={deleteComment}
            onSwitchToCardView={() => {}}
            onBatchUpdatePriority={batchUpdatePriority}
          />
        )}
      </div>

      {/* Image Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded"
            className="max-w-full max-h-[95vh] object-contain"
          />
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface DecisionItem {
  id: number;
  comment_id: number | null;
  project_id: number | null;
  note_text: string;
  note_index: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

interface Project {
  id: number;
  name: string;
}

export default function ClientDecisionsPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDecisionText, setNewDecisionText] = useState('');
  const [newDecisionSource, setNewDecisionSource] = useState('');
  const [newDecisionProjectId, setNewDecisionProjectId] = useState<string>('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editSource, setEditSource] = useState('');

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      // Validate token and get projects
      const projectsRes = await fetch(`/api/projects?token=${token}`);
      if (!projectsRes.ok) {
        setError('Invalid access link');
        setLoading(false);
        return;
      }
      const projectsData = await projectsRes.json();
      setProjects(projectsData);

      if (projectsData.length > 0) {
        setNewDecisionProjectId(projectsData[0].id.toString());
      }

      // Fetch decisions for this client
      const decisionsRes = await fetch(`/api/decisions?token=${token}`);
      const decisionsData = await decisionsRes.json();
      setDecisions(decisionsData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
      setLoading(false);
    }
  };

  const addDecision = async () => {
    if (!newDecisionText.trim()) {
      alert('Please enter decision text');
      return;
    }

    try {
      await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteText: newDecisionText,
          source: newDecisionSource || 'manual',
          projectId: newDecisionProjectId ? parseInt(newDecisionProjectId) : null
        })
      });

      setNewDecisionText('');
      setNewDecisionSource('');
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      console.error('Error adding decision:', err);
    }
  };

  const deleteDecision = async (id: number) => {
    if (!confirm('Remove this item from decisions?')) return;

    try {
      await fetch(`/api/decisions/${id}`, { method: 'DELETE' });
      setDecisions(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error deleting decision:', err);
    }
  };

  const startEdit = (decision: DecisionItem) => {
    setEditingId(decision.id);
    setEditText(decision.note_text);
    setEditSource(decision.source || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
    setEditSource('');
  };

  const saveEdit = async (id: number) => {
    if (!editText.trim()) {
      alert('Decision text cannot be empty');
      return;
    }

    try {
      await fetch(`/api/decisions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteText: editText,
          source: editSource || 'manual'
        })
      });

      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error('Error updating decision:', err);
    }
  };

  const getProjectName = (projectId: number | null) => {
    if (!projectId) return '—';
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : '—';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading decisions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Decision Table</h1>
            <div className="flex items-center gap-3">
              <Link
                href={`/c/${token}`}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Projects
              </Link>
              <Link
                href={`/c/${token}/comments`}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Comments
              </Link>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                {showAddForm ? 'Cancel' : 'Add Decision'}
              </button>
            </div>
          </div>

          {/* Add Decision Form */}
          {showAddForm && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
              <h3 className="font-semibold mb-3">Add New Decision</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project
                  </label>
                  <select
                    value={newDecisionProjectId}
                    onChange={(e) => setNewDecisionProjectId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Decision / Note
                  </label>
                  <textarea
                    value={newDecisionText}
                    onChange={(e) => setNewDecisionText(e.target.value)}
                    placeholder="Enter decision or note..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source (optional)
                  </label>
                  <input
                    type="text"
                    value={newDecisionSource}
                    onChange={(e) => setNewDecisionSource(e.target.value)}
                    placeholder="e.g., Client meeting, Dev sync..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={addDecision}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                >
                  Add Decision
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {decisions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No decision items yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Add decisions from meetings or mark notes from comments.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Source
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comment #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Decision Note
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {decisions.map((decision) => (
                  <tr key={decision.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {getProjectName(decision.project_id)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        decision.source === 'comment'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {decision.source || 'manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {decision.comment_id ? (
                        <Link
                          href={`/c/${token}/comments?commentId=${decision.comment_id}`}
                          className="text-blue-500 hover:underline font-mono"
                        >
                          #{decision.comment_id}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                      {editingId === decision.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            rows={2}
                          />
                          <input
                            type="text"
                            value={editSource}
                            onChange={(e) => setEditSource(e.target.value)}
                            placeholder="Source (optional)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEdit(decision.id)}
                              className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        decision.note_text
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(decision.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-3">
                        <button
                          onClick={() => startEdit(decision)}
                          className="text-gray-600 hover:text-blue-600"
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteDecision(decision.id)}
                          className="text-gray-600 hover:text-red-600"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

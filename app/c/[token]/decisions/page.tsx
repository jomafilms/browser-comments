'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import AddDecisionForm from './AddDecisionForm';
import DecisionsTable, { DecisionItem } from './DecisionsTable';

interface Project {
  id: number;
  name: string;
  ref_prefix?: string | null;
}

export default function ClientDecisionsPage() {
  const params = useParams();
  const token = params.token as string;

  const [decisions, setDecisions] = useState<DecisionItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('all'); // driven by the header scope pill
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Share the ?project= context with the comments page
  useEffect(() => {
    const projectParam = new URLSearchParams(window.location.search).get('project');
    if (projectParam) setSelectedProject(projectParam);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const url = selectedProject !== 'all'
      ? `/c/${token}/decisions?project=${selectedProject}`
      : `/c/${token}/decisions`;
    window.history.replaceState({}, '', url);
  }, [selectedProject, isInitialized, token]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const addDecision = async (noteText: string, source: string, projectId: number | null) => {
    try {
      await fetch(`/api/decisions?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText, source: source || 'manual', projectId })
      });
      setShowAddForm(false);
      fetchData();
    } catch (err) {
      console.error('Error adding decision:', err);
    }
  };

  const saveEdit = async (id: number, noteText: string, source: string) => {
    try {
      await fetch(`/api/decisions/${id}?token=${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText, source: source || 'manual' })
      });
      fetchData();
    } catch (err) {
      console.error('Error updating decision:', err);
    }
  };

  const deleteDecision = async (id: number) => {
    if (!confirm('Remove this item from decisions?')) return;
    try {
      await fetch(`/api/decisions/${id}?token=${token}`, { method: 'DELETE' });
      setDecisions(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error deleting decision:', err);
    }
  };

  // The scope pill filters decisions like it filters comments
  const visibleDecisions = selectedProject === 'all'
    ? decisions
    : decisions.filter(d => (d.project_id || d.comment_project_id) === parseInt(selectedProject));

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
      <ClientNav
        token={token}
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
      />

      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Decision Table</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              {showAddForm ? 'Cancel' : 'Add Decision'}
            </button>
          </div>

          {showAddForm && (
            <AddDecisionForm
              projects={projects}
              defaultProjectId={
                (selectedProject !== 'all' ? selectedProject : projects[0]?.id.toString()) || ''
              }
              onAdd={addDecision}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {visibleDecisions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No decision items yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Add decisions from meetings or mark notes from comments.
            </p>
          </div>
        ) : (
          <DecisionsTable
            token={token}
            decisions={visibleDecisions}
            projects={projects}
            onSaveEdit={saveEdit}
            onDelete={deleteDecision}
          />
        )}
      </div>
    </div>
  );
}

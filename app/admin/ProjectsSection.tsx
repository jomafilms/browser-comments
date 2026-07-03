'use client';

import { Fragment, useState } from 'react';
import { Client, Project } from './types';
import BrandingEditor from './BrandingEditor';
import ProjectForm from './ProjectForm';

const normalizeUrls = (raw: string) =>
  raw
    .split(',')
    .map((u) => {
      const trimmed = u.trim();
      if (!trimmed) return '';
      return /^https?:\/\//.test(trimmed) ? trimmed : 'https://' + trimmed;
    })
    .filter(Boolean)
    .join(', ');

// Projects CRUD + project token + per-project branding override.
// Session-cookie authed (no admin secret).
export default function ProjectsSection({
  clients,
  projects,
  setProjects,
}: {
  clients: Client[];
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [brandingId, setBrandingId] = useState<number | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (token: string) => `${origin}/c/${token}/comments?status=open&sort=priority`;

  const createProject = async (clientId: number, name: string, url: string) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name, url: normalizeUrls(url) }),
      });
      if (response.ok) {
        const project = await response.json();
        const client = clients.find((c) => c.id === clientId);
        setProjects((prev) => [...prev, { ...project, client_name: client?.name }]);
        setShowForm(false);
      }
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Failed to create project');
    }
  };

  const saveEdit = async (projectId: number) => {
    if (!editName.trim() || !editUrl.trim()) {
      alert('Name and URL are required');
      return;
    }
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, url: editUrl }),
      });
      if (response.ok) {
        const updated = await response.json();
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, name: updated.name, url: updated.url } : p))
        );
        setEditingId(null);
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Failed to update project');
      }
    } catch (err) {
      console.error('Error updating project:', err);
      alert('Failed to update project');
    }
  };

  const deleteProject = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (response.ok) setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project');
    }
  };

  const generateToken = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/regenerate-token`, { method: 'POST' });
      if (response.ok) {
        const { token } = await response.json();
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, token } : p)));
        navigator.clipboard.writeText(token);
        alert('Project token generated and copied! External devs use it in BROWSER_COMMENTS_TOKEN.');
      }
    } catch (err) {
      console.error('Error generating project token:', err);
      alert('Failed to generate project token');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Projects</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          disabled={clients.length === 0}
        >
          {showForm ? 'Cancel' : 'Add Project'}
        </button>
      </div>

      {clients.length === 0 && (
        <p className="text-gray-500 mb-4">Create a client first before adding projects.</p>
      )}

      {showForm && clients.length > 0 && (
        <ProjectForm clients={clients} onCreate={createProject} />
      )}

      {projects.length === 0 ? (
        <p className="text-gray-500">No projects yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project Token</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.map((project) => {
                const isEditing = editingId === project.id;
                return (
                  <Fragment key={project.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">{project.client_name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          project.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            placeholder="URLs (comma-separated)"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          project.url
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {project.token ? (
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-gray-500 font-mono">{project.token.slice(0, 8)}…</code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(project.token!);
                                alert('Project token copied!');
                              }}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                            >
                              Copy Token
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(linkFor(project.token!));
                                alert('Project link copied to clipboard!');
                              }}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-xs"
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => window.open(linkFor(project.token!), '_blank')}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                            >
                              Open
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Regenerate project token? The old token will stop working.')) {
                                  generateToken(project.id);
                                }
                              }}
                              className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                            >
                              Regen
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => generateToken(project.id)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                          >
                            Generate Token
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(project.id)}
                                className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setBrandingId(brandingId === project.id ? null : project.id)}
                                className="px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-xs"
                              >
                                Branding
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(project.id);
                                  setEditName(project.name);
                                  setEditUrl(project.url);
                                }}
                                className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete project "${project.name}"? This will also delete all its comments.`)) {
                                    deleteProject(project.id);
                                  }
                                }}
                                className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {brandingId === project.id && (
                      <tr className="bg-amber-50/40">
                        <td colSpan={5} className="px-4 py-4">
                          <h4 className="font-medium text-gray-700 mb-2 text-sm">
                            Project Branding Override — {project.name}
                          </h4>
                          <BrandingEditor scope="project" id={project.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

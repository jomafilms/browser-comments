'use client';

import { useState } from 'react';
import { Client, Project } from './types';
import BrandingEditor from './BrandingEditor';
import NotificationSettings from '@/components/NotificationSettings';
import ProjectForm from './ProjectForm';
import AccessKeys from './AccessKeys';

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

type Expander = 'access' | 'branding' | 'notifications' | null;

// One client, with its projects nested inside and all credentials behind a
// single "Access & keys" expander. Session-cookie authed.
export default function ClientCard({
  client,
  projects,
  setClients,
  setProjects,
}: {
  client: Client;
  projects: Project[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}) {
  const [expanded, setExpanded] = useState<Expander>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [brandingProjectId, setBrandingProjectId] = useState<number | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (token: string) => `${origin}/c/${token}/comments?status=open&sort=priority`;

  const toggle = (key: Exclude<Expander, null>) => setExpanded(expanded === key ? null : key);

  const createProject = async (clientId: number, name: string, url: string) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, name, url: normalizeUrls(url) }),
      });
      if (response.ok) {
        const project = await response.json();
        setProjects((prev) => [...prev, { ...project, client_name: client.name }]);
        setShowProjectForm(false);
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

  const deleteProject = async (project: Project) => {
    if (!confirm(`Delete project "${project.name}"? This will also delete all its comments.`)) return;
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (response.ok) setProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project');
    }
  };

  const expanderBtn = (key: Exclude<Expander, null>, label: string, colors: string) => (
    <button onClick={() => toggle(key)} className={`px-3 py-1.5 rounded text-sm ${colors}`}>
      {expanded === key ? `Hide ${label}` : label}
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Client header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="font-semibold text-gray-800">{client.name}</h3>
          <p className="text-sm text-gray-500 font-mono">/c/{client.token}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {expanderBtn('access', 'Access & Keys', 'bg-purple-100 text-purple-700 hover:bg-purple-200')}
          {expanderBtn('branding', 'Branding', 'bg-amber-100 text-amber-700 hover:bg-amber-200')}
          {expanderBtn('notifications', 'Notifications', 'bg-teal-100 text-teal-700 hover:bg-teal-200')}
          <button
            onClick={() => window.open(linkFor(client.token), '_blank')}
            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
          >
            Open Portal
          </button>
        </div>
      </div>

      {/* Nested projects */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase">Projects</h4>
          <button
            onClick={() => setShowProjectForm(!showProjectForm)}
            className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
          >
            {showProjectForm ? 'Cancel' : '+ Add Project'}
          </button>
        </div>

        {showProjectForm && <ProjectForm clients={[client]} onCreate={createProject} />}

        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">No projects yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {projects.map((project) => (
              <div key={project.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  {editingId === project.id ? (
                    <div className="flex-1 flex flex-wrap gap-2 min-w-0">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 min-w-[10rem] px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <input
                        type="text"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="URLs (comma-separated)"
                        className="flex-[2] min-w-[14rem] px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {project.name}
                        {project.ref_prefix && (
                          <span className="ml-1.5 text-xs text-gray-400 font-mono">({project.ref_prefix}-…)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate max-w-md">{project.url}</p>
                    </div>
                  )}
                  <div className="flex gap-2 flex-shrink-0">
                    {editingId === project.id ? (
                      <>
                        <button onClick={() => saveEdit(project.id)} className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-xs">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-xs">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setBrandingProjectId(brandingProjectId === project.id ? null : project.id)}
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
                        <button onClick={() => deleteProject(project)} className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs">Delete</button>
                      </>
                    )}
                  </div>
                </div>
                {brandingProjectId === project.id && (
                  <div className="px-3 py-3 bg-amber-50/40 border-t border-gray-100">
                    <h5 className="font-medium text-gray-700 mb-2 text-sm">Project Branding Override — {project.name}</h5>
                    <BrandingEditor scope="project" id={project.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanders */}
      {expanded === 'access' && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-4 bg-purple-50/30">
          <h4 className="font-medium text-gray-700 mb-3">Access &amp; Keys</h4>
          <AccessKeys client={client} projects={projects} setClients={setClients} setProjects={setProjects} />
        </div>
      )}
      {expanded === 'branding' && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-4 bg-amber-50/40">
          <h4 className="font-medium text-gray-700 mb-2">Client Branding Override</h4>
          <BrandingEditor scope="client" id={client.id} />
        </div>
      )}
      {expanded === 'notifications' && (
        <div className="px-4 pb-4 border-t border-gray-200 pt-4 bg-teal-50/40">
          <NotificationSettings token={client.token} />
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Client {
  id: number;
  token: string;
  name: string;
  created_at: string;
}

interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
  client_name?: string;
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const adminSecret = searchParams.get('admin');

  const [isAdmin, setIsAdmin] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin form state
  const [newClientName, setNewClientName] = useState('');
  const [newProjectClientId, setNewProjectClientId] = useState<string>('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectUrl, setNewProjectUrl] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  useEffect(() => {
    if (adminSecret) {
      checkAdmin();
    } else {
      setLoading(false);
    }
  }, [adminSecret]);

  const checkAdmin = async () => {
    try {
      const response = await fetch(`/api/clients?admin=${adminSecret}`);
      if (response.ok) {
        setIsAdmin(true);
        const clientsData = await response.json();
        setClients(clientsData);

        // Fetch all projects
        const projectsRes = await fetch(`/api/projects?admin=${adminSecret}`);
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData);
        }

        if (clientsData.length > 0) {
          setNewProjectClientId(clientsData[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Error checking admin:', err);
    } finally {
      setLoading(false);
    }
  };

  const createClient = async () => {
    if (!newClientName.trim()) {
      alert('Please enter a client name');
      return;
    }

    try {
      const response = await fetch(`/api/clients?admin=${adminSecret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName })
      });

      if (response.ok) {
        const client = await response.json();
        setClients(prev => [...prev, client]);
        setNewClientName('');
        setShowClientForm(false);

        // Show the access link
        const url = `${window.location.origin}/c/${client.token}`;
        alert(`Client created!\n\nAccess link:\n${url}\n\nThis link has been copied to your clipboard.`);
        navigator.clipboard.writeText(url);
      }
    } catch (err) {
      console.error('Error creating client:', err);
      alert('Failed to create client');
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim() || !newProjectUrl.trim() || !newProjectClientId) {
      alert('Please fill in all fields');
      return;
    }

    try {
      let url = newProjectUrl;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const response = await fetch(`/api/projects?admin=${adminSecret}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: parseInt(newProjectClientId),
          name: newProjectName,
          url
        })
      });

      if (response.ok) {
        const project = await response.json();
        const client = clients.find(c => c.id === parseInt(newProjectClientId));
        setProjects(prev => [...prev, { ...project, client_name: client?.name }]);
        setNewProjectName('');
        setNewProjectUrl('');
        setShowProjectForm(false);
      }
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Failed to create project');
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/c/${token}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white p-8 rounded-xl shadow-xl">
          <p className="text-lg text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  // Admin view
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-xl p-8 mb-8">
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-600">Manage clients and projects</p>
          </div>

          {/* Clients Section */}
          <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Clients</h2>
              <button
                onClick={() => setShowClientForm(!showClientForm)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                {showClientForm ? 'Cancel' : 'Add Client'}
              </button>
            </div>

            {showClientForm && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    placeholder="Client name (e.g., Adobe)"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    onKeyDown={(e) => e.key === 'Enter' && createClient()}
                  />
                  <button
                    onClick={createClient}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}

            {clients.length === 0 ? (
              <p className="text-gray-500">No clients yet. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div>
                      <h3 className="font-semibold text-gray-800">{client.name}</h3>
                      <p className="text-sm text-gray-500 font-mono">/c/{client.token}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyLink(client.token)}
                        className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => window.open(`/c/${client.token}`, '_blank')}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Projects Section */}
          <div className="bg-white rounded-xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Projects</h2>
              <button
                onClick={() => setShowProjectForm(!showProjectForm)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                disabled={clients.length === 0}
              >
                {showProjectForm ? 'Cancel' : 'Add Project'}
              </button>
            </div>

            {clients.length === 0 && (
              <p className="text-gray-500 mb-4">Create a client first before adding projects.</p>
            )}

            {showProjectForm && clients.length > 0 && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <div className="space-y-3">
                  <select
                    value={newProjectClientId}
                    onChange={(e) => setNewProjectClientId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Project name (e.g., Mall Map)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={newProjectUrl}
                    onChange={(e) => setNewProjectUrl(e.target.value)}
                    placeholder="URL to review (e.g., example.com/page)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={createProject}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    Create Project
                  </button>
                </div>
              </div>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {projects.map((project) => (
                      <tr key={project.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{project.client_name}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{project.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-xs">{project.url}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Non-admin view - show simple landing
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">Browser Comments</h1>
        <p className="text-gray-600 mb-6">
          Annotate web pages and provide feedback
        </p>
        <p className="text-gray-500 text-sm">
          Use your access link to get started.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white p-8 rounded-xl shadow-xl">
          <p className="text-lg text-gray-700">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

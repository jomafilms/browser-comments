'use client';

import { useState } from 'react';
import { Client, Project } from './types';
import ClientCard from './ClientCard';

// Client list: one card per client with its projects nested inside (the old
// separate all-clients Projects table is gone). Session-cookie authed.
export default function ClientsSection({
  clients,
  projects,
  setClients,
  setProjects,
}: {
  clients: Client[];
  projects: Project[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}) {
  const [newClientName, setNewClientName] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const createClient = async () => {
    if (!newClientName.trim()) {
      alert('Please enter a client name');
      return;
    }
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName }),
      });
      if (response.ok) {
        const client = await response.json();
        setClients((prev) => [...prev, client]);
        setNewClientName('');
        setShowClientForm(false);
        const url = `${origin}/c/${client.token}/comments?status=open&sort=priority`;
        navigator.clipboard.writeText(url);
        alert(`Client created!\n\nAccess link:\n${url}\n\nCopied to your clipboard.`);
      }
    } catch (err) {
      console.error('Error creating client:', err);
      alert('Failed to create client');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6">
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
        <div className="space-y-4">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              projects={projects.filter((p) => p.client_id === client.id)}
              setClients={setClients}
              setProjects={setProjects}
            />
          ))}
        </div>
      )}
    </div>
  );
}

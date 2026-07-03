'use client';

import { useState } from 'react';
import { Client } from './types';

// Add-project form. Self-contained state; unmounts when hidden, so fields reset
// on their own. Calls onCreate with the raw values (parent normalizes URLs).
export default function ProjectForm({
  clients,
  onCreate,
}: {
  clients: Client[];
  onCreate: (clientId: number, name: string, url: string) => void;
}) {
  const [clientId, setClientId] = useState<string>(clients[0]?.id.toString() || '');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const submit = () => {
    if (!name.trim() || !url.trim() || !clientId) {
      alert('Please fill in all fields');
      return;
    }
    onCreate(parseInt(clientId), name, url);
  };

  return (
    <div className="mb-4 p-4 bg-gray-50 rounded-lg border space-y-3">
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
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
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Project name (e.g., Mall Map)"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URLs (comma-separated, e.g. staging.example.com, localhost:3000)"
        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      />
      <button
        onClick={submit}
        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
      >
        Create Project
      </button>
    </div>
  );
}

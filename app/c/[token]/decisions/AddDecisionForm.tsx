'use client';

import { useState } from 'react';

interface Project {
  id: number;
  name: string;
}

// Add-decision form. Self-contained state; parent unmounts it to reset.
export default function AddDecisionForm({
  projects,
  defaultProjectId,
  onAdd,
}: {
  projects: Project[];
  defaultProjectId: string;
  onAdd: (noteText: string, source: string, projectId: number | null) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [projectId, setProjectId] = useState<string>(defaultProjectId);

  const submit = async () => {
    if (!text.trim()) {
      alert('Please enter decision text');
      return;
    }
    await onAdd(text, source, projectId ? parseInt(projectId) : null);
  };

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
      <h3 className="font-semibold mb-3">Add New Decision</h3>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Decision / Note</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter decision or note..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source (optional)</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g., Client meeting, Dev sync..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>
        <button
          onClick={submit}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
        >
          Add Decision
        </button>
      </div>
    </div>
  );
}

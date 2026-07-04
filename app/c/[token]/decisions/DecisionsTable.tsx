'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCommentLabel } from '@/lib/db/refs';

export interface DecisionItem {
  id: number;
  comment_id: number | null;
  project_id: number | null;
  note_text: string;
  note_index: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  comment_display_number: number | null;
  comment_project_id: number | null;
  comment_ref?: string | null; // e.g. "LWF-12"
}

interface Project {
  id: number;
  name: string;
}

// Decisions table with inline editing. Data + mutations stay in the page;
// this renders one already-filtered list.
export default function DecisionsTable({
  token,
  decisions,
  projects,
  onSaveEdit,
  onDelete,
}: {
  token: string;
  decisions: DecisionItem[];
  projects: Project[];
  onSaveEdit: (id: number, noteText: string, source: string) => Promise<void>;
  onDelete: (id: number) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editSource, setEditSource] = useState('');

  const startEdit = (decision: DecisionItem) => {
    setEditingId(decision.id);
    setEditText(decision.note_text);
    setEditSource(decision.source || '');
  };

  const saveEdit = async (id: number) => {
    if (!editText.trim()) {
      alert('Decision text cannot be empty');
      return;
    }
    await onSaveEdit(id, editText, editSource);
    setEditingId(null);
  };

  const getProjectName = (projectId: number | null) => {
    if (!projectId) return '—';
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : '—';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
      <table className="w-full min-w-max md:min-w-0">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comment #</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Decision Note</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {decisions.map((decision) => (
            <tr key={decision.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-700">
                {getProjectName(decision.project_id || decision.comment_project_id)}
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
                    href={decision.comment_display_number
                      ? `/c/${token}/comments?c=${decision.comment_display_number}`
                      : `/c/${token}/comments?commentId=${decision.comment_id}`}
                    className="text-blue-500 hover:underline font-mono"
                  >
                    {formatCommentLabel(decision.comment_ref, decision.comment_display_number, decision.comment_id)}
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
                        onClick={() => setEditingId(null)}
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
                    onClick={() => onDelete(decision.id)}
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
  );
}

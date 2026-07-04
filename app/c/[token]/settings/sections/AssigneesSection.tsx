'use client';

import { useState, useEffect } from 'react';
import ScopeBadge from './ScopeBadge';

// Team assignees CRUD. Client-level, but any token under the client may manage
// them (matches the API's verifyAssigneeScope).

interface Assignee {
  id: number;
  client_id: number;
  name: string;
  created_at: string;
}

export default function AssigneesSection({ token }: { token: string }) {
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const fetchAssignees = async () => {
    try {
      const response = await fetch(`/api/assignees?token=${token}`);
      if (response.ok) setAssignees(await response.json());
    } catch (err) {
      console.error('Error fetching assignees:', err);
    }
  };

  useEffect(() => {
    fetchAssignees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const addAssignee = async () => {
    if (!newAssigneeName.trim()) return;
    setAddingAssignee(true);
    try {
      const response = await fetch(`/api/assignees?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAssigneeName.trim() }),
      });
      if (response.ok) {
        setNewAssigneeName('');
        fetchAssignees();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add assignee');
      }
    } catch (err) {
      console.error('Error adding assignee:', err);
      alert('Failed to add assignee');
    } finally {
      setAddingAssignee(false);
    }
  };

  const deleteAssignee = async (id: number) => {
    if (!confirm('Are you sure you want to delete this assignee?')) return;
    try {
      await fetch(`/api/assignees/${id}?token=${token}`, { method: 'DELETE' });
      fetchAssignees();
    } catch (err) {
      console.error('Error deleting assignee:', err);
    }
  };

  const startEditAssignee = (assignee: Assignee) => {
    setEditingAssignee(assignee.id);
    setEditName(assignee.name);
  };

  const saveEditAssignee = async () => {
    if (!editName.trim() || !editingAssignee) return;
    try {
      const response = await fetch(`/api/assignees/${editingAssignee}?token=${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (response.ok) {
        setEditingAssignee(null);
        setEditName('');
        fetchAssignees();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update assignee');
      }
    } catch (err) {
      console.error('Error updating assignee:', err);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">
        Team Assignees <ScopeBadge label="applies to all projects" />
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Manage the list of people who can be assigned to comments.
      </p>

      {/* Add new assignee */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={newAssigneeName}
          onChange={(e) => setNewAssigneeName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAssignee()}
          placeholder="Enter name..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
        />
        <button
          onClick={addAssignee}
          disabled={addingAssignee || !newAssigneeName.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {addingAssignee ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* Assignees list */}
      {assignees.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No assignees yet. Add your first team member above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignees.map((assignee) => (
            <div
              key={assignee.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              {editingAssignee === assignee.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveEditAssignee()}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded"
                    autoFocus
                  />
                  <button
                    onClick={saveEditAssignee}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingAssignee(null)}
                    className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-gray-800">{assignee.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditAssignee(assignee)}
                      className="p-1 text-gray-500 hover:text-blue-600"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteAssignee(assignee.id)}
                      className="p-1 text-gray-500 hover:text-red-600"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          These assignees will be available in the dropdown when assigning comments.
        </p>
      </div>
    </div>
  );
}

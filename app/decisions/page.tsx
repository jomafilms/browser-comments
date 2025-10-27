'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DecisionItem {
  id: number;
  comment_id: number;
  note_text: string;
  note_index: number;
  created_at: string;
  updated_at: string;
}

interface DecisionWithComment extends DecisionItem {
  comment?: {
    id: number;
    project_name: string;
    priority: string;
    priority_number: number;
    assignee: string;
    status: string;
  };
}

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<DecisionWithComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDecisions();
  }, []);

  const fetchDecisions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/decisions');
      const data = await response.json();

      // Fetch comment details for each decision
      const decisionsWithComments = await Promise.all(
        data.map(async (decision: DecisionItem) => {
          try {
            const commentResponse = await fetch(`/api/comments/${decision.comment_id}`);
            if (commentResponse.ok) {
              const comment = await commentResponse.json();
              return { ...decision, comment };
            }
          } catch (error) {
            console.error(`Error fetching comment ${decision.comment_id}:`, error);
          }
          return decision;
        })
      );

      setDecisions(decisionsWithComments);
    } catch (error) {
      console.error('Error fetching decisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteDecision = async (id: number) => {
    if (!confirm('Remove this item from decisions?')) return;

    try {
      await fetch(`/api/decisions/${id}`, {
        method: 'DELETE'
      });

      setDecisions(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting decision:', error);
    }
  };

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
          <h1 className="text-2xl font-bold text-gray-800">Decision Table</h1>
          <p className="text-sm text-gray-600 mt-1">
            Notes marked as decisions from comments
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {decisions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">No decision items yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Check the boxes next to comment notes to add them here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Comment #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Project
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Assignee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Decision Note
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date Added
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {decisions.map((decision) => (
                  <tr key={decision.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {decision.comment ? (
                        <Link
                          href={`/comments?commentId=${decision.comment_id}`}
                          className="text-blue-500 hover:underline font-mono"
                        >
                          #{decision.comment_id}
                        </Link>
                      ) : (
                        <span className="font-mono text-gray-400">#{decision.comment_id}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {decision.comment?.project_name || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {decision.comment && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            decision.comment.priority === 'high'
                              ? 'bg-red-100 text-red-800'
                              : decision.comment.priority === 'med'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {decision.comment.priority.toUpperCase()}
                          {decision.comment.priority_number > 0 ? ` #${decision.comment.priority_number}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {decision.comment?.assignee || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-md">
                      {decision.note_text}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(decision.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => deleteDecision(decision.id)}
                        className="text-red-500 hover:text-red-700 hover:underline"
                      >
                        Remove
                      </button>
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

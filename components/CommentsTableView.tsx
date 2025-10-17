'use client';

import { useState, useMemo } from 'react';

interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

interface Comment {
  id: number;
  url: string;
  project_name: string;
  image_data: string;
  text_annotations: TextAnnotation[];
  status: 'open' | 'resolved';
  priority: 'high' | 'med' | 'low';
  priority_number: number;
  assignee: 'dev1' | 'dev2' | 'dev3' | 'dev4' | 'Annie' | 'Mari';
  created_at: string;
  updated_at: string;
}

interface CommentsTableViewProps {
  comments: Comment[];
  onUpdatePriority: (id: number, priority: 'high' | 'med' | 'low', priorityNumber: number) => Promise<void>;
  onUpdateAssignee: (id: number, assignee: 'dev1' | 'dev2' | 'dev3' | 'dev4' | 'Annie' | 'Mari') => Promise<void>;
  onToggleStatus: (id: number, currentStatus: 'open' | 'resolved') => Promise<void>;
  onDeleteComment: (id: number) => Promise<void>;
  onSwitchToCardView: () => void;
  onBatchUpdatePriority?: (updates: Array<{id: number, priorityNumber: number}>) => Promise<void>;
}

export default function CommentsTableView({
  comments,
  onUpdatePriority,
  onUpdateAssignee,
  onToggleStatus,
  onDeleteComment,
  onSwitchToCardView,
  onBatchUpdatePriority,
}: CommentsTableViewProps) {
  const [draggedItem, setDraggedItem] = useState<{comment: Comment; priority: string} | null>(null);

  // Group comments by project and then by priority - memoized to recalculate when comments change
  const groupedComments = useMemo(() => {
    const grouped = comments.reduce((acc, comment) => {
      if (!acc[comment.project_name]) {
        acc[comment.project_name] = {
          high: [],
          med: [],
          low: [],
        };
      }
      acc[comment.project_name][comment.priority].push(comment);
      return acc;
    }, {} as Record<string, Record<'high' | 'med' | 'low', Comment[]>>);

    // Sort comments within each priority group by priority_number ASC (1, 2, 3, 4...), then created_at DESC
    Object.keys(grouped).forEach(projectName => {
      ['high', 'med', 'low'].forEach(priority => {
        grouped[projectName][priority as 'high' | 'med' | 'low'].sort((a, b) => {
          if (a.priority_number !== b.priority_number) {
            return a.priority_number - b.priority_number;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
    });

    return grouped;
  }, [comments]);

  const handleDragStart = (comment: Comment, priority: string) => {
    setDraggedItem({ comment, priority });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetComment: Comment, targetPriority: string) => {
    if (!draggedItem || draggedItem.priority !== targetPriority) {
      setDraggedItem(null);
      return;
    }

    // Get all comments in this priority level for this project
    const priorityComments = groupedComments[targetComment.project_name][targetPriority as 'high' | 'med' | 'low'];

    // Find the positions
    const draggedIndex = priorityComments.findIndex(c => c.id === draggedItem.comment.id);
    const targetIndex = priorityComments.findIndex(c => c.id === targetComment.id);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
      setDraggedItem(null);
      return;
    }

    // Reorder the array
    const reorderedComments = [...priorityComments];
    const [movedComment] = reorderedComments.splice(draggedIndex, 1);
    reorderedComments.splice(targetIndex, 0, movedComment);

    // Renumber all items sequentially starting from 1
    const updates = reorderedComments.map((comment, index) => ({
      id: comment.id,
      priorityNumber: index + 1
    }));

    // Use batch update if available, otherwise update individually
    if (onBatchUpdatePriority) {
      await onBatchUpdatePriority(updates);
    } else {
      // Fallback: update each item individually
      for (const update of updates) {
        await onUpdatePriority(update.id, draggedItem.comment.priority, update.priorityNumber);
      }
    }

    setDraggedItem(null);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-gray-800';
      case 'med': return 'border-l-4 border-gray-500';
      case 'low': return 'border-l-4 border-gray-300';
      default: return '';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'med': return 'bg-orange-100 text-orange-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return '';
    }
  };

  return (
    <div className="space-y-8">
      {Object.entries(groupedComments).map(([projectName, priorityGroups]) => (
        <div key={projectName} className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-800">{projectName}</h2>
            <button
              onClick={onSwitchToCardView}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded flex items-center gap-2"
              title="Switch to card view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Cards
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Thumbnail
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    P#
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Assignee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                    Delete
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Primary Note
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(['high', 'med', 'low'] as const).map(priority => (
                  priorityGroups[priority].map((comment, index) => (
                    <tr
                      key={comment.id}
                      draggable
                      onDragStart={() => handleDragStart(comment, priority)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(comment, priority)}
                      className={`${getPriorityColor(priority)} bg-gray-50 hover:bg-white cursor-move transition-colors ${
                        draggedItem?.comment.id === comment.id ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-3">
                        {comment.image_data ? (
                          <img
                            src={comment.image_data}
                            alt="Comment thumbnail"
                            className="w-16 h-16 object-cover rounded border border-gray-300"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded border border-gray-300 flex items-center justify-center text-xs text-gray-400">
                            Loading...
                          </div>
                        )}
                      </td>

                      {/* Comment # */}
                      <td className="px-4 py-3 text-sm font-mono text-gray-700">
                        #{comment.id}
                      </td>

                      {/* Priority toggle buttons */}
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdatePriority(comment.id, 'high', comment.priority_number);
                            }}
                            className={`px-2 py-1 text-xs rounded font-semibold ${
                              comment.status === 'resolved'
                                ? 'bg-gray-200 text-gray-400'
                                : comment.priority === 'high'
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            Hi
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdatePriority(comment.id, 'med', comment.priority_number);
                            }}
                            className={`px-2 py-1 text-xs rounded font-semibold ${
                              comment.status === 'resolved'
                                ? 'bg-gray-200 text-gray-400'
                                : comment.priority === 'med'
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            Me
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdatePriority(comment.id, 'low', comment.priority_number);
                            }}
                            className={`px-2 py-1 text-xs rounded font-semibold ${
                              comment.status === 'resolved'
                                ? 'bg-gray-200 text-gray-400'
                                : comment.priority === 'low'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            Lo
                          </button>
                        </div>
                      </td>

                      {/* Priority # */}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={comment.priority_number}
                          onChange={(e) => onUpdatePriority(comment.id, comment.priority, parseInt(e.target.value) || 0)}
                          className="text-xs px-2 py-1 border border-gray-300 rounded w-full"
                          min="0"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>

                      {/* Assignee dropdown */}
                      <td className="px-4 py-3">
                        <select
                          value={comment.assignee}
                          onChange={(e) => onUpdateAssignee(comment.id, e.target.value as 'dev1' | 'dev2' | 'dev3' | 'dev4' | 'Annie' | 'Mari')}
                          className="text-xs px-2 py-1 border border-gray-300 rounded w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="dev1">Dev1</option>
                          <option value="dev2">Dev2</option>
                          <option value="dev3">Dev3</option>
                          <option value="dev4">Dev4</option>
                          <option value="Annie">Annie</option>
                          <option value="Mari">Mari</option>
                        </select>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleStatus(comment.id, comment.status);
                          }}
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            comment.status === 'open'
                              ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-800 hover:bg-green-200'
                          }`}
                        >
                          {comment.status}
                        </button>
                      </td>

                      {/* Delete button */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteComment(comment.id);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </td>

                      {/* Primary Note */}
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {comment.text_annotations && comment.text_annotations.length > 0
                          ? comment.text_annotations[0].text
                          : <span className="text-gray-400 italic">No notes</span>
                        }
                      </td>
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

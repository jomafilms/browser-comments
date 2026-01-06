'use client';

import Link from 'next/link';

interface TextAnnotation {
  text: string;
  x: number;
  y: number;
  color: string;
}

export interface Comment {
  id: number;
  project_id?: number;
  display_number: number;
  url: string;
  page_section: string;
  image_data: string;
  text_annotations: TextAnnotation[];
  status: 'open' | 'resolved';
  priority: 'high' | 'med' | 'low';
  priority_number: number;
  assignee: string;
  created_at: string;
  updated_at: string;
}

export interface Assignee {
  id: number;
  name: string;
}

interface CommentCardProps {
  comment: Comment;
  isHighlighted?: boolean;
  decisionNoteKeys: Set<string>;
  expandedComment: number | null;
  newNote: string;
  addNoteToDecisions: boolean;
  decisionsLink: string;
  copyLinkUrl: string;
  assignees: Assignee[];
  onToggleStatus: (id: number, status: 'open' | 'resolved') => void;
  onUpdatePriority: (id: number, priority: 'high' | 'med' | 'low', priorityNumber: number) => void;
  onUpdateAssignee: (id: number, assignee: string) => void;
  onDeleteComment: (id: number) => void;
  onExpandImage: (imageData: string) => void;
  onSetExpandedComment: (id: number | null) => void;
  onSetNewNote: (note: string) => void;
  onSetAddNoteToDecisions: (value: boolean) => void;
  onAddNote: (id: number) => void;
}

export default function CommentCard({
  comment,
  isHighlighted = false,
  decisionNoteKeys,
  expandedComment,
  newNote,
  addNoteToDecisions,
  decisionsLink,
  copyLinkUrl,
  assignees,
  onToggleStatus,
  onUpdatePriority,
  onUpdateAssignee,
  onDeleteComment,
  onExpandImage,
  onSetExpandedComment,
  onSetNewNote,
  onSetAddNoteToDecisions,
  onAddNote,
}: CommentCardProps) {
  return (
    <div
      id={`comment-${comment.id}`}
      className={`border rounded-lg overflow-hidden hover:shadow-md transition-all ${
        isHighlighted ? 'ring-4 ring-blue-500 shadow-lg' : ''
      }`}
    >
      <div className="flex">
        {/* Image - 65% width */}
        <div className="w-[65%] bg-gray-100 flex items-center justify-center p-4">
          {comment.image_data ? (
            <img
              src={comment.image_data}
              alt="Screenshot"
              className="max-w-full max-h-[60vh] object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onExpandImage(comment.image_data)}
            />
          ) : (
            <div className="text-gray-400 text-sm">Loading image...</div>
          )}
        </div>

        {/* Details - 35% width */}
        <div className="w-[35%] p-4 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs font-mono">
                #{comment.display_number || comment.id}
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(copyLinkUrl);
                  alert('Link copied to clipboard!');
                }}
                className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs hover:bg-blue-200"
                title="Copy link to this comment"
              >
                🔗
              </button>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  comment.status === 'open'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {comment.status}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  comment.priority === 'high'
                    ? 'bg-red-100 text-red-800'
                    : comment.priority === 'med'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {comment.priority.toUpperCase()} {comment.priority_number > 0 ? `#${comment.priority_number}` : ''}
              </span>
            </div>
            <button
              onClick={() => onToggleStatus(comment.id, comment.status)}
              className="text-sm text-blue-500 hover:underline"
            >
              {comment.status === 'open' ? 'Resolve' : 'Reopen'}
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <select
              value={comment.priority}
              onChange={(e) => onUpdatePriority(comment.id, e.target.value as 'high' | 'med' | 'low', comment.priority_number)}
              className="text-xs px-2 py-1 border border-gray-300 rounded"
            >
              <option value="high">High</option>
              <option value="med">Med</option>
              <option value="low">Low</option>
            </select>
            <input
              type="number"
              value={comment.priority_number}
              onChange={(e) => onUpdatePriority(comment.id, comment.priority, parseInt(e.target.value) || 0)}
              className="text-sm px-3 py-1 border border-gray-300 rounded w-20 text-center"
              placeholder="#"
              min="0"
              style={{ color: '#000', appearance: 'textfield' }}
            />
            <select
              value={comment.assignee}
              onChange={(e) => onUpdateAssignee(comment.id, e.target.value)}
              className="text-xs px-2 py-1 border border-gray-300 rounded"
            >
              <option value="Unassigned">Unassigned</option>
              {assignees.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          {comment.image_data && (
            <div className="text-sm text-gray-600 mb-3">
              <button
                onClick={() => onExpandImage(comment.image_data)}
                className="text-blue-500 hover:underline text-left"
              >
                View full size →
              </button>
            </div>
          )}

          <div className="text-sm text-gray-500 mb-3 pb-3 border-b border-gray-200 flex justify-between items-center">
            <span>
              {new Date(comment.created_at).toLocaleDateString()} at{' '}
              {new Date(comment.created_at).toLocaleTimeString()}
            </span>
            <button
              onClick={() => onDeleteComment(comment.id)}
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
            >
              delete
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <p className="font-semibold text-sm mb-2">Notes:</p>
            {comment.text_annotations && comment.text_annotations.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {comment.text_annotations.map((annotation, idx) => {
                  const isInDecisions = decisionNoteKeys.has(`${comment.id}-${idx}`);
                  return (
                    <li key={idx} className="text-gray-700 flex items-start gap-1.5">
                      <span className="flex-1">{annotation.text}</span>
                      {isInDecisions && (
                        <Link
                          href={decisionsLink}
                          className="text-green-600 hover:text-green-700 flex-shrink-0"
                          title="In decision table"
                        >
                          ✓
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-400 text-sm">No notes</p>
            )}
          </div>

          <button
            onClick={() =>
              onSetExpandedComment(expandedComment === comment.id ? null : comment.id)
            }
            className="mt-4 text-sm text-blue-500 hover:underline"
          >
            {expandedComment === comment.id ? 'Cancel' : 'Add Note'}
          </button>

          {expandedComment === comment.id && (
            <div className="mt-3">
              <textarea
                value={newNote}
                onChange={(e) => onSetNewNote(e.target.value)}
                placeholder="Add a note..."
                className="w-full px-3 py-2 border rounded-lg text-sm"
                rows={3}
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`decision-checkbox-${comment.id}`}
                  checked={addNoteToDecisions}
                  onChange={(e) => onSetAddNoteToDecisions(e.target.checked)}
                  className="cursor-pointer"
                />
                <label
                  htmlFor={`decision-checkbox-${comment.id}`}
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Add to decision table
                </label>
              </div>
              <button
                onClick={() => onAddNote(comment.id)}
                className="mt-2 w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
              >
                Save Note
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

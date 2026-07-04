'use client';

import { useState, useEffect, useCallback } from 'react';
import { Comment } from '@/components/CommentCard';

// Data + mutation layer for the client comments page, extracted so the page
// stays presentational (and under the file-size cap). Behavior is a straight
// port: one full fetch per filter change (images excluded), then screenshots
// stream in via the batch endpoint for the comments currently displayed.

export interface Project {
  id: number;
  name: string;
  ref_prefix?: string | null;
}

export interface Assignee {
  id: number;
  name: string;
}

export interface CommentsFilters {
  status: 'all' | 'open' | 'resolved';
  project: string; // 'all' | project id as string
  page: string;
  priority: string;
  assignee: string;
  device: string;
}

interface Options {
  enabled: boolean; // wait until the page has parsed its URL params
  filters: CommentsFilters;
  sortMode: string;
  highlightedDisplayNumber: number | null;
}

export function useClientComments(token: string, opts: Options) {
  const { enabled, filters, sortMode, highlightedDisplayNumber } = opts;

  const [comments, setComments] = useState<Comment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pageSections, setPageSections] = useState<string[]>([]);
  const [availableDevices, setAvailableDevices] = useState<string[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [decisionNoteKeys, setDecisionNoteKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const fetchDecisionItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/decisions?token=${token}`);
      const decisions = await response.json();
      const keys = new Set<string>();
      decisions.forEach((d: { comment_id: number | null; note_index: number | null }) => {
        if (d.comment_id !== null && d.note_index !== null) keys.add(`${d.comment_id}-${d.note_index}`);
      });
      setDecisionNoteKeys(keys);
    } catch (error) {
      console.error('Error fetching decision items:', error);
    }
  }, [token]);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setLoadedImages(new Set());
    try {
      const urlParams = new URLSearchParams();
      urlParams.append('token', token);
      urlParams.append('excludeImages', 'true');
      const response = await fetch(`/api/comments?${urlParams}`);
      if (!response.ok) { setLoading(false); return; }
      let data = await response.json();
      // Extract unique page sections + device categories before filtering
      const uniquePages = [...new Set(data.map((c: Comment) => c.page_section).filter(Boolean))] as string[];
      setPageSections(uniquePages.sort());
      const uniqueDevices = [...new Set(data.map((c: Comment) => c.device_category).filter(Boolean))] as string[];
      setAvailableDevices(uniqueDevices.sort());
      if (filters.status !== 'all') data = data.filter((c: Comment) => c.status === filters.status);
      if (filters.project !== 'all') data = data.filter((c: Comment) => c.project_id === parseInt(filters.project));
      if (filters.page !== 'all') data = data.filter((c: Comment) => c.page_section === filters.page);
      if (filters.priority !== 'all') data = data.filter((c: Comment) => c.priority === filters.priority);
      if (filters.assignee !== 'all') data = data.filter((c: Comment) => c.assignee === filters.assignee);
      if (filters.device !== 'all') data = data.filter((c: Comment) => c.device_category === filters.device);
      setComments(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching comments:', err);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filters.status, filters.project, filters.page, filters.priority, filters.assignee, filters.device]);

  // Initial data load
  useEffect(() => {
    if (!enabled) return;
    (async () => {
      try {
        const projectsRes = await fetch(`/api/projects?token=${token}`);
        if (!projectsRes.ok) { setError('Invalid access link'); setLoading(false); return; }
        setProjects(await projectsRes.json());
        await fetchComments();
        fetchDecisionItems();
        fetch(`/api/assignees?token=${token}`)
          .then((r) => (r.ok ? r.json() : []))
          .then((a) => Array.isArray(a) && setAssignees(a))
          .catch((e) => console.error('Error fetching assignees:', e));
        setInitialLoadDone(true);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled]);

  // Refetch comments when filters change (but not on initial load)
  useEffect(() => {
    if (enabled && initialLoadDone) fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.project, filters.page, filters.priority, filters.assignee, filters.device]);

  // Load screenshots in bulk batches for the comments currently displayed
  useEffect(() => {
    if (comments.length === 0 || loading) return;

    let aborted = false;
    const displayed = highlightedDisplayNumber
      ? comments.filter(c => c.display_number === highlightedDisplayNumber)
      : comments;
    const idsToLoad = displayed.map(c => c.id).filter(id => !loadedImages.has(id));
    if (idsToLoad.length === 0) return;

    const loadImageBatch = async (ids: number[]) => {
      try {
        const response = await fetch('/api/comments/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, token }),
        });
        if (aborted) return;
        const { images } = await response.json();
        if (aborted || !images) return;
        setComments(prev => prev.map(c => {
          const imageData = images[c.id];
          return imageData ? { ...c, image_data: imageData } : c;
        }));
        setLoadedImages(prev => new Set([...prev, ...Object.keys(images).map(Number)]));
      } catch (error) {
        console.error('Error loading images:', error);
      }
    };

    // Load in batches of 10 (single request per batch)
    (async () => {
      for (let i = 0; i < idsToLoad.length; i += 10) {
        if (aborted) break;
        await loadImageBatch(idsToLoad.slice(i, i + 10));
      }
    })();

    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length, loading, sortMode, highlightedDisplayNumber]);

  // --- Mutations (optimistic local updates, same as before the extraction) ---

  const toggleStatus = async (id: number, currentStatus: 'open' | 'resolved') => {
    const newStatus = currentStatus === 'open' ? 'resolved' : 'open';
    try {
      await fetch(`/api/comments/${id}?token=${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, status: newStatus, priority_number: newStatus === 'resolved' ? 0 : c.priority_number } : c));
    } catch (err) { console.error('Error updating status:', err); }
  };

  const updatePriority = async (id: number, priority: 'high' | 'med' | 'low', priorityNumber: number) => {
    try {
      await fetch(`/api/comments/${id}?token=${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority, priorityNumber }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, priority, priority_number: priorityNumber } : c));
    } catch (err) { console.error('Error updating priority:', err); }
  };

  const updateAssignee = async (id: number, assignee: string) => {
    try {
      await fetch(`/api/comments/${id}?token=${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignee }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, assignee: assignee as Comment['assignee'] } : c));
    } catch (err) { console.error('Error updating assignee:', err); }
  };

  const addNote = async (id: number, noteText: string, alsoDecision: boolean) => {
    try {
      await fetch(`/api/comments/${id}?token=${token}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: noteText }) });
      setComments(prev => prev.map(c => c.id === id ? { ...c, text_annotations: [...c.text_annotations, { text: noteText, x: 0, y: 0, color: '#000000' }] } : c));
      if (alsoDecision) {
        const comment = comments.find(c => c.id === id);
        const noteIndex = comment ? comment.text_annotations.length : 0;
        await fetch(`/api/decisions?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteText, commentId: id, noteIndex, source: 'comment', projectId: comment?.project_id || null }) });
        fetchDecisionItems();
      }
      return true;
    } catch (error) {
      console.error('Error adding note:', error);
      return false;
    }
  };

  const deleteComment = async (id: number) => {
    try {
      await fetch(`/api/comments/${id}?token=${token}`, { method: 'DELETE' });
      setComments(prev => prev.filter(c => c.id !== id));
    } catch (err) { console.error('Error deleting comment:', err); }
  };

  const batchUpdatePriority = async (updates: Array<{ id: number, priorityNumber: number }>) => {
    try {
      await fetch(`/api/comments/batch-update?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updates }) });
      setComments(prev => prev.map(c => { const update = updates.find(u => u.id === c.id); return update ? { ...c, priority_number: update.priorityNumber } : c; }));
    } catch (err) { console.error('Error batch updating priorities:', err); }
  };

  return {
    comments, projects, pageSections, availableDevices, assignees, decisionNoteKeys,
    loading, error,
    toggleStatus, updatePriority, updateAssignee, addNote, deleteComment, batchUpdatePriority,
  };
}

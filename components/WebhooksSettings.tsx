'use client';

import { useState, useEffect, useCallback } from 'react';

interface Webhook {
  id: number;
  project_id: number | null;
  url: string;
  events: string[];
  active: boolean;
  last_status: number | null;
  last_fired_at: string | null;
  created_at: string;
}

const ALL_EVENTS = ['comment.created', 'comment.updated'];

// Minimal add/remove UI for outbound webhooks. Beauty is the ui-rethink lane's
// job — this is the functional surface. See docs/AGENT-SETUP.md for wiring.
export default function WebhooksSettings({ token }: { token: string }) {
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['comment.created']);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The signing secret is returned once, on creation — surface it until dismissed.
  const [revealed, setRevealed] = useState<{ id: number; secret: string } | null>(null);

  const fetchHooks = useCallback(async () => {
    try {
      const res = await fetch(`/api/webhooks?token=${token}`);
      if (res.ok) setHooks(await res.json());
    } catch {
      /* leave list as-is */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  const toggleEvent = (e: string) =>
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const addWebhook = async () => {
    setError(null);
    if (!url.trim() || events.length === 0) {
      setError('A URL and at least one event are required.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, url: url.trim(), events }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to add webhook.');
        return;
      }
      setRevealed({ id: data.id, secret: data.secret });
      setUrl('');
      setEvents(['comment.created']);
      fetchHooks();
    } catch {
      setError('Failed to add webhook.');
    } finally {
      setCreating(false);
    }
  };

  const deleteWebhook = async (id: number) => {
    if (!confirm('Delete this webhook? Deliveries to it will stop immediately.')) return;
    await fetch(`/api/webhooks?token=${token}&id=${id}`, { method: 'DELETE' });
    if (revealed?.id === id) setRevealed(null);
    fetchHooks();
  };

  const statusLabel = (h: Webhook) => {
    if (h.last_status === null) return { text: 'never fired', cls: 'text-gray-400' };
    if (h.last_status === 0) return { text: 'delivery failed', cls: 'text-red-600' };
    if (h.last_status >= 200 && h.last_status < 300) return { text: `ok (${h.last_status})`, cls: 'text-green-600' };
    return { text: `error (${h.last_status})`, cls: 'text-red-600' };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Webhooks</h3>
      <p className="text-sm text-gray-600 mb-6">
        Get a signed POST when a ticket is created or updated. See the Agent Setup
        docs for verifying signatures and wiring this to an agent.
      </p>

      {/* Reveal-once secret */}
      {revealed && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800 mb-1">
            Signing secret (shown once — copy it now):
          </p>
          <code className="block bg-white border rounded p-2 font-mono text-xs break-all text-gray-800">
            {revealed.secret}
          </code>
          <button onClick={() => setRevealed(null)} className="mt-2 text-xs text-amber-700 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Add form */}
      <div className="space-y-3 mb-6">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-agent.example.com/hook"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
        />
        <div className="flex gap-4">
          {ALL_EVENTS.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={events.includes(e)} onChange={() => toggleEvent(e)} />
              {e}
            </label>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={addWebhook}
          disabled={creating}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {creating ? 'Adding...' : 'Add Webhook'}
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading webhooks...</p>
      ) : hooks.length === 0 ? (
        <p className="text-sm text-gray-500">No webhooks yet.</p>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => {
            const s = statusLabel(h);
            return (
              <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm text-gray-800 truncate">{h.url}</p>
                  <p className="text-xs text-gray-500">
                    {h.events.join(', ')} · <span className={s.cls}>{s.text}</span>
                    {h.project_id === null ? ' · all projects' : ` · project ${h.project_id}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteWebhook(h.id)}
                  className="p-1 text-gray-500 hover:text-red-600 flex-shrink-0"
                  title="Delete"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

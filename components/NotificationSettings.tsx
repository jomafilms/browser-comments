'use client';

import { useState, useEffect, useCallback } from 'react';

// Email notification preferences for a client. Uses the client token, so it
// works both on the client settings page (magic-link token) and in the admin
// client editor (client token). Notifications are opt-in — default off.

type NewTicketMode = 'instant' | 'digest' | 'off';
type DigestCadence = 'hourly' | 'daily';

interface Settings {
  recipients: string[];
  newTicket: NewTicketMode;
  digestCadence: DigestCadence;
  resolvedNotice: boolean;
}

const DEFAULTS: Settings = {
  recipients: [],
  newTicket: 'off',
  digestCadence: 'daily',
  resolvedNotice: false,
};

export default function NotificationSettings({ token }: { token: string }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [recipientsText, setRecipientsText] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        const s: Settings = { ...DEFAULTS, ...data.settings };
        setSettings(s);
        setRecipientsText((s.recipients || []).join(', '));
        setReadOnly(!!data.readOnly);
      }
    } catch {
      /* leave defaults */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    const recipients = recipientsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch(`/api/notifications?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, recipients }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const s: Settings = { ...DEFAULTS, ...data.settings };
        setSettings(s);
        setRecipientsText((s.recipients || []).join(', '));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save notification settings');
      }
    } catch {
      setError('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Loading notifications…</p>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Email Notifications</h3>
      <p className="text-sm text-gray-600 mb-6">
        Get emailed when new feedback comes in. Off by default — add recipients and choose a mode to enable.
      </p>

      {readOnly && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Notifications are client-level. Open the client (not project) settings link to change them.
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-6">
        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipients</label>
          <textarea
            value={recipientsText}
            onChange={(e) => setRecipientsText(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Comma- or newline-separated. Max 20.</p>
        </div>

        {/* New ticket mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New feedback</label>
          <select
            value={settings.newTicket}
            onChange={(e) => setSettings({ ...settings, newTicket: e.target.value as NewTicketMode })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="off">Off — no new-ticket emails</option>
            <option value="instant">Instant — email on every new ticket</option>
            <option value="digest">Digest — roll new tickets into a summary</option>
          </select>
        </div>

        {/* Digest cadence (only relevant for digest mode) */}
        {settings.newTicket === 'digest' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Digest frequency</label>
            <select
              value={settings.digestCadence}
              onChange={(e) =>
                setSettings({ ...settings, digestCadence: e.target.value as DigestCadence })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="daily">Daily (morning summary)</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>
        )}

        {/* Resolved notice */}
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={settings.resolvedNotice}
            onChange={(e) => setSettings({ ...settings, resolvedNotice: e.target.checked })}
          />
          Email recipients when a ticket is resolved
        </label>
      </fieldset>

      {!readOnly && (
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving…' : 'Save notifications'}
          </button>
          {saved && <span className="text-green-600 text-sm">✓ Saved</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
      )}
    </div>
  );
}

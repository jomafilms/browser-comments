'use client';

import { useState, useEffect } from 'react';

interface Branding {
  companyName?: string;
  logoUrl?: string;
  supportEmail?: string;
}

// Reusable branding form for any level: instance (no id), a client, or a
// project. Reads the raw (unmerged) value for that level and saves it back.
// Empty fields clear the override so a lower level falls through to the parent.
export default function BrandingEditor({
  scope,
  id,
}: {
  scope: 'instance' | 'client' | 'project';
  id?: number;
}) {
  const [branding, setBranding] = useState<Branding>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query =
    scope === 'instance' ? '?scope=instance' : `?scope=${scope}&id=${id}`;

  useEffect(() => {
    let active = true;
    fetch(`/api/branding${query}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (active) {
          setBranding(data || {});
          setLoading(false);
        }
      })
      .catch(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, id]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, id, branding }),
      });
      if (res.ok) {
        setBranding(await res.json());
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save branding');
      }
    } catch {
      setError('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof Branding, value: string) =>
    setBranding((b) => ({ ...b, [key]: value }));

  if (loading) {
    return <p className="text-sm text-gray-400">Loading branding…</p>;
  }

  const parentHint =
    scope === 'instance'
      ? 'Leave blank to show the default Browser Comments header.'
      : 'Leave a field blank to inherit from the parent.';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Company name</label>
          <input
            type="text"
            value={branding.companyName || ''}
            onChange={(e) => update('companyName', e.target.value)}
            placeholder="Acme Inc."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL (https)</label>
          <input
            type="url"
            value={branding.logoUrl || ''}
            onChange={(e) => update('logoUrl', e.target.value)}
            placeholder="https://…/logo.png"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Support email</label>
          <input
            type="email"
            value={branding.supportEmail || ''}
            onChange={(e) => update('supportEmail', e.target.value)}
            placeholder="support@acme.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
        >
          {saving ? 'Saving…' : 'Save branding'}
        </button>
        {saved && <span className="text-green-600 text-sm">✓ Saved</span>}
        {error && <span className="text-red-600 text-sm">{error}</span>}
        <span className="text-xs text-gray-400 ml-auto">{parentHint}</span>
      </div>
    </div>
  );
}

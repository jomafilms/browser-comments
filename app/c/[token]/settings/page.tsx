'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface WidgetSettings {
  buttonText: string;
  buttonPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor: string;
  modalTitle: string;
  modalSubtitle: string;
  successMessage: string;
}

const defaultSettings: WidgetSettings = {
  buttonText: 'Feedback',
  buttonPosition: 'bottom-right',
  primaryColor: '#2563eb',
  modalTitle: 'Send Feedback',
  modalSubtitle: 'Draw on the screenshot to highlight issues',
  successMessage: 'Your feedback has been submitted!',
};

export default function SettingsPage() {
  const params = useParams();
  const token = params.token as string;

  const [settings, setSettings] = useState<WidgetSettings>(defaultSettings);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/settings?token=${token}`);
      if (!response.ok) {
        setError('Invalid access link');
        setLoading(false);
        return;
      }
      const data = await response.json();
      setSettings({ ...defaultSettings, ...data.settings });
      setClientName(data.clientName);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings');
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch(`/api/settings?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="bg-white p-8 rounded-xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Widget Settings</h1>
              <p className="text-sm text-gray-500 mt-1">{clientName}</p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/c/${token}`}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Projects
              </Link>
              <Link
                href={`/c/${token}/comments`}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Comments
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          {/* Button Settings */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Button Appearance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Button Text
                </label>
                <input
                  type="text"
                  value={settings.buttonText}
                  onChange={(e) => setSettings({ ...settings, buttonText: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Feedback"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Button Position
                </label>
                <select
                  value={settings.buttonPosition}
                  onChange={(e) => setSettings({ ...settings, buttonPosition: e.target.value as WidgetSettings['buttonPosition'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Settings */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Modal Content</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modal Title
                </label>
                <input
                  type="text"
                  value={settings.modalTitle}
                  onChange={(e) => setSettings({ ...settings, modalTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Send Feedback"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions (Subtitle)
                </label>
                <textarea
                  value={settings.modalSubtitle}
                  onChange={(e) => setSettings({ ...settings, modalSubtitle: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                  placeholder="Draw on the screenshot to highlight issues"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Success Message
                </label>
                <input
                  type="text"
                  value={settings.successMessage}
                  onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Your feedback has been submitted!"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Preview</h2>
            <div className="bg-gray-100 rounded-lg p-8 relative min-h-[200px]">
              <div
                className="absolute px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-white text-sm font-medium"
                style={{
                  backgroundColor: settings.primaryColor,
                  ...(settings.buttonPosition.includes('bottom') ? { bottom: '16px' } : { top: '16px' }),
                  ...(settings.buttonPosition.includes('right') ? { right: '16px' } : { left: '16px' }),
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                {settings.buttonText}
              </div>

              {/* Mini modal preview */}
              <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs mx-auto">
                <h3 className="font-semibold text-gray-800">{settings.modalTitle}</h3>
                <p className="text-sm text-gray-500 mt-1">{settings.modalSubtitle}</p>
                <div className="mt-3 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                  Screenshot Preview
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="border-t pt-6 flex justify-between items-center">
            <div>
              {saved && (
                <span className="text-green-600 text-sm flex items-center gap-1">
                  <span>✓</span> Settings saved!
                </span>
              )}
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 mb-2">How it works</h3>
          <p className="text-sm text-blue-700">
            These settings will automatically apply to any site using your widget embed code.
            Changes take effect immediately - no need to update the embed code on your sites.
          </p>
        </div>
      </div>
    </div>
  );
}

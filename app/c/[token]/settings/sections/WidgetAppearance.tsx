'use client';

import { useState } from 'react';
import ScopeBadge from './ScopeBadge';

// Widget button/modal appearance. Client-level: project tokens get the same
// read-only treatment as notifications (banner + disabled fields) instead of
// an editable form that 403s on save.

export interface WidgetSettings {
  buttonText: string;
  buttonPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor: string;
  modalTitle: string;
  modalSubtitle: string;
  successMessage: string;
}

export const defaultWidgetSettings: WidgetSettings = {
  buttonText: 'Feedback',
  buttonPosition: 'bottom-right',
  primaryColor: '#2563eb',
  modalTitle: 'Send Feedback',
  modalSubtitle: 'Draw on the screenshot to highlight issues',
  successMessage: 'Your feedback has been submitted!',
};

export default function WidgetAppearance({
  token,
  initialSettings,
  readOnly,
}: {
  token: string;
  initialSettings: WidgetSettings;
  readOnly: boolean;
}) {
  const [settings, setSettings] = useState<WidgetSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      } else {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-800">
        Widget appearance <ScopeBadge label="applies to all projects" />
      </h3>

      {readOnly && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Widget appearance is client-level. Open the client (not project) settings link to change it.
        </div>
      )}

      <fieldset disabled={readOnly} className="space-y-6">
        {/* Button Settings */}
        <div>
          <h4 className="font-semibold text-gray-800 mb-4">Button Appearance</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
              <input
                type="text"
                value={settings.buttonText}
                onChange={(e) => setSettings({ ...settings, buttonText: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Feedback"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Button Position</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
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
          <h4 className="font-semibold text-gray-800 mb-4">Modal Content</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modal Title</label>
              <input
                type="text"
                value={settings.modalTitle}
                onChange={(e) => setSettings({ ...settings, modalTitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Send Feedback"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions (Subtitle)</label>
              <textarea
                value={settings.modalSubtitle}
                onChange={(e) => setSettings({ ...settings, modalSubtitle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={2}
                placeholder="Draw on the screenshot to highlight issues"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Success Message</label>
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
      </fieldset>

      {/* Preview */}
      <div className="border-t pt-6">
        <h4 className="font-semibold text-gray-800 mb-4">Preview</h4>
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
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-xs mx-auto">
            <h4 className="font-semibold text-gray-800">{settings.modalTitle}</h4>
            <p className="text-sm text-gray-500 mt-1">{settings.modalSubtitle}</p>
            <div className="mt-3 h-20 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
              Screenshot Preview
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {!readOnly && (
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
      )}
    </div>
  );
}

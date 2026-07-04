'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ClientNav from '@/components/ClientNav';
import WebhooksSettings from '@/components/WebhooksSettings';
import NotificationSettings from '@/components/NotificationSettings';
import InstallAccess from './sections/InstallAccess';
import WidgetAppearance, { WidgetSettings, defaultWidgetSettings } from './sections/WidgetAppearance';
import AssigneesSection from './sections/AssigneesSection';

// Settings shell: side nav on desktop, horizontal tabs on mobile. Sections are
// scope-badged; client-level ones render read-only for project tokens instead
// of failing on save. Section order puts "Install & Access" — the unified
// keys/links/sites view — first.

type SectionKey = 'install' | 'widget' | 'notifications' | 'assignees' | 'webhooks';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'install', label: 'Install & Access' },
  { key: 'widget', label: 'Widget appearance' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'assignees', label: 'Assignees' },
  { key: 'webhooks', label: 'Webhooks' },
];

export default function SettingsPage() {
  const params = useParams();
  const token = params.token as string;

  const [settings, setSettings] = useState<WidgetSettings>(defaultWidgetSettings);
  const [clientName, setClientName] = useState('');
  const [widgetKey, setWidgetKey] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false); // true ⇒ project token
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('install');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch(`/api/settings?token=${token}`);
        if (!response.ok) {
          setError('Invalid access link');
          setLoading(false);
          return;
        }
        const data = await response.json();
        setSettings({ ...defaultWidgetSettings, ...data.settings });
        setClientName(data.clientName);
        setWidgetKey(data.widgetKey);
        setReadOnly(!!data.readOnly);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching settings:', err);
        setError('Failed to load settings');
        setLoading(false);
      }
    }
    fetchSettings();
  }, [token]);

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

  const navButton = (section: { key: SectionKey; label: string }, mobile: boolean) => (
    <button
      key={section.key}
      onClick={() => setActiveSection(section.key)}
      className={
        mobile
          ? `px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeSection === section.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`
          : `w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSection === section.key
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`
      }
    >
      {section.label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientNav token={token} clientName={clientName} />

      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">
            Install the widget, manage access, and configure your team settings
          </p>
        </div>
        {/* Mobile: horizontal section tabs */}
        <div className="md:hidden max-w-6xl mx-auto px-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max">{SECTIONS.map((s) => navButton(s, true))}</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Desktop: side navigation */}
          <div className="hidden md:block w-48 flex-shrink-0">
            <nav className="space-y-1">{SECTIONS.map((s) => navButton(s, false))}</nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {activeSection === 'install' && (
              <InstallAccess token={token} widgetKey={widgetKey} isProjectToken={readOnly} />
            )}
            {activeSection === 'widget' && (
              <WidgetAppearance token={token} initialSettings={settings} readOnly={readOnly} />
            )}
            {activeSection === 'notifications' && <NotificationSettings token={token} />}
            {activeSection === 'assignees' && <AssigneesSection token={token} />}
            {activeSection === 'webhooks' && <WebhooksSettings token={token} />}
          </div>
        </div>
      </div>
    </div>
  );
}

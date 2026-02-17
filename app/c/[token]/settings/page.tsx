'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ClientNav from '@/components/ClientNav';

interface WidgetSettings {
  buttonText: string;
  buttonPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  primaryColor: string;
  modalTitle: string;
  modalSubtitle: string;
  successMessage: string;
}

interface Assignee {
  id: number;
  client_id: number;
  name: string;
  created_at: string;
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
  const [widgetKey, setWidgetKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<'widget' | 'assignees'>('widget');
  const [widgetTab, setWidgetTab] = useState<'appearance' | 'embed'>('appearance');
  const [copied, setCopied] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Assignees state
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchSettings();
    fetchAssignees();
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
      setWidgetKey(data.widgetKey);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings');
      setLoading(false);
    }
  };

  const fetchAssignees = async () => {
    try {
      const response = await fetch(`/api/assignees?token=${token}`);
      if (response.ok) {
        const data = await response.json();
        setAssignees(data);
      }
    } catch (err) {
      console.error('Error fetching assignees:', err);
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

  const addAssignee = async () => {
    if (!newAssigneeName.trim()) return;
    setAddingAssignee(true);
    try {
      const response = await fetch(`/api/assignees?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAssigneeName.trim() }),
      });
      if (response.ok) {
        setNewAssigneeName('');
        fetchAssignees();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to add assignee');
      }
    } catch (err) {
      console.error('Error adding assignee:', err);
      alert('Failed to add assignee');
    } finally {
      setAddingAssignee(false);
    }
  };

  const deleteAssignee = async (id: number) => {
    if (!confirm('Are you sure you want to delete this assignee?')) return;
    try {
      await fetch(`/api/assignees/${id}`, { method: 'DELETE' });
      fetchAssignees();
    } catch (err) {
      console.error('Error deleting assignee:', err);
    }
  };

  const startEditAssignee = (assignee: Assignee) => {
    setEditingAssignee(assignee.id);
    setEditName(assignee.name);
  };

  const saveEditAssignee = async () => {
    if (!editName.trim() || !editingAssignee) return;
    try {
      const response = await fetch(`/api/assignees/${editingAssignee}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (response.ok) {
        setEditingAssignee(null);
        setEditName('');
        fetchAssignees();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update assignee');
      }
    } catch (err) {
      console.error('Error updating assignee:', err);
    }
  };

  const getEmbedCode = () => {
    if (!widgetKey) return '';
    return `<script src="${baseUrl}/widget.js" data-key="${widgetKey}"></script>`;
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      {/* Navigation */}
      <ClientNav token={token} clientName={clientName} />

      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h2 className="text-xl font-semibold text-gray-800">Settings</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your widget and team settings</p>
        </div>
      </div>

      {/* Main Content with Side Nav */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Side Navigation */}
          <div className="w-48 flex-shrink-0">
            <nav className="space-y-1">
              <button
                onClick={() => setActiveSection('widget')}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === 'widget'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Widget
              </button>
              <button
                onClick={() => setActiveSection('assignees')}
                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === 'assignees'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Assignees
              </button>
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            {activeSection === 'widget' ? (
              <>
                {/* Widget Tabs */}
                <div className="border-b mb-6">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setWidgetTab('appearance')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        widgetTab === 'appearance'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Appearance
                    </button>
                    <button
                      onClick={() => setWidgetTab('embed')}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        widgetTab === 'embed'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Embed Code
                    </button>
                  </div>
                </div>

                {widgetTab === 'appearance' ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
                    {/* Button Settings */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Button Appearance</h3>
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
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Modal Content</h3>
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

                    {/* Preview */}
                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Preview</h3>
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
                ) : (
                  <>
                    {/* Embed Code Tab */}
                    {widgetKey ? (
                      <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm p-6">
                          <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Embed Code</h3>
                          <p className="text-sm text-gray-600 mb-4">
                            Copy this script tag and paste it into your website to enable the feedback widget.
                          </p>
                          <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                            {getEmbedCode()}
                          </div>
                          <button
                            onClick={copyEmbedCode}
                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                          >
                            {copied ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Copied!
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                </svg>
                                Copy to Clipboard
                              </>
                            )}
                          </button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6">
                          <h3 className="text-lg font-semibold text-gray-800 mb-4">Installation</h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Add the script tag just before the closing <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">&lt;/body&gt;</code> tag of your HTML.
                          </p>
                          <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm overflow-x-auto">
                            <pre className="text-gray-700">{`<body>
  <!-- Your website content -->

  <!-- Add this before </body> -->
  ${getEmbedCode()}
</body>`}</pre>
                          </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm p-6">
                          <h3 className="text-lg font-semibold text-gray-800 mb-4">Pre-fill User Name (Optional)</h3>
                          <p className="text-sm text-gray-600 mb-3">
                            If your site has authentication, you can pre-fill the user&apos;s name in the feedback form:
                          </p>
                          <div className="bg-gray-50 border rounded-lg p-4 font-mono text-sm overflow-x-auto">
                            <pre className="text-gray-700">{`<script
  src="${baseUrl}/widget.js"
  data-key="${widgetKey}"
  data-user-name="{{user.name}}"
></script>`}</pre>
                          </div>
                          <p className="text-sm text-gray-500 mt-3">
                            Replace <code className="bg-gray-100 px-1 py-0.5 rounded">{`{{user.name}}`}</code> with your template variable for the logged-in user&apos;s name.
                          </p>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <h4 className="font-medium text-amber-800 mb-2">Domain Security</h4>
                          <p className="text-sm text-amber-700">
                            Feedback submissions are only accepted from domains that match your project URLs.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Widget Key Not Generated</h3>
                        <p className="text-sm text-gray-600">
                          Contact your administrator to enable the widget feature.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              /* Assignees Section */
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Team Assignees</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Manage the list of people who can be assigned to comments.
                </p>

                {/* Add new assignee */}
                <div className="flex gap-3 mb-6">
                  <input
                    type="text"
                    value={newAssigneeName}
                    onChange={(e) => setNewAssigneeName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAssignee()}
                    placeholder="Enter name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={addAssignee}
                    disabled={addingAssignee || !newAssigneeName.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {addingAssignee ? 'Adding...' : 'Add'}
                  </button>
                </div>

                {/* Assignees list */}
                {assignees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No assignees yet. Add your first team member above.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignees.map((assignee) => (
                      <div
                        key={assignee.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        {editingAssignee === assignee.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEditAssignee()}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded"
                              autoFocus
                            />
                            <button
                              onClick={saveEditAssignee}
                              className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingAssignee(null)}
                              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium text-gray-800">{assignee.name}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditAssignee(assignee)}
                                className="p-1 text-gray-500 hover:text-blue-600"
                                title="Edit"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteAssignee(assignee.id)}
                                className="p-1 text-gray-500 hover:text-red-600"
                                title="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    These assignees will be available in the dropdown when assigning comments.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

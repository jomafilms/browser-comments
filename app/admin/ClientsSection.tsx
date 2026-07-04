'use client';

import { useState } from 'react';
import { Client } from './types';
import BrandingEditor from './BrandingEditor';
import NotificationSettings from '@/components/NotificationSettings';
import { copyToClipboard } from '../../lib/clipboard';

// Clients CRUD + widget embed code + per-client branding override.
// Requests are authed by the owner session cookie (sent automatically).
export default function ClientsSection({
  clients,
  setClients,
}: {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
}) {
  const [newClientName, setNewClientName] = useState('');
  const [showClientForm, setShowClientForm] = useState(false);
  const [expandedWidget, setExpandedWidget] = useState<number | null>(null);
  const [expandedBranding, setExpandedBranding] = useState<number | null>(null);
  const [expandedNotifications, setExpandedNotifications] = useState<number | null>(null);
  const [copiedWidget, setCopiedWidget] = useState<number | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (token: string) => `${origin}/c/${token}/comments?status=open&sort=priority`;
  const widgetSnippet = (widgetKey: string) =>
    `<script src="${origin}/widget.js" data-key="${widgetKey}"></script>`;

  const createClient = async () => {
    if (!newClientName.trim()) {
      alert('Please enter a client name');
      return;
    }
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClientName }),
      });
      if (response.ok) {
        const client = await response.json();
        setClients((prev) => [...prev, client]);
        setNewClientName('');
        setShowClientForm(false);
        const url = linkFor(client.token);
        navigator.clipboard.writeText(url);
        alert(`Client created!\n\nAccess link:\n${url}\n\nCopied to your clipboard.`);
      }
    } catch (err) {
      console.error('Error creating client:', err);
      alert('Failed to create client');
    }
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(linkFor(token));
    alert('Link copied to clipboard!');
  };

  const copyWidgetCode = async (clientId: number, widgetKey: string) => {
    if (await copyToClipboard(widgetSnippet(widgetKey))) {
      setCopiedWidget(clientId);
      setTimeout(() => setCopiedWidget((c) => (c === clientId ? null : c)), 1600);
    }
  };

  const regenerateToken = async (clientId: number) => {
    try {
      const response = await fetch(`/api/clients/${clientId}/regenerate-token`, { method: 'POST' });
      if (response.ok) {
        const { token } = await response.json();
        setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, token } : c)));
        navigator.clipboard.writeText(linkFor(token));
        alert('Token regenerated! New access link copied to clipboard.');
      }
    } catch (err) {
      console.error('Error regenerating token:', err);
      alert('Failed to regenerate token');
    }
  };

  const generateWidgetKey = async (clientId: number) => {
    try {
      const response = await fetch(`/api/clients/${clientId}/widget-key`, { method: 'POST' });
      if (response.ok) {
        const { widget_key } = await response.json();
        setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, widget_key } : c)));
      }
    } catch (err) {
      console.error('Error generating widget key:', err);
      alert('Failed to generate widget key');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">Clients</h2>
        <button
          onClick={() => setShowClientForm(!showClientForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          {showClientForm ? 'Cancel' : 'Add Client'}
        </button>
      </div>

      {showClientForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex gap-3">
            <input
              type="text"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              placeholder="Client name (e.g., Adobe)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
              onKeyDown={(e) => e.key === 'Enter' && createClient()}
            />
            <button
              onClick={createClient}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <p className="text-gray-500">No clients yet. Create one to get started.</p>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <div key={client.id} className="border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center justify-between p-4">
                <div>
                  <h3 className="font-semibold text-gray-800">{client.name}</h3>
                  <p className="text-sm text-gray-500 font-mono">/c/{client.token}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setExpandedBranding(expandedBranding === client.id ? null : client.id)}
                    className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-sm"
                  >
                    {expandedBranding === client.id ? 'Hide Branding' : 'Branding'}
                  </button>
                  <button
                    onClick={() =>
                      setExpandedNotifications(expandedNotifications === client.id ? null : client.id)
                    }
                    className="px-3 py-1.5 bg-teal-100 text-teal-700 rounded hover:bg-teal-200 text-sm"
                  >
                    {expandedNotifications === client.id ? 'Hide Notifications' : 'Notifications'}
                  </button>
                  <button
                    onClick={() => setExpandedWidget(expandedWidget === client.id ? null : client.id)}
                    className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-sm"
                  >
                    {expandedWidget === client.id ? 'Hide Widget' : 'Widget Code'}
                  </button>
                  <button
                    onClick={() => copyLink(client.token)}
                    className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                  >
                    Copy Link
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Regenerate access token? The old link will stop working immediately.')) {
                        regenerateToken(client.id);
                      }
                    }}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                  >
                    Regenerate Token
                  </button>
                  <button
                    onClick={() => window.open(linkFor(client.token), '_blank')}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
                  >
                    Open
                  </button>
                </div>
              </div>

              {expandedBranding === client.id && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-4 bg-amber-50/40">
                  <h4 className="font-medium text-gray-700 mb-2">Client Branding Override</h4>
                  <BrandingEditor scope="client" id={client.id} />
                </div>
              )}

              {expandedNotifications === client.id && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-4 bg-teal-50/40">
                  <NotificationSettings token={client.token} />
                </div>
              )}

              {expandedWidget === client.id && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-4 bg-gray-50">
                  <h4 className="font-medium text-gray-700 mb-2">Embeddable Feedback Widget</h4>
                  {client.widget_key ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Add this script tag to any website to enable the feedback button:
                      </p>
                      <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                        {widgetSnippet(client.widget_key)}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => copyWidgetCode(client.id, client.widget_key!)}
                          className="px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                        >
                          {copiedWidget === client.id ? '✓ Copied' : 'Copy Code'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Regenerate widget key? The old key will stop working immediately.')) {
                              generateWidgetKey(client.id);
                            }
                          }}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                        >
                          Regenerate Key
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-3">
                        <strong>Note:</strong> Feedback will only work from domains that match your project URLs.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">
                        Generate a widget key to enable the embeddable feedback widget for this client.
                      </p>
                      <button
                        onClick={() => generateWidgetKey(client.id)}
                        className="px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                      >
                        Generate Widget Key
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

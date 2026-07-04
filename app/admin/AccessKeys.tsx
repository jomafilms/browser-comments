'use client';

import { Client, Project } from './types';
import WebhooksSettings from '@/components/WebhooksSettings';
import { copyToClipboard } from '@/lib/clipboard';

// Every credential-ish string for one client in one place: magic link, widget
// key + snippet, project links/tokens, and the client's webhooks. Session-
// cookie authed like the rest of the admin surface.
export default function AccessKeys({
  client,
  projects,
  setClients,
  setProjects,
}: {
  client: Client;
  projects: Project[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const linkFor = (token: string) => `${origin}/c/${token}/comments?status=open&sort=priority`;
  const embedCode = client.widget_key
    ? `<script src="${origin}/widget.js" data-key="${client.widget_key}"></script>`
    : '';

  const copy = async (text: string, message: string) => {
    alert((await copyToClipboard(text)) ? message : 'Copy failed — clipboard unavailable.');
  };

  const regenerateToken = async () => {
    if (!confirm('Regenerate access token? The old link will stop working immediately.')) return;
    try {
      const response = await fetch(`/api/clients/${client.id}/regenerate-token`, { method: 'POST' });
      if (response.ok) {
        const { token } = await response.json();
        setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, token } : c)));
        const copied = await copyToClipboard(linkFor(token));
        alert(`Token regenerated!${copied ? ' New access link copied to clipboard.' : ''}`);
      }
    } catch (err) {
      console.error('Error regenerating token:', err);
      alert('Failed to regenerate token');
    }
  };

  const generateWidgetKey = async (isRegen: boolean) => {
    if (isRegen && !confirm('Regenerate widget key? The old key will stop working immediately.')) return;
    try {
      const response = await fetch(`/api/clients/${client.id}/widget-key`, { method: 'POST' });
      if (response.ok) {
        const { widget_key } = await response.json();
        setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, widget_key } : c)));
      }
    } catch (err) {
      console.error('Error generating widget key:', err);
      alert('Failed to generate widget key');
    }
  };

  const generateProjectToken = async (projectId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/regenerate-token`, { method: 'POST' });
      if (response.ok) {
        const { token } = await response.json();
        setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, token } : p)));
        const copied = await copyToClipboard(token);
        alert(`Project token generated${copied ? ' and copied' : ''}! External devs use it in BROWSER_COMMENTS_TOKEN.`);
      }
    } catch (err) {
      console.error('Error generating project token:', err);
      alert('Failed to generate project token');
    }
  };

  const row = 'flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg';
  const btn = 'px-2 py-1 rounded text-xs';

  return (
    <div className="space-y-4">
      {/* Client magic link */}
      <div className={row}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">Client link — sees all projects</p>
          <p className="font-mono text-xs text-gray-500 truncate">/c/{client.token}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => copy(linkFor(client.token), 'Link copied to clipboard!')} className={`${btn} bg-gray-200 text-gray-700 hover:bg-gray-300`}>Copy Link</button>
          <button onClick={() => window.open(linkFor(client.token), '_blank')} className={`${btn} bg-blue-100 text-blue-700 hover:bg-blue-200`}>Open</button>
          <button onClick={regenerateToken} className={`${btn} bg-red-100 text-red-700 hover:bg-red-200`}>Regenerate</button>
        </div>
      </div>

      {/* Widget key */}
      <div className={row}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">Widget key — one per client, all sites</p>
          {client.widget_key ? (
            <p className="font-mono text-xs text-gray-500 truncate">{client.widget_key}</p>
          ) : (
            <p className="text-xs text-gray-500">Not generated yet</p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {client.widget_key ? (
            <>
              <button onClick={() => copy(embedCode, 'Widget embed code copied to clipboard!')} className={`${btn} bg-green-100 text-green-700 hover:bg-green-200`}>Copy Snippet</button>
              <button onClick={() => generateWidgetKey(true)} className={`${btn} bg-red-100 text-red-700 hover:bg-red-200`}>Regenerate</button>
            </>
          ) : (
            <button onClick={() => generateWidgetKey(false)} className={`${btn} bg-purple-100 text-purple-700 hover:bg-purple-200`}>Generate Key</button>
          )}
        </div>
      </div>

      {/* Project links / tokens */}
      {projects.map((project) => (
        <div key={project.id} className={row}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">
              Project link — {project.name}
              <span className="ml-1.5 text-xs text-gray-400 font-normal">sees only this project · agents use it as a Bearer token</span>
            </p>
            {project.token ? (
              <p className="font-mono text-xs text-gray-500 truncate">{project.token.slice(0, 8)}…</p>
            ) : (
              <p className="text-xs text-gray-500">No token yet</p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {project.token ? (
              <>
                <button onClick={() => copy(project.token!, 'Project token copied!')} className={`${btn} bg-gray-200 text-gray-700 hover:bg-gray-300`}>Copy Token</button>
                <button onClick={() => copy(linkFor(project.token!), 'Project link copied to clipboard!')} className={`${btn} bg-gray-200 text-gray-700 hover:bg-gray-300`}>Copy Link</button>
                <button onClick={() => window.open(linkFor(project.token!), '_blank')} className={`${btn} bg-blue-100 text-blue-700 hover:bg-blue-200`}>Open</button>
                <button
                  onClick={() => {
                    if (confirm('Regenerate project token? The old token will stop working.')) {
                      generateProjectToken(project.id);
                    }
                  }}
                  className={`${btn} bg-red-100 text-red-700 hover:bg-red-200`}
                >
                  Regen
                </button>
              </>
            ) : (
              <button onClick={() => generateProjectToken(project.id)} className={`${btn} bg-blue-100 text-blue-700 hover:bg-blue-200`}>Generate Token</button>
            )}
          </div>
        </div>
      ))}

      {/* Webhooks (client-scoped view — same component the client settings page uses) */}
      <div className="pt-2">
        <WebhooksSettings token={client.token} />
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import ScopeBadge from './ScopeBadge';
import { copyToClipboard } from '@/lib/clipboard';

// The unified answer to "which key goes in the snippet, which sites can
// submit, and what can each link see". Everything here is served by existing
// endpoints — the sites table is just each project's origin list made visible.

interface Project {
  id: number;
  name: string;
  url: string; // comma-separated origins
  token: string | null;
  ref_prefix?: string | null;
}

export default function InstallAccess({
  token,
  widgetKey,
  isProjectToken,
}: {
  token: string;
  widgetKey: string | null;
  isProjectToken: boolean;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    let active = true;
    fetch(`/api/projects?token=${token}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  const embedCode = widgetKey
    ? `<script src="${baseUrl}/widget.js" data-key="${widgetKey}"></script>`
    : '';

  const copy = async (key: string, text: string) => {
    if (!(await copyToClipboard(text))) return;
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const sites = projects.flatMap((p) =>
    p.url
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
      .map((origin) => ({ origin, project: p }))
  );

  const linkFor = (t: string) => `${baseUrl}/c/${t}/comments`;
  const projectsWithLinks = projects.filter((p) => p.token);
  const projectsWithoutLinks = projects.filter((p) => !p.token);

  return (
    <div className="space-y-6">
      {/* Embed snippet */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          Embed snippet <ScopeBadge label="one key for all your projects" />
        </h3>
        {widgetKey ? (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Paste this before the closing <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">&lt;/body&gt;</code> tag
              of any site listed below. Feedback routes to the right project automatically, based on the
              site it was sent from.
            </p>
            <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
              {embedCode}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => copy('embed', embedCode)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                {copied === 'embed' ? '✓ Copied' : 'Copy snippet'}
              </button>
              <span className="text-xs text-gray-500">
                Tip: add <code className="bg-gray-100 px-1 rounded">data-user-name=&quot;…&quot;</code> to pre-fill the
                submitter&apos;s name on logged-in sites.
              </span>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            No widget key has been generated yet. Contact your administrator to enable the embeddable widget.
          </p>
        )}
      </div>

      {/* Sites that can submit */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          Sites that can submit feedback <ScopeBadge label="per project" />
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          The widget only accepts feedback from these domains. Each one files tickets into its project.
        </p>
        {sites.length === 0 ? (
          <p className="text-sm text-gray-500">No project URLs configured yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {sites.map(({ origin, project }, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gray-50/50">
                <span className="font-mono text-sm text-gray-800 break-all">{origin}</span>
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  → {project.name}
                  {project.ref_prefix && (
                    <span className="ml-1.5 text-xs text-gray-400 font-mono">({project.ref_prefix}-…)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3">
          To add or change a site, contact your operator{isProjectToken ? '' : ' — project URLs are managed in the admin dashboard'}.
        </p>
      </div>

      {/* Access links */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          Access links <ScopeBadge label={isProjectToken ? 'this project only' : 'share carefully'} />
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {isProjectToken
            ? 'This link sees exactly one project. Agents and the CLI can use the same token as a Bearer token.'
            : 'The client link sees every project; a project link sees only its own. Agents and the CLI use the same tokens as Bearer tokens.'}
        </p>
        <div className="space-y-2">
          {!isProjectToken && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">Client link — all projects</p>
                <p className="font-mono text-xs text-gray-500 truncate">{linkFor(token)}</p>
              </div>
              <button
                onClick={() => copy('client-link', linkFor(token))}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm flex-shrink-0"
              >
                {copied === 'client-link' ? '✓ Copied' : 'Copy link'}
              </button>
            </div>
          )}
          {projectsWithLinks.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  Project link — {p.name}
                  {p.ref_prefix && <span className="ml-1.5 text-xs text-gray-400 font-mono">({p.ref_prefix}-…)</span>}
                </p>
                <p className="font-mono text-xs text-gray-500 truncate">{linkFor(p.token!)}</p>
              </div>
              <button
                onClick={() => copy(`project-link-${p.id}`, linkFor(p.token!))}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm flex-shrink-0"
              >
                {copied === `project-link-${p.id}` ? '✓ Copied' : 'Copy link'}
              </button>
            </div>
          ))}
        </div>
        {!isProjectToken && projectsWithoutLinks.length > 0 && (
          <p className="text-xs text-gray-500 mt-3">
            No project link yet for {projectsWithoutLinks.map((p) => p.name).join(', ')} — your operator can
            generate one from the admin dashboard.
          </p>
        )}
      </div>
    </div>
  );
}

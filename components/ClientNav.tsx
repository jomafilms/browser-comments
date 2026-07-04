'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import ScopePill, { PillProject } from './ScopePill';

interface Branding {
  companyName?: string;
  logoUrl?: string;
  supportEmail?: string;
}

interface ClientNavProps {
  token: string;
  clientName?: string;
  children?: ReactNode;
  // Scope pill wiring. Pages that already fetch projects pass them in (no
  // duplicate request); pages with a project dimension also pass selected +
  // onProjectChange so the pill becomes the switcher that drives their filter.
  projects?: PillProject[];
  selectedProject?: string;
  onProjectChange?: (value: string) => void;
}

// Only render operator-supplied URLs/emails that pass a basic shape check.
// logoUrl is already http(s)-validated server-side (lib/db/branding.ts); this
// is defense in depth for the client render. React escapes text + attributes,
// so companyName/clientName are safe as plain children.
const isHttpUrl = (v?: string) => !!v && /^https?:\/\//i.test(v);
const isEmail = (v?: string) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function ClientNav({
  token,
  clientName,
  children,
  projects,
  selectedProject,
  onProjectChange,
}: ClientNavProps) {
  const pathname = usePathname();
  const [branding, setBranding] = useState<Branding>({});
  const [resolvedName, setResolvedName] = useState<string | undefined>(clientName);
  const [isProjectToken, setIsProjectToken] = useState(false);
  const [ownProjects, setOwnProjects] = useState<PillProject[]>([]);

  // Pull resolved branding (project → client → instance), the client name, and
  // the token kind (readOnly ⇒ project token) from the settings endpoint.
  // Cached ~5min server-side, so this is cheap per page.
  useEffect(() => {
    let active = true;
    fetch(`/api/settings?token=${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setBranding(data.branding || {});
        if (data.clientName) setResolvedName(data.clientName);
        setIsProjectToken(!!data.readOnly);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  // Pages that don't fetch projects themselves still get a scope pill.
  useEffect(() => {
    if (projects) return;
    let active = true;
    fetch(`/api/projects?token=${token}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) setOwnProjects(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, projects]);

  const navItems = [
    { href: `/c/${token}/comments`, label: 'Comments' },
    { href: `/c/${token}/decisions`, label: 'Decisions' },
    { href: `/c/${token}/settings`, label: 'Settings' },
  ];

  const isActive = (href: string) => pathname.startsWith(href);

  const companyName = branding.companyName || 'Browser Comments';
  const showLogo = isHttpUrl(branding.logoUrl);
  const pillProjects = projects ?? ownProjects;

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-3 min-w-0">
            {showLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={companyName}
                className="w-auto object-contain"
                style={{ maxHeight: 32 }}
              />
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-800 truncate">{companyName}</h1>
              {resolvedName && <p className="text-xs text-gray-500 truncate">{resolvedName}</p>}
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive(item.href)
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <ScopePill
            isProjectToken={isProjectToken}
            projects={pillProjects}
            selected={selectedProject}
            onChange={onProjectChange}
          />

          <div className="flex items-center gap-3 ml-auto">
            {isEmail(branding.supportEmail) && (
              <a
                href={`mailto:${branding.supportEmail}`}
                className="hidden md:inline text-sm text-blue-600 hover:text-blue-800"
              >
                Support: {branding.supportEmail}
              </a>
            )}
            {children}
            <Link
              href={`/c/${token}/capture`}
              className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm font-medium whitespace-nowrap hover:bg-blue-600"
              title="Annotate a page and file feedback"
            >
              ＋ Capture
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

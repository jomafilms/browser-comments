'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';

interface Branding {
  companyName?: string;
  logoUrl?: string;
  supportEmail?: string;
}

interface ClientNavProps {
  token: string;
  clientName?: string;
  children?: ReactNode;
}

// Only render operator-supplied URLs/emails that pass a basic shape check.
// logoUrl is already http(s)-validated server-side (lib/db/branding.ts); this
// is defense in depth for the client render. React escapes text + attributes,
// so companyName/clientName are safe as plain children.
const isHttpUrl = (v?: string) => !!v && /^https?:\/\//i.test(v);
const isEmail = (v?: string) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export default function ClientNav({ token, clientName, children }: ClientNavProps) {
  const pathname = usePathname();
  const [branding, setBranding] = useState<Branding>({});
  const [resolvedName, setResolvedName] = useState<string | undefined>(clientName);

  // Pull resolved branding (project → client → instance) + the client name from
  // the settings endpoint. Cached ~5min server-side, so this is cheap per page.
  useEffect(() => {
    let active = true;
    fetch(`/api/settings?token=${token}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setBranding(data.branding || {});
        if (data.clientName) setResolvedName(data.clientName);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  const navItems = [
    { href: `/c/${token}/comments`, label: 'Comments' },
    { href: `/c/${token}/decisions`, label: 'Decisions' },
    { href: `/c/${token}/settings`, label: 'Settings' },
  ];

  const isActive = (href: string) => {
    if (href === `/c/${token}`) return pathname === href;
    return pathname.startsWith(href);
  };

  const companyName = branding.companyName || 'Browser Comments';
  const showLogo = isHttpUrl(branding.logoUrl);

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {showLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logoUrl}
                  alt={companyName}
                  className="w-auto object-contain"
                  style={{ maxHeight: 32 }}
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-800">{companyName}</h1>
                {resolvedName && <p className="text-xs text-gray-500">{resolvedName}</p>}
              </div>
            </div>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isEmail(branding.supportEmail) && (
              <a
                href={`mailto:${branding.supportEmail}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Support: {branding.supportEmail}
              </a>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

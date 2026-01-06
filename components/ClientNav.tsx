'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface ClientNavProps {
  token: string;
  clientName?: string;
  children?: ReactNode;
}

export default function ClientNav({ token, clientName, children }: ClientNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: `/c/${token}`, label: 'Projects' },
    { href: `/c/${token}/comments`, label: 'Comments' },
    { href: `/c/${token}/decisions`, label: 'Decisions' },
    { href: `/c/${token}/settings`, label: 'Settings' },
  ];

  const isActive = (href: string) => {
    if (href === `/c/${token}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Browser Comments</h1>
              {clientName && <p className="text-xs text-gray-500">{clientName}</p>}
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
          {children && (
            <div className="flex items-center gap-3">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

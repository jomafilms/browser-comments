'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';
import { Client, Project } from './types';
import ClientsSection from './ClientsSection';
import ProjectsSection from './ProjectsSection';
import BrandingEditor from './BrandingEditor';

// Admin dashboard shell: loads clients + projects once (session cookie auths the
// requests — no admin secret anymore), owns that shared state, and composes the
// sections. Split out of the old app/page.tsx so every file stays under ~300 lines.
export default function AdminDashboard({ ownerEmail }: { ownerEmail: string }) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          fetch('/api/clients'),
          fetch('/api/projects'),
        ]);
        if (clientsRes.ok) setClients(await clientsRes.json());
        if (projectsRes.ok) setProjects(await projectsRes.json());
      } catch (err) {
        console.error('Error loading admin data:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const logout = async () => {
    await signOut();
    router.push('/admin/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white p-8 rounded-xl shadow-xl">
          <p className="text-lg text-gray-700">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8 mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-gray-800">Admin Dashboard</h1>
            <p className="text-gray-600">Manage clients and projects</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 mb-2">{ownerEmail}</p>
            <button
              onClick={logout}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Instance branding — shown on all client-facing pages */}
        <div className="bg-white rounded-xl shadow-xl p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Branding</h2>
          <p className="text-sm text-gray-500 mb-4">
            Shown on client-facing pages. Clients and projects can override these below.
          </p>
          <BrandingEditor scope="instance" />
        </div>

        <ClientsSection clients={clients} setClients={setClients} />
        <ProjectsSection clients={clients} projects={projects} setProjects={setProjects} />
      </div>
    </div>
  );
}

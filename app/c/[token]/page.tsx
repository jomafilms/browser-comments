'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: number;
  token: string;
  name: string;
}

interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
}

export default function ClientPortal() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch projects for this client token
        const response = await fetch(`/api/projects?token=${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Invalid access link');
          } else {
            setError('Failed to load projects');
          }
          setLoading(false);
          return;
        }

        const projectData = await response.json();
        setProjects(projectData);

        // If only one project, redirect directly to it
        if (projectData.length === 1) {
          router.push(`/c/${token}/${projectData[0].id}`);
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
        setLoading(false);
      }
    }

    fetchData();
  }, [token, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white p-8 rounded-xl shadow-xl">
          <p className="text-lg text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="bg-white p-8 rounded-xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-800">Browser Comments</h1>
          <p className="text-gray-600 mb-8">Select a project to review</p>

          {projects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No projects available yet.</p>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/c/${token}/${project.id}`}
                  className="block p-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800">{project.name}</h2>
                  <p className="text-gray-500 text-sm mt-1 truncate">{project.url}</p>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 flex gap-4">
            <Link
              href={`/c/${token}/comments`}
              className="flex-1 text-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              View All Comments
            </Link>
            <Link
              href={`/c/${token}/decisions`}
              className="flex-1 text-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              View Decisions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

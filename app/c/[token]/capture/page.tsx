'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ClientNav from '@/components/ClientNav';

interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
  ref_prefix?: string | null;
}

// Capture entry point: pick which project to annotate. A single-project scope
// (or a project token) skips straight to its canvas.
export default function CapturePicker() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/projects?token=${token}`);
        if (!response.ok) {
          setError(response.status === 404 ? 'Invalid access link' : 'Failed to load projects');
          setLoading(false);
          return;
        }
        const projectData: Project[] = await response.json();
        if (projectData.length === 1) {
          router.replace(`/c/${token}/capture/${projectData[0].id}`);
          return;
        }
        setProjects(projectData);
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
    <div className="min-h-screen bg-gray-50">
      <ClientNav token={token} projects={projects} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Which project do you want to capture feedback on?
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            You&apos;ll get a live view of the site to draw on and comment.
          </p>

          {projects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No projects available yet.</p>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/c/${token}/capture/${project.id}`}
                  className="block p-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                  <p className="text-gray-500 text-sm mt-1 truncate">{project.url}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AnnotationCanvas, { TextAnnotation } from '@/components/AnnotationCanvas';

interface Project {
  id: number;
  client_id: number;
  name: string;
  url: string;
}

export default function ReviewInterface() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const projectId = parseInt(params.projectId as string);

  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [priority, setPriority] = useState<'high' | 'med' | 'low'>('med');
  const [priorityNumber, setPriorityNumber] = useState(0);
  const [assignee, setAssignee] = useState<'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari'>('dev1');
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/projects?token=${token}`);
        if (!response.ok) {
          setError('Invalid access link');
          setLoading(false);
          return;
        }

        const projectData: Project[] = await response.json();
        setProjects(projectData);

        const currentProject = projectData.find(p => p.id === projectId);
        if (!currentProject) {
          setError('Project not found');
          setLoading(false);
          return;
        }

        setProject(currentProject);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load project');
        setLoading(false);
      }
    }

    fetchData();
  }, [token, projectId]);

  const handleViewComments = () => {
    router.push(`/c/${token}/comments`);
  };

  const handleSave = async (imageData: string, textAnnotations: TextAnnotation[]) => {
    if (!project) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: project.url,
          projectName: project.name,
          imageData,
          textAnnotations,
          priority,
          priorityNumber,
          assignee,
          projectId: project.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
    } catch (error) {
      console.error('Error saving comment:', error);
      alert('Failed to save comment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white p-8 rounded-xl shadow-xl">
          <p className="text-lg text-gray-700">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="bg-white p-8 rounded-xl shadow-xl text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error || 'Project not found'}</p>
          <Link
            href={`/c/${token}`}
            className="mt-4 inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Top bar with project selector and navigation */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-4">
        <select
          value={projectId}
          onChange={(e) => router.push(`/c/${token}/${e.target.value}`)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'high' | 'med' | 'low')}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="high">High</option>
            <option value="med">Med</option>
            <option value="low">Low</option>
          </select>

          <input
            type="number"
            value={priorityNumber}
            onChange={(e) => setPriorityNumber(parseInt(e.target.value) || 0)}
            min="0"
            className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm"
            placeholder="#"
          />

          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value as 'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari')}
            className="px-2 py-1.5 border border-gray-300 rounded text-sm"
          >
            <option value="dev1">Dev1</option>
            <option value="dev2">Dev2</option>
            <option value="dev3">Dev3</option>
            <option value="Sessions">Sessions</option>
            <option value="Annie">Annie</option>
            <option value="Mari">Mari</option>
          </select>

          <Link
            href={`/c/${token}/comments`}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
          >
            Comments
          </Link>

          <Link
            href={`/c/${token}/decisions`}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
          >
            Decisions
          </Link>
        </div>
      </div>

      {/* Saving overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <p className="text-lg">Saving...</p>
          </div>
        </div>
      )}

      {/* Main annotation canvas - offset for top bar */}
      <div className="pt-12">
        <AnnotationCanvas
          onSave={handleSave}
          onViewComments={handleViewComments}
          iframeUrl={project.url}
        />
      </div>
    </div>
  );
}

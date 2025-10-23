'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AnnotationCanvas, { TextAnnotation } from '@/components/AnnotationCanvas';

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [priority, setPriority] = useState<'high' | 'med' | 'low'>('med');
  const [priorityNumber, setPriorityNumber] = useState(0);
  const [assignee, setAssignee] = useState<'dev1' | 'dev2' | 'dev3' | 'dev4' | 'Annie' | 'Mari'>('dev1');
  const [showAnnotation, setShowAnnotation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projects, setProjects] = useState<Array<{name: string, url: string}>>([]);
  const [selectedProject, setSelectedProject] = useState<string>('new');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch existing projects first
    fetchProjects();
  }, []);

  useEffect(() => {
    // Once projects are loaded, set defaults
    if (projects.length > 0) {
      const adobeMaxProject = projects.find(p => p.name === 'Adobe Max 2025 Map Notes');
      if (adobeMaxProject) {
        setSelectedProject(adobeMaxProject.name);
        setProjectName(adobeMaxProject.name);
        setUrl(adobeMaxProject.url);

        // Save to localStorage
        localStorage.setItem('lastUrl', adobeMaxProject.url);
        localStorage.setItem('lastProject', adobeMaxProject.name);

        // Auto-start annotation
        setShowAnnotation(true);
      }
      setIsLoading(false);
    }
  }, [projects]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/comments');
      const comments = await response.json();

      // Get unique projects with their most recent URL
      const projectMap = new Map<string, string>();
      comments.forEach((comment: any) => {
        if (!projectMap.has(comment.project_name)) {
          projectMap.set(comment.project_name, comment.url);
        }
      });

      const projectList = Array.from(projectMap.entries()).map(([name, url]) => ({
        name,
        url
      }));

      setProjects(projectList);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleProjectChange = (value: string) => {
    setSelectedProject(value);
    if (value !== 'new') {
      const project = projects.find(p => p.name === value);
      if (project) {
        setProjectName(project.name);
        setUrl(project.url);
      }
    } else {
      // Clear for new project
      setProjectName('');
      setUrl('');
    }
  };

  const handleStart = () => {
    if (!url || !projectName) {
      alert('Please enter both URL and project name');
      return;
    }

    // Add https:// if no protocol specified
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      formattedUrl = 'https://' + url;
    }
    setUrl(formattedUrl);

    // Save to localStorage
    localStorage.setItem('lastUrl', formattedUrl);
    localStorage.setItem('lastProject', projectName);

    setShowAnnotation(true);
  };

  const handleNewComment = () => {
    // Just reload the page to clear canvas and keep same URL/project
    window.location.reload();
  };

  const handleViewComments = () => {
    router.push('/comments?project=Adobe+Max+2025+Map+Notes');
  };

  const handleSave = async (imageData: string, textAnnotations: TextAnnotation[]) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          projectName,
          imageData,
          textAnnotations,
          priority,
          priorityNumber,
          assignee,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      // Success - spinner will just disappear
    } catch (error) {
      console.error('Error saving comment:', error);
      alert('Failed to save comment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (showAnnotation) {
    return (
      <div className="relative">
        {isSaving && (
          <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <p className="text-lg">Saving...</p>
            </div>
          </div>
        )}
        <AnnotationCanvas onSave={handleSave} onViewComments={handleViewComments} iframeUrl={url} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white p-8 rounded-xl shadow-xl">
          <p className="text-lg text-gray-700">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="bg-white p-8 rounded-xl shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Browser Comments</h1>
        <p className="text-gray-600 mb-6">Annotate web pages and provide feedback</p>

        <div className="space-y-4">
          {/* Project Selection */}
          {projects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => handleProjectChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="new">+ Create New Project</option>
                {projects.map((project) => (
                  <option key={project.name} value={project.name}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., Website Redesign"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              disabled={selectedProject !== 'new' && selectedProject !== ''}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL to Annotate
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g., example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => e.key === 'Enter' && handleStart()}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'high' | 'med' | 'low')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="high">High</option>
                <option value="med">Med</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                #
              </label>
              <input
                type="number"
                value={priorityNumber}
                onChange={(e) => setPriorityNumber(parseInt(e.target.value) || 0)}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Assign To
            </label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value as 'dev1' | 'dev2' | 'dev3' | 'dev4' | 'Annie' | 'Mari')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="dev1">Dev1</option>
              <option value="dev2">Dev2</option>
              <option value="dev3">Dev3</option>
              <option value="dev4">Dev4</option>
              <option value="Annie">Annie</option>
              <option value="Mari">Mari</option>
            </select>
          </div>

          <button
            onClick={handleStart}
            className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
          >
            Start Annotating
          </button>

          <button
            onClick={() => router.push('/comments?project=Adobe+Max+2025+Map+Notes')}
            className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            View All Comments
          </button>
        </div>
      </div>
    </div>
  );
}

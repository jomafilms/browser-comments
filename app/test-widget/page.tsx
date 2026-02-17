'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import Script from 'next/script';

// Only allow in development
const isDev = process.env.NODE_ENV === 'development';

export default function TestWidgetPage() {
  // Return 404 in production
  if (!isDev) {
    notFound();
  }

  const [widgetKey, setWidgetKey] = useState<string>('');
  const [userName, setUserName] = useState<string>('Test User');
  const [loadWidget, setLoadWidget] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Widget Test Page</h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Widget Key
            </label>
            <input
              type="text"
              value={widgetKey}
              onChange={(e) => setWidgetKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
              placeholder="Enter widget key..."
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User Name (optional pre-fill)
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Enter name to pre-fill..."
            />
          </div>

          <button
            onClick={() => setLoadWidget(true)}
            disabled={!widgetKey || loadWidget}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loadWidget ? 'Widget Loaded' : 'Load Widget'}
          </button>

          {loadWidget && (
            <p className="mt-2 text-sm text-green-600">
              Widget loaded! Look for the feedback button in the corner.
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Content</h2>
          <p className="text-gray-600 mb-4">
            This is some test content to annotate. Try using the feedback widget to:
          </p>
          <ul className="list-disc list-inside text-gray-600 space-y-2">
            <li>Draw freehand annotations</li>
            <li>Add arrows pointing to elements</li>
            <li>Draw rectangles around areas</li>
            <li>Add text annotations</li>
            <li>Change colors using the color picker</li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-red-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-800 mb-2">Red Box</h3>
            <p className="text-red-600">Try annotating this red section.</p>
          </div>
          <div className="bg-green-100 rounded-lg p-6">
            <h3 className="font-semibold text-green-800 mb-2">Green Box</h3>
            <p className="text-green-600">Or annotate this green section.</p>
          </div>
          <div className="bg-blue-100 rounded-lg p-6">
            <h3 className="font-semibold text-blue-800 mb-2">Blue Box</h3>
            <p className="text-blue-600">This blue section works too.</p>
          </div>
          <div className="bg-yellow-100 rounded-lg p-6">
            <h3 className="font-semibold text-yellow-800 mb-2">Yellow Box</h3>
            <p className="text-yellow-600">And this yellow section!</p>
          </div>
        </div>
      </div>

      {loadWidget && widgetKey && (
        <Script
          src="/widget.js"
          data-key={widgetKey}
          data-user-name={userName || undefined}
          strategy="lazyOnload"
        />
      )}
    </div>
  );
}

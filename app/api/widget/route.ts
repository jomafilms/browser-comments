import { NextRequest, NextResponse } from 'next/server';
import { initDB, getClientByWidgetKey, getProjectByOrigin, getProjectsByClientId, saveComment } from '@/lib/db';

// Increase body size limit for screenshot uploads
export const maxDuration = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Cache headers for widget validation (1 hour cache)
const cacheHeaders = {
  ...corsHeaders,
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST - Submit feedback via widget
export async function POST(request: NextRequest) {
  await initDB();

  try {
    const body = await request.json();
    const { widgetKey, url, imageData, textAnnotations, submitterName } = body;

    // Validate required fields
    if (!widgetKey) {
      return NextResponse.json(
        { error: 'Widget key is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!imageData) {
      return NextResponse.json(
        { error: 'Screenshot data is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get client by widget key
    const client = await getClientByWidgetKey(widgetKey);
    if (!client) {
      return NextResponse.json(
        { error: 'Invalid widget key' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Get origin from request headers or from the URL
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    const pageUrl = url || origin;

    // Extract domain from page URL for matching
    let urlDomain = '';
    try {
      const parsedUrl = new URL(pageUrl);
      urlDomain = parsedUrl.origin;
    } catch {
      urlDomain = pageUrl;
    }

    // Find matching project by domain
    let project = await getProjectByOrigin(client.id, urlDomain);

    // If no exact match, try to find any project for this client
    if (!project) {
      const projects = await getProjectsByClientId(client.id);
      if (projects.length === 1) {
        // If client has only one project, use it
        project = projects[0];
      } else if (projects.length > 1) {
        // Multiple projects but no domain match - reject for security
        return NextResponse.json(
          { error: 'Domain not authorized for this widget key. Please add this domain to your project settings.' },
          { status: 403, headers: corsHeaders }
        );
      } else {
        return NextResponse.json(
          { error: 'No projects configured for this client' },
          { status: 404, headers: corsHeaders }
        );
      }
    }

    // Save the comment with the actual page URL (not just domain)
    // pageSection is auto-extracted from URL path
    const comment = await saveComment({
      url: pageUrl, // Full page URL including path
      imageData,
      textAnnotations: textAnnotations || [],
      priority: 'med',
      priorityNumber: 0,
      assignee: 'Unassigned',
      projectId: project.id,
      submitterName: submitterName || null,
    });

    return NextResponse.json(
      {
        success: true,
        commentId: comment.id,
        pageSection: comment.page_section
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Widget API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET - Validate widget key and get config
export async function GET(request: NextRequest) {
  await initDB();

  const { searchParams } = new URL(request.url);
  const widgetKey = searchParams.get('key');
  const origin = request.headers.get('origin') || '';

  if (!widgetKey) {
    return NextResponse.json(
      { error: 'Widget key is required' },
      { status: 400, headers: corsHeaders }
    );
  }

  const client = await getClientByWidgetKey(widgetKey);
  if (!client) {
    return NextResponse.json(
      { error: 'Invalid widget key' },
      { status: 401, headers: corsHeaders }
    );
  }

  // Get projects for this client
  const projects = await getProjectsByClientId(client.id);

  // Check if origin matches any project
  let matchedProject = null;
  if (origin) {
    matchedProject = await getProjectByOrigin(client.id, origin);
  }

  return NextResponse.json(
    {
      valid: true,
      clientName: client.name,
      projectCount: projects.length,
      domainMatched: !!matchedProject,
      matchedProject: matchedProject ? { id: matchedProject.id, name: matchedProject.name } : null,
    },
    { headers: cacheHeaders }
  );
}

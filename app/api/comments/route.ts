import { NextRequest, NextResponse } from 'next/server';
import { saveComment, getComments, getCommentsByProjectId, getCommentsByClientId, getClientByToken, initDB } from '@/lib/db';

// Initialize DB on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

// CORS headers for cross-origin feedback widget
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    await ensureDB();
    const body = await request.json();

    const comment = await saveComment({
      url: body.url,
      projectName: body.projectName,
      imageData: body.imageData,
      textAnnotations: body.textAnnotations || [],
      priority: body.priority || 'med',
      priorityNumber: body.priorityNumber || 0,
      assignee: body.assignee || null,
      projectId: body.projectId || null,
    });

    return NextResponse.json(comment, { headers: corsHeaders });
  } catch (error) {
    console.error('Error saving comment:', error);
    return NextResponse.json(
      { error: 'Failed to save comment' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDB();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const token = searchParams.get('token');
    const projectName = searchParams.get('projectName') || undefined;
    const status = searchParams.get('status') as 'open' | 'resolved' | undefined;
    const priority = searchParams.get('priority') as 'high' | 'med' | 'low' | undefined;
    const assignee = searchParams.get('assignee') as 'dev1' | 'dev2' | 'dev3' | 'Sessions' | 'Annie' | 'Mari' | undefined;
    const excludeImages = searchParams.get('excludeImages') === 'true';

    // If token provided, get comments for that client
    if (token) {
      const client = await getClientByToken(token);
      if (!client) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
      }
      const comments = await getCommentsByClientId(client.id, excludeImages);
      return NextResponse.json(comments);
    }

    // If projectId provided, get comments for that project
    if (projectId) {
      const comments = await getCommentsByProjectId(parseInt(projectId), excludeImages);
      return NextResponse.json(comments);
    }

    // Fall back to old behavior (for backwards compatibility)
    const comments = await getComments({ projectName, status, priority, assignee, excludeImages });
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { saveComment, getCommentsByTokenContext, resolveToken, initDB } from '@/lib/db';

// Initialize DB on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return new URL(request.url).searchParams.get('token');
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
      pageSection: body.pageSection, // Optional - auto-extracted from URL if not provided
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
    const pageSection = searchParams.get('pageSection') || undefined;
    const status = searchParams.get('status') as 'open' | 'resolved' | undefined;
    const priority = searchParams.get('priority') as 'high' | 'med' | 'low' | undefined;
    const assignee = searchParams.get('assignee') || undefined;
    const excludeImages = searchParams.get('excludeImages') === 'true';

    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }

    const ctx = await resolveToken(token);
    if (!ctx) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const comments = await getCommentsByTokenContext(ctx, excludeImages, {
      status: status || undefined,
      priority: priority || undefined,
      assignee: assignee || undefined,
      pageSection: pageSection || undefined,
    });
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

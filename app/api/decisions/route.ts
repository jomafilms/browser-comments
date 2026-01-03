import { NextRequest, NextResponse } from 'next/server';
import { getDecisionItems, addDecisionItem, getDecisionItemsByProjectId, getDecisionItemsByClientId, getClientByToken, initDB } from '@/lib/db';

// Initialize DB on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDB();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const token = searchParams.get('token');

    // If token provided, get decisions for that client
    if (token) {
      const client = await getClientByToken(token);
      if (!client) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
      }
      const items = await getDecisionItemsByClientId(client.id);
      return NextResponse.json(items);
    }

    // If projectId provided, get decisions for that project
    if (projectId) {
      const items = await getDecisionItemsByProjectId(parseInt(projectId));
      return NextResponse.json(items);
    }

    // Fall back to getting all decisions (for backwards compatibility)
    const items = await getDecisionItems();
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching decision items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decision items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDB();
    const body = await request.json();

    const item = await addDecisionItem(
      body.noteText,
      body.commentId || null,
      body.noteIndex || null,
      body.source || null,
      body.projectId || null
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error creating decision item:', error);
    return NextResponse.json(
      { error: 'Failed to create decision item' },
      { status: 500 }
    );
  }
}

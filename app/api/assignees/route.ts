import { NextRequest, NextResponse } from 'next/server';
import { initDB, resolveToken, getAssigneesByClientId, createAssignee } from '@/lib/db';

// GET - Fetch assignees for a client
export async function GET(request: NextRequest) {
  await initDB();

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const ctx = await resolveToken(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Assignees are client-level — project tokens read their parent client's assignees
  const assignees = await getAssigneesByClientId(ctx.clientId);
  return NextResponse.json(assignees);
}

// POST - Create a new assignee
export async function POST(request: NextRequest) {
  await initDB();

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const ctx = await resolveToken(token);
  if (!ctx) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  // Note: assignees are client-level, so project tokens add to the shared
  // pool across all projects under this client. Dev teams need this to
  // self-manage their assignee list.

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const assignee = await createAssignee(ctx.clientId, name.trim());
    return NextResponse.json(assignee);
  } catch (error: any) {
    // Handle unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Assignee already exists' }, { status: 409 });
    }
    console.error('Error creating assignee:', error);
    return NextResponse.json({ error: 'Failed to create assignee' }, { status: 500 });
  }
}

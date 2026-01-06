import { NextRequest, NextResponse } from 'next/server';
import { initDB, getClientByToken, getAssigneesByClientId, createAssignee } from '@/lib/db';

// GET - Fetch assignees for a client
export async function GET(request: NextRequest) {
  await initDB();

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const client = await getClientByToken(token);
  if (!client) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const assignees = await getAssigneesByClientId(client.id);
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

  const client = await getClientByToken(token);
  if (!client) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const assignee = await createAssignee(client.id, name.trim());
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

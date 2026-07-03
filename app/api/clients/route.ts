import { NextRequest, NextResponse } from 'next/server';
import { initDB, createClient, getClients } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// Initialize database on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

// GET - List all clients (admin only)
export async function GET(request: NextRequest) {
  await ensureDB();

  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const clients = await getClients();
    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

// POST - Create a new client (admin only)
export async function POST(request: NextRequest) {
  await ensureDB();

  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const client = await createClient(name);
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}

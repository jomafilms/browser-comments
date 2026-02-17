import { NextRequest, NextResponse } from 'next/server';
import { initDB, regenerateClientToken } from '@/lib/db';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const adminSecret = searchParams.get('admin');

  if (adminSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await initDB();

  try {
    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const token = await regenerateClientToken(clientId);
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error regenerating token:', error);
    return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
  }
}

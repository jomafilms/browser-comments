import { NextRequest, NextResponse } from 'next/server';
import { initDB, regenerateClientToken } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = requireAdmin(request);
  if (denied) return denied;

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

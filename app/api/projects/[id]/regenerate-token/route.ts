import { NextRequest, NextResponse } from 'next/server';
import { initDB, generateProjectToken } from '@/lib/db';
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
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const token = await generateProjectToken(projectId);
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error generating project token:', error);
    return NextResponse.json({ error: 'Failed to generate project token' }, { status: 500 });
  }
}

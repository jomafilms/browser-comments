import { NextRequest, NextResponse } from 'next/server';
import { initDB, deleteProject, updateProject } from '@/lib/db';

const ADMIN_SECRET = process.env.ADMIN_SECRET;

function checkAdmin(request: NextRequest): boolean {
  const adminSecret = new URL(request.url).searchParams.get('admin');
  return !!ADMIN_SECRET && adminSecret === ADMIN_SECRET;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await initDB();

  try {
    const { id } = await params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json();
    const updates: { name?: string; url?: string } = {};
    if (typeof body.name === 'string' && body.name.trim().length > 0) {
      updates.name = body.name.trim();
    }
    if (typeof body.url === 'string') {
      // Match the create-form normalization: trim, prefix https:// if missing, strip trailing slash
      updates.url = body.url
        .split(',')
        .map((u: string) => {
          const trimmed = u.trim().replace(/\/$/, '');
          if (!trimmed) return '';
          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return 'https://' + trimmed;
          }
          return trimmed;
        })
        .filter((u: string) => u.length > 0)
        .join(', ');
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const updated = await updateProject(projectId, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await initDB();

  try {
    const { id } = await params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    await deleteProject(projectId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

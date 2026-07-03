import { NextRequest, NextResponse } from 'next/server';
import { deleteProject, updateProject, getProjectById, isRefPrefixTaken, REF_PREFIX_RE } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  try {
    const { id } = await params;
    const projectId = parseInt(id);

    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 });
    }

    const body = await request.json();
    const updates: { name?: string; url?: string; ref_prefix?: string } = {};
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

    // Ticket ref prefix (e.g. "LWF" in LWF-12) — unique within the client
    if (typeof body.refPrefix === 'string') {
      const prefix = body.refPrefix.trim().toUpperCase();
      if (!REF_PREFIX_RE.test(prefix)) {
        return NextResponse.json(
          { error: 'refPrefix must start with a letter, be alphanumeric, and max 8 chars' },
          { status: 400 }
        );
      }
      const project = await getProjectById(projectId);
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      if (await isRefPrefixTaken(project.client_id, prefix, projectId)) {
        return NextResponse.json(
          { error: 'refPrefix already used by another project of this client' },
          { status: 409 }
        );
      }
      updates.ref_prefix = prefix;
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
  const denied = await requireAdmin(request);
  if (denied) return denied;

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

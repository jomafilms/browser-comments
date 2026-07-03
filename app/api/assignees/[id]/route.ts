import { NextRequest, NextResponse } from 'next/server';
import { deleteAssignee, updateAssignee } from '@/lib/db';
import { requireToken, verifyAssigneeScope } from '@/lib/auth';

// Resolve auth + ownership for an assignee id; returns the error response to send, or null.
async function authorizeAssignee(request: NextRequest, id: number, bodyToken?: unknown): Promise<NextResponse | null> {
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  const auth = await requireToken(request, bodyToken);
  if (!auth.ok) return auth.response;

  if (!(await verifyAssigneeScope(auth.ctx, id))) {
    return NextResponse.json({ error: 'Assignee not found or access denied' }, { status: 404 });
  }
  return null;
}

// DELETE - Remove an assignee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const assigneeId = Number(id);

  const denied = await authorizeAssignee(request, assigneeId);
  if (denied) return denied;

  try {
    await deleteAssignee(assigneeId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting assignee:', error);
    return NextResponse.json({ error: 'Failed to delete assignee' }, { status: 500 });
  }
}

// PATCH - Update an assignee
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const assigneeId = Number(id);

  try {
    const body = await request.json();

    const denied = await authorizeAssignee(request, assigneeId, body.token);
    if (denied) return denied;

    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const assignee = await updateAssignee(assigneeId, name.trim());
    return NextResponse.json(assignee);
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Assignee name already exists' }, { status: 409 });
    }
    console.error('Error updating assignee:', error);
    return NextResponse.json({ error: 'Failed to update assignee' }, { status: 500 });
  }
}

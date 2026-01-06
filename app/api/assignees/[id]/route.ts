import { NextRequest, NextResponse } from 'next/server';
import { initDB, deleteAssignee, updateAssignee } from '@/lib/db';

// DELETE - Remove an assignee
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await initDB();

  const { id } = await params;
  const assigneeId = parseInt(id);

  if (isNaN(assigneeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

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
  await initDB();

  const { id } = await params;
  const assigneeId = parseInt(id);

  if (isNaN(assigneeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
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

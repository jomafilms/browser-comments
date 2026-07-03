import { NextRequest, NextResponse } from 'next/server';
import { updateCommentStatus, addNoteToComment, deleteComment, updateCommentPriority, updateCommentAssignee } from '@/lib/db';
import pool from '@/lib/db';
import { requireToken, verifyCommentScope } from '@/lib/auth';

const VALID_STATUSES = ['open', 'resolved'] as const;
const VALID_PRIORITIES = ['high', 'med', 'low'] as const;

// Resolve auth + ownership for a comment id; returns the error response to send, or null.
async function authorizeComment(request: NextRequest, id: number): Promise<NextResponse | null> {
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
  }
  const auth = await requireToken(request);
  if (!auth.ok) return auth.response;

  const hasAccess = await verifyCommentScope(auth.ctx, id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 });
  }
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await context.params;
    const id = Number(idString);

    const denied = await authorizeComment(request, id);
    if (denied) return denied;

    const dbClient = await pool.connect();
    try {
      const result = await dbClient.query(
        'SELECT image_data FROM comments WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Comment not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ image_data: result.rows[0].image_data });
    } finally {
      dbClient.release();
    }
  } catch (error) {
    console.error('Error fetching comment image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comment image' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id: idString } = await context.params;
    const id = Number(idString);

    const denied = await authorizeComment(request, id);
    if (denied) return denied;

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }
    if (body.priorityNumber !== undefined && !Number.isInteger(body.priorityNumber)) {
      return NextResponse.json({ error: 'Invalid priorityNumber' }, { status: 400 });
    }
    if (body.note !== undefined && typeof body.note !== 'string') {
      return NextResponse.json({ error: 'Invalid note' }, { status: 400 });
    }
    if (body.assignee !== undefined && typeof body.assignee !== 'string') {
      return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 });
    }

    if (body.status) {
      await updateCommentStatus(id, body.status);
    }

    if (body.note) {
      await addNoteToComment(id, body.note);
    }

    if (body.priority !== undefined && body.priorityNumber !== undefined) {
      await updateCommentPriority(id, body.priority, body.priorityNumber);
    }

    if (body.assignee !== undefined) {
      await updateCommentAssignee(id, body.assignee);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await context.params;
    const id = Number(idString);

    const denied = await authorizeComment(request, id);
    if (denied) return denied;

    await deleteComment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

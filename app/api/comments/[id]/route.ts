import { NextRequest, NextResponse } from 'next/server';
import { updateCommentStatus, addNoteToComment, deleteComment, updateCommentPriority, updateCommentAssignee, findCommentByRef, withClient } from '@/lib/db';
import { requireToken, verifyCommentScope } from '@/lib/auth';

const VALID_STATUSES = ['open', 'resolved'] as const;
const VALID_PRIORITIES = ['high', 'med', 'low'] as const;

// Resolve auth + the [id] param to a serial comment id.
// Bare integers stay serial PKs (the pre-v4 API contract — CLI/MCP send db
// ids here); refs like "LWF-12" and UUIDs resolve via findCommentByRef,
// which enforces the token's scope.
async function resolveComment(
  request: NextRequest,
  idString: string
): Promise<{ id: number } | { response: NextResponse }> {
  const auth = await requireToken(request);
  if (!auth.ok) return { response: auth.response };

  if (/^\d+$/.test(idString)) {
    const id = Number(idString);
    const hasAccess =
      Number.isInteger(id) && id <= 2147483647 && (await verifyCommentScope(auth.ctx, id));
    if (!hasAccess) {
      return {
        response: NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 }),
      };
    }
    return { id };
  }

  const found = await findCommentByRef(auth.ctx, idString);
  if (!found) {
    return {
      response: NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 }),
    };
  }
  return { id: found.id };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await context.params;

    const resolved = await resolveComment(request, idString);
    if ('response' in resolved) return resolved.response;
    const id = resolved.id;

    const result = await withClient((dbClient) =>
      dbClient.query('SELECT image_data FROM comments WHERE id = $1', [id])
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    return NextResponse.json({ image_data: result.rows[0].image_data });
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

    const resolved = await resolveComment(request, idString);
    if ('response' in resolved) return resolved.response;
    const id = resolved.id;

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

    const resolved = await resolveComment(request, idString);
    if ('response' in resolved) return resolved.response;

    await deleteComment(resolved.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

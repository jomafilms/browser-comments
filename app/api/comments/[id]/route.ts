import { NextRequest, NextResponse } from 'next/server';
import { updateCommentStatus, addNoteToComment, deleteComment, updateCommentPriority, updateCommentAssignee } from '@/lib/db';
import pool from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idString } = await context.params;
    const id = parseInt(idString);

    const client = await pool.connect();
    try {
      const result = await client.query(
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
      client.release();
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
    const id = parseInt(idString);

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
    const id = parseInt(idString);

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

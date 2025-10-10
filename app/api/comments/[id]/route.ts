import { NextRequest, NextResponse } from 'next/server';
import { updateCommentStatus, addNoteToComment } from '@/lib/db';

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

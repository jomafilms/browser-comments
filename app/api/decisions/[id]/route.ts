import { NextRequest, NextResponse } from 'next/server';
import { deleteDecisionItem, updateDecisionItem, initDB } from '@/lib/db';

// Initialize DB on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDB();
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid decision item ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const item = await updateDecisionItem(id, body.noteText, body.source);
    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating decision item:', error);
    return NextResponse.json(
      { error: 'Failed to update decision item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDB();
    const { id: idParam } = await params;
    const id = parseInt(idParam);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid decision item ID' },
        { status: 400 }
      );
    }

    await deleteDecisionItem(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting decision item:', error);
    return NextResponse.json(
      { error: 'Failed to delete decision item' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { deleteDecisionItem, updateDecisionItem, initDB } from '@/lib/db';
import { requireToken, verifyDecisionScope } from '@/lib/auth';

// Initialize DB on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

// Resolve auth + ownership for a decision id; returns the error response to send, or null.
async function authorizeDecision(request: NextRequest, id: number, bodyToken?: unknown): Promise<NextResponse | null> {
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'Invalid decision item ID' }, { status: 400 });
  }
  const auth = await requireToken(request, bodyToken);
  if (!auth.ok) return auth.response;

  if (!(await verifyDecisionScope(auth.ctx, id))) {
    return NextResponse.json({ error: 'Decision not found or access denied' }, { status: 404 });
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDB();
    const { id: idParam } = await params;
    const id = Number(idParam);

    const body = await request.json();

    const denied = await authorizeDecision(request, id, body.token);
    if (denied) return denied;

    if (typeof body.noteText !== 'string' || !body.noteText.trim()) {
      return NextResponse.json({ error: 'noteText is required' }, { status: 400 });
    }

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
    const id = Number(idParam);

    const denied = await authorizeDecision(request, id);
    if (denied) return denied;

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

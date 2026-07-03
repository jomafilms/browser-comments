import { NextRequest, NextResponse } from 'next/server';
import { withClient } from '@/lib/db';
import { requireToken, verifyCommentsScope } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid updates array' },
        { status: 400 }
      );
    }

    const ids = updates.map((u) => u.id);
    if (!ids.every(Number.isInteger) || !updates.every((u) => Number.isInteger(u.priorityNumber))) {
      return NextResponse.json(
        { error: 'Each update needs integer id and priorityNumber' },
        { status: 400 }
      );
    }

    const auth = await requireToken(request, body.token);
    if (!auth.ok) return auth.response;

    // Every comment in the batch must belong to the token's scope
    if (!(await verifyCommentsScope(auth.ctx, ids))) {
      return NextResponse.json(
        { error: 'One or more comments not found or access denied' },
        { status: 404 }
      );
    }

    await withClient(async (client) => {
      try {
        await client.query('BEGIN');

        // Update each comment's priority number
        for (const update of updates) {
          await client.query(
            'UPDATE comments SET priority_number = $1, updated_at = NOW() WHERE id = $2',
            [update.priorityNumber, update.id]
          );
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error batch updating priorities:', error);
    return NextResponse.json(
      { error: 'Failed to batch update priorities' },
      { status: 500 }
    );
  }
}

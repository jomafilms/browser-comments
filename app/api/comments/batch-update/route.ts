import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

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

    const client = await pool.connect();
    try {
      // Start a transaction
      await client.query('BEGIN');

      // Update each comment's priority number
      for (const update of updates) {
        await client.query(
          'UPDATE comments SET priority_number = $1, updated_at = NOW() WHERE id = $2',
          [update.priorityNumber, update.id]
        );
      }

      // Commit the transaction
      await client.query('COMMIT');

      return NextResponse.json({ success: true });
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error batch updating priorities:', error);
    return NextResponse.json(
      { error: 'Failed to batch update priorities' },
      { status: 500 }
    );
  }
}

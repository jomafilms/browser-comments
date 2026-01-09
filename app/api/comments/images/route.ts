import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Bulk fetch images by IDs - more efficient than individual requests
export async function POST(request: NextRequest) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    // Limit to 20 at a time to prevent huge payloads
    const limitedIds = ids.slice(0, 20);

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, image_data FROM comments WHERE id = ANY($1)',
        [limitedIds]
      );

      const images: Record<number, string> = {};
      result.rows.forEach(row => {
        images[row.id] = row.image_data;
      });

      return NextResponse.json({ images });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}

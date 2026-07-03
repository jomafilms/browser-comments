import { NextRequest, NextResponse } from 'next/server';
import { withClient } from '@/lib/db';
import { requireToken } from '@/lib/auth';

// Bulk fetch images by IDs - more efficient than individual requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    const auth = await requireToken(request, body.token);
    if (!auth.ok) return auth.response;
    const ctx = auth.ctx;

    // Limit to 20 at a time to prevent huge payloads
    const limitedIds = ids.slice(0, 20);

    // Restrict to comments the token can access
    const result = await withClient((client) =>
      ctx.projectId
        ? client.query(
            'SELECT id, image_data FROM comments WHERE id = ANY($1) AND project_id = $2',
            [limitedIds, ctx.projectId]
          )
        : client.query(
            'SELECT id, image_data FROM comments WHERE id = ANY($1) AND client_id = $2',
            [limitedIds, ctx.clientId]
          )
    );

    const images: Record<number, string> = {};
    result.rows.forEach(row => {
      images[row.id] = row.image_data;
    });

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error fetching images:', error);
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}

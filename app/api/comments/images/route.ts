import { NextRequest, NextResponse } from 'next/server';
import pool, { resolveToken } from '@/lib/db';

function extractToken(request: NextRequest, bodyToken?: unknown): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  if (typeof bodyToken === 'string' && bodyToken.length > 0) return bodyToken;
  return new URL(request.url).searchParams.get('token');
}

// Bulk fetch images by IDs - more efficient than individual requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 });
    }

    const token = extractToken(request, body.token);
    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }
    const ctx = await resolveToken(token);
    if (!ctx) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Limit to 20 at a time to prevent huge payloads
    const limitedIds = ids.slice(0, 20);

    const client = await pool.connect();
    try {
      // Restrict to comments the token can access
      const result = ctx.projectId
        ? await client.query(
            'SELECT id, image_data FROM comments WHERE id = ANY($1) AND project_id = $2',
            [limitedIds, ctx.projectId]
          )
        : await client.query(
            'SELECT id, image_data FROM comments WHERE id = ANY($1) AND client_id = $2',
            [limitedIds, ctx.clientId]
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

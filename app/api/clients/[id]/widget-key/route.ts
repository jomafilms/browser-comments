import { NextRequest, NextResponse } from 'next/server';
import { initDB, generateWidgetKeyForClient } from '@/lib/db';

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'browser-comments-admin-2024';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const adminSecret = searchParams.get('admin');

  if (adminSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await initDB();

  try {
    const { id } = await params;
    const clientId = parseInt(id);

    if (isNaN(clientId)) {
      return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 });
    }

    const widgetKey = await generateWidgetKeyForClient(clientId);
    return NextResponse.json({ widget_key: widgetKey });
  } catch (error) {
    console.error('Error generating widget key:', error);
    return NextResponse.json({ error: 'Failed to generate widget key' }, { status: 500 });
  }
}

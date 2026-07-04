import { NextRequest, NextResponse } from 'next/server';
import { resolveToken, getNotificationSettings, updateNotificationSettings } from '@/lib/db';

// Per-client email notification settings, token-scoped. Used by the client
// settings page (magic-link token) and the admin client editor (client token).
// Notifications are client-level, so project tokens are read-only.

// GET ?token= → { settings, readOnly }
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const ctx = await resolveToken(token);
  if (!ctx) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

  const settings = await getNotificationSettings(ctx.clientId);
  return NextResponse.json({ settings, readOnly: ctx.projectId !== null });
}

// POST ?token= → update (client tokens only)
export async function POST(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const ctx = await resolveToken(token);
  if (!ctx) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  if (ctx.projectId !== null) {
    return NextResponse.json(
      { error: 'Notifications are client-level. Use a client token to change them.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    // updateNotificationSettings validates (emails, enums, caps) and throws on
    // bad input — surface that as a 400 with the operator-facing message.
    const settings = await updateNotificationSettings(ctx.clientId, body);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save notification settings';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

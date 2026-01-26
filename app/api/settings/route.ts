import { NextRequest, NextResponse } from 'next/server';
import { initDB, getClientByToken, getWidgetSettingsByKey, updateWidgetSettings } from '@/lib/db';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Cache headers for widget settings (1 hour browser cache, CDN can serve stale while revalidating)
const cacheHeaders = {
  ...corsHeaders,
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Fetch widget settings (by widget key for external use, or by token for settings page)
export async function GET(request: NextRequest) {
  await initDB();

  const { searchParams } = new URL(request.url);
  const widgetKey = searchParams.get('key');
  const token = searchParams.get('token');

  // For widget.js - fetch by widget key (with caching)
  if (widgetKey) {
    const settings = await getWidgetSettingsByKey(widgetKey);
    return NextResponse.json(settings || {}, { headers: cacheHeaders });
  }

  // For settings page - fetch by token
  if (token) {
    const client = await getClientByToken(token);
    if (!client) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json({
      settings: client.widget_settings || {},
      clientName: client.name,
      widgetKey: client.widget_key || null,
    });
  }

  return NextResponse.json({ error: 'Missing key or token' }, { status: 400, headers: corsHeaders });
}

// POST - Update widget settings (by token)
export async function POST(request: NextRequest) {
  await initDB();

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 });
  }

  const client = await getClientByToken(token);
  if (!client) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { buttonText, buttonPosition, primaryColor, modalTitle, modalSubtitle, successMessage } = body;

    // Validate position if provided
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    if (buttonPosition && !validPositions.includes(buttonPosition)) {
      return NextResponse.json({ error: 'Invalid button position' }, { status: 400 });
    }

    const settings = {
      buttonText: buttonText || 'Feedback',
      buttonPosition: buttonPosition || 'bottom-right',
      primaryColor: primaryColor || '#2563eb',
      modalTitle: modalTitle || 'Send Feedback',
      modalSubtitle: modalSubtitle || 'Draw on the screenshot to highlight issues',
      successMessage: successMessage || 'Your feedback has been submitted!',
    };

    const updatedClient = await updateWidgetSettings(client.id, settings);
    return NextResponse.json({ success: true, settings: updatedClient.widget_settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getBranding, setBranding, BrandingScope } from '@/lib/db';

// Operator branding CRUD (admin only). Storage + resolution live in
// lib/db/branding.ts; this route is the edit surface for the admin dashboard.
// Display on client-facing pages uses the resolved branding from /api/settings.

const SCOPES: BrandingScope[] = ['instance', 'client', 'project'];

function parseScope(value: unknown): BrandingScope | null {
  return SCOPES.includes(value as BrandingScope) ? (value as BrandingScope) : null;
}

// Instance branding has no id; client/project branding requires a numeric id.
function resolveId(scope: BrandingScope, raw: unknown): number | undefined | 'invalid' {
  if (scope === 'instance') return undefined;
  const id = Number(raw);
  return Number.isInteger(id) ? id : 'invalid';
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const scope = parseScope(searchParams.get('scope'));
  if (!scope) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });

  const id = resolveId(scope, searchParams.get('id'));
  if (id === 'invalid') return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    return NextResponse.json(await getBranding(scope, id));
  } catch (error) {
    console.error('Error fetching branding:', error);
    return NextResponse.json({ error: 'Failed to fetch branding' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  let scope: BrandingScope | null;
  let id: number | undefined | 'invalid';
  try {
    const body = await request.json();
    scope = parseScope(body.scope);
    if (!scope) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    id = resolveId(scope, body.id);
    if (id === 'invalid') return NextResponse.json({ error: 'id required' }, { status: 400 });

    // setBranding validates (http(s)-only logoUrl, length caps) and throws on
    // bad input — surface that as a 400 with the operator-facing message.
    const saved = await setBranding(scope, body.branding ?? {}, id);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save branding';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

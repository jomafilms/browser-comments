import { NextRequest, NextResponse } from 'next/server';
import {
  createWebhook,
  listWebhooksByContext,
  listAllWebhooks,
  deleteWebhook,
  verifyWebhookScope,
  Webhook,
  WebhookEvent,
  WEBHOOK_EVENTS,
} from '@/lib/db';
import { requireToken, isAdmin, verifyProjectScope } from '@/lib/auth';
import { validateWebhookUrl } from '@/lib/webhook-delivery';

// Outbound webhook registration, token-scoped:
//  - a project token manages only its own project's hooks
//  - a client token manages every hook under the client
//  - admin (Bearer ADMIN_SECRET) sees/deletes all
// The signing secret is returned in full ONLY from POST (reveal once); list
// responses expose has_secret instead.

function publicWebhook(w: Webhook) {
  const { secret, ...rest } = w;
  void secret;
  return { ...rest, has_secret: true };
}

function parseEvents(raw: unknown): WebhookEvent[] | { error: string } {
  if (raw === undefined) return ['comment.created']; // default
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'events must be a non-empty array' };
  }
  const invalid = raw.filter((e) => !WEBHOOK_EVENTS.includes(e as WebhookEvent));
  if (invalid.length > 0) {
    return { error: `Unknown events: ${invalid.join(', ')}. Allowed: ${WEBHOOK_EVENTS.join(', ')}` };
  }
  return Array.from(new Set(raw)) as WebhookEvent[];
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireToken(request);
    if (auth.ok) {
      const hooks = await listWebhooksByContext(auth.ctx);
      return NextResponse.json(hooks.map(publicWebhook));
    }
    if (isAdmin(request)) {
      const hooks = await listAllWebhooks();
      return NextResponse.json(hooks.map(publicWebhook));
    }
    return auth.response;
  } catch (error) {
    console.error('Error listing webhooks:', error);
    return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const auth = await requireToken(request, body.token);
    if (!auth.ok) return auth.response;

    const valid = validateWebhookUrl(body.url);
    if (!valid.ok) {
      return NextResponse.json({ error: valid.reason }, { status: 400 });
    }

    const events = parseEvents(body.events);
    if ('error' in events) {
      return NextResponse.json({ error: events.error }, { status: 400 });
    }

    // Resolve which project the hook is scoped to.
    let projectId: number | null;
    if (auth.ctx.projectId) {
      // Project token: always its own project; reject a mismatching projectId.
      if (body.projectId !== undefined && body.projectId !== auth.ctx.projectId) {
        return NextResponse.json({ error: 'projectId out of scope for this token' }, { status: 400 });
      }
      projectId = auth.ctx.projectId;
    } else if (body.projectId === undefined || body.projectId === null) {
      projectId = null; // client token, no project → fires for all client projects
    } else if (!Number.isInteger(body.projectId) || !(await verifyProjectScope(auth.ctx, body.projectId))) {
      return NextResponse.json({ error: 'Invalid or out-of-scope projectId' }, { status: 400 });
    } else {
      projectId = body.projectId;
    }

    // Returned WITH secret — this is the only time the full secret is shown.
    const hook = await createWebhook({
      clientId: auth.ctx.clientId,
      projectId,
      url: valid.url.toString(),
      events,
    });
    return NextResponse.json(hook, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: 'Valid webhook id required' }, { status: 400 });
    }

    const auth = await requireToken(request);
    if (auth.ok) {
      if (!(await verifyWebhookScope(auth.ctx, id))) {
        return NextResponse.json({ error: 'Webhook not found or access denied' }, { status: 404 });
      }
    } else if (!isAdmin(request)) {
      return auth.response;
    }

    await deleteWebhook(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}

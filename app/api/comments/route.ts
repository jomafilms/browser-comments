import { NextRequest, NextResponse } from 'next/server';
import { saveComment, getCommentsByTokenContext } from '@/lib/db';
import { requireToken, verifyProjectScope } from '@/lib/auth';
import { checkRateLimit, checkBodySize } from '@/lib/rate-limit';
import { onCommentCreated } from '@/lib/notify';

// Max screenshot payload — JPEGs from the widget stay well under this
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

// CORS headers for cross-origin feedback widget
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const tooLarge = checkBodySize(request, MAX_BODY_BYTES, corsHeaders);
    if (tooLarge) return tooLarge;

    const body = await request.json();

    const auth = await requireToken(request, body.token);
    if (!auth.ok) return auth.response;

    const limited = checkRateLimit(request, `comments:${auth.ctx.clientId}`, 'write', corsHeaders);
    if (limited) return limited;

    if (
      typeof body.imageData !== 'string' ||
      !body.imageData.startsWith('data:image/') ||
      body.imageData.length > MAX_IMAGE_BYTES
    ) {
      return NextResponse.json(
        { error: 'imageData must be a data:image/* URL under 4MB' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Project tokens may omit projectId; everything else must name a project in scope
    const projectId = body.projectId ?? auth.ctx.projectId;
    if (!projectId || !(await verifyProjectScope(auth.ctx, projectId))) {
      return NextResponse.json(
        { error: 'Invalid or out-of-scope projectId' },
        { status: 400, headers: corsHeaders }
      );
    }

    const comment = await saveComment({
      url: body.url,
      pageSection: body.pageSection, // Optional - auto-extracted from URL if not provided
      imageData: body.imageData,
      textAnnotations: body.textAnnotations || [],
      priority: body.priority || 'med',
      priorityNumber: body.priorityNumber || 0,
      assignee: body.assignee || null,
      projectId,
      submitterName: body.submitterName,
      userAgent: body.userAgent,
      viewportW: body.viewportW,
      viewportH: body.viewportH,
      deviceCategory: body.deviceCategory,
      deviceModel: body.deviceModel,
    });

    // Fire webhooks after the response is sent (no added latency)
    onCommentCreated(comment, new URL(request.url).origin);

    return NextResponse.json(comment, { headers: corsHeaders });
  } catch (error) {
    console.error('Error saving comment:', error);
    return NextResponse.json(
      { error: 'Failed to save comment' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageSection = searchParams.get('pageSection') || undefined;
    const status = searchParams.get('status') as 'open' | 'resolved' | undefined;
    const priority = searchParams.get('priority') as 'high' | 'med' | 'low' | undefined;
    const assignee = searchParams.get('assignee') || undefined;
    const deviceCategory = searchParams.get('deviceCategory') || undefined;
    const since = searchParams.get('since') || undefined; // ISO8601 — polling checkpoint
    const excludeImages = searchParams.get('excludeImages') === 'true';

    const auth = await requireToken(request);
    if (!auth.ok) return auth.response;

    const limited = checkRateLimit(request, `comments:${auth.ctx.clientId}`, 'read');
    if (limited) return limited;

    if (since !== undefined && Number.isNaN(Date.parse(since))) {
      return NextResponse.json({ error: 'since must be an ISO8601 timestamp' }, { status: 400 });
    }

    // Stamp server time BEFORE the query so a poller re-using it as the next
    // `since` never misses a comment written mid-query. Sent as a header (not a
    // body field) to keep the response body a plain array — additive, no break.
    const serverTime = new Date().toISOString();

    const comments = await getCommentsByTokenContext(auth.ctx, excludeImages, {
      status: status || undefined,
      priority: priority || undefined,
      assignee: assignee || undefined,
      pageSection: pageSection || undefined,
      deviceCategory: deviceCategory || undefined,
      since,
    });
    return NextResponse.json(comments, { headers: { 'X-Server-Time': serverTime } });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

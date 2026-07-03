import { NextRequest, NextResponse } from 'next/server';
import { addDecisionItem, getDecisionItemsByProjectId, getDecisionItemsByClientId } from '@/lib/db';
import { requireToken, verifyProjectScope, verifyCommentScope } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    const auth = await requireToken(request);
    if (!auth.ok) return auth.response;

    // Explicit projectId filter — must be inside the token's scope
    if (projectId) {
      const id = parseInt(projectId);
      if (!(await verifyProjectScope(auth.ctx, id))) {
        return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
      }
      const items = await getDecisionItemsByProjectId(id);
      return NextResponse.json(items);
    }

    // Project token: only that project's decisions
    if (auth.ctx.projectId) {
      const items = await getDecisionItemsByProjectId(auth.ctx.projectId);
      return NextResponse.json(items);
    }

    // Client token: all decisions for the client
    const items = await getDecisionItemsByClientId(auth.ctx.clientId);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching decision items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decision items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const auth = await requireToken(request, body.token);
    if (!auth.ok) return auth.response;

    if (typeof body.noteText !== 'string' || !body.noteText.trim()) {
      return NextResponse.json({ error: 'noteText is required' }, { status: 400 });
    }

    // Project tokens default to their own project; explicit ids must be in scope
    const projectId = body.projectId ?? auth.ctx.projectId ?? null;
    if (projectId !== null && !(await verifyProjectScope(auth.ctx, projectId))) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }
    if (body.commentId && !(await verifyCommentScope(auth.ctx, body.commentId))) {
      return NextResponse.json({ error: 'Comment not found or access denied' }, { status: 404 });
    }

    const item = await addDecisionItem(
      body.noteText,
      body.commentId || null,
      body.noteIndex || null,
      body.source || null,
      projectId
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error creating decision item:', error);
    return NextResponse.json(
      { error: 'Failed to create decision item' },
      { status: 500 }
    );
  }
}

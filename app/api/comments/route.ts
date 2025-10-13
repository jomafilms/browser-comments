import { NextRequest, NextResponse } from 'next/server';
import { saveComment, getComments, initDB } from '@/lib/db';

// Initialize DB on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDB();
    const body = await request.json();

    const comment = await saveComment({
      url: body.url,
      projectName: body.projectName,
      imageData: body.imageData,
      textAnnotations: body.textAnnotations || [],
    });

    return NextResponse.json(comment);
  } catch (error) {
    console.error('Error saving comment:', error);
    return NextResponse.json(
      { error: 'Failed to save comment' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDB();
    const { searchParams } = new URL(request.url);
    const projectName = searchParams.get('projectName') || undefined;
    const status = searchParams.get('status') as 'open' | 'resolved' | undefined;
    const excludeImages = searchParams.get('excludeImages') === 'true';

    const comments = await getComments({ projectName, status, excludeImages });
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

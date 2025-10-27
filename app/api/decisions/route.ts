import { NextRequest, NextResponse } from 'next/server';
import { getDecisionItems, addDecisionItem, initDB } from '@/lib/db';

// Initialize DB on first request
let dbInitialized = false;

async function ensureDB() {
  if (!dbInitialized) {
    await initDB();
    dbInitialized = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureDB();
    const items = await getDecisionItems();
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
    await ensureDB();
    const body = await request.json();

    const item = await addDecisionItem(
      body.commentId,
      body.noteText,
      body.noteIndex
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

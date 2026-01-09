import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Ping failed:', error);
    return NextResponse.json({ status: 'error', message: 'Database connection failed' }, { status: 500 });
  }
}

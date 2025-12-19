
import { NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const results = await executeQuery(
      `SELECT country, COUNT(*) as count
       FROM systeminformation
       WHERE country IS NOT NULL AND country != '' AND country != 'Unknown'
       GROUP BY country
       ORDER BY count DESC`
    );

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching geo distribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch geo distribution data' },
      { status: 500 }
    );
  }
}

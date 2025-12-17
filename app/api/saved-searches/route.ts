
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/mysql';

export async function GET() {
  try {
    const savedSearches = await executeQuery(
      `SELECT * FROM saved_searches ORDER BY created_at DESC`
    );
    return NextResponse.json(savedSearches);
  } catch (error) {
    console.error('Error fetching saved searches:', error);
    return NextResponse.json({ error: 'Failed to fetch saved searches' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, query, search_type } = body;

    if (!name || !query || !search_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result: any = await executeQuery(
      `INSERT INTO saved_searches (name, query, search_type) VALUES (?, ?, ?)`,
      [name, query, search_type]
    );

    return NextResponse.json({ id: result.insertId, name, query, search_type });
  } catch (error) {
    console.error('Error saving search:', error);
    return NextResponse.json({ error: 'Failed to save search' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    await executeQuery(`DELETE FROM saved_searches WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved search:', error);
    return NextResponse.json({ error: 'Failed to delete saved search' }, { status: 500 });
  }
}

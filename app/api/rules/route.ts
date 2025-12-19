
import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rules = await executeQuery(
      `SELECT * FROM detection_rules ORDER BY created_at DESC`
    );
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Error fetching detection rules:', error);
    return NextResponse.json({ error: 'Failed to fetch detection rules' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, pattern, severity, description } = body;

    if (!name || !pattern) {
      return NextResponse.json({ error: 'Name and Pattern are required' }, { status: 400 });
    }

    // Validate regex
    try {
      new RegExp(pattern);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid Regex Pattern' }, { status: 400 });
    }

    const result: any = await executeQuery(
      `INSERT INTO detection_rules (name, pattern, severity, description) VALUES (?, ?, ?, ?)`,
      [name, pattern, severity || 'medium', description || '']
    );

    return NextResponse.json({
      id: result.insertId,
      name,
      pattern,
      severity: severity || 'medium',
      description: description || ''
    });
  } catch (error) {
    console.error('Error creating detection rule:', error);
    return NextResponse.json({ error: 'Failed to create detection rule' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    await executeQuery(`DELETE FROM detection_rules WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting detection rule:', error);
    return NextResponse.json({ error: 'Failed to delete detection rule' }, { status: 500 });
  }
}

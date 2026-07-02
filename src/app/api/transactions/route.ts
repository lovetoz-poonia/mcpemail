import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, thread_id, sender, subject, category, sentiment, priority, received_time, status } = body;

    const db = await getDb();
    
    // Check if exists
    const existing = await db.get('SELECT id FROM transactions WHERE id = ?', [id]);
    
    if (existing) {
      // Update existing
      await db.run(
        'UPDATE transactions SET category = ?, sentiment = ?, priority = ?, status = ? WHERE id = ?',
        [category, sentiment, priority, status, id]
      );
    } else {
      // Insert new
      await db.run(
        'INSERT INTO transactions (id, thread_id, sender, subject, category, sentiment, priority, received_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, thread_id, sender, subject, category, sentiment, priority, received_time, status]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Transaction POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, replied_time, tat_seconds, status } = body;

    const db = await getDb();
    
    await db.run(
      'UPDATE transactions SET replied_time = ?, tat_seconds = ?, status = ? WHERE id = ?',
      [replied_time, tat_seconds, status, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Transaction PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

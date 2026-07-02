import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

export async function getDb() {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = await open({
    filename: path.join(dataDir, 'transactions.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      thread_id TEXT,
      sender TEXT,
      subject TEXT,
      category TEXT,
      sentiment TEXT,
      priority TEXT,
      received_time TEXT,
      replied_time TEXT,
      tat_seconds INTEGER,
      status TEXT
    )
  `);

  return db;
}

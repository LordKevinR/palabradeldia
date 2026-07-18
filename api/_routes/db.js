import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("CRITICAL ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables must be set!");
}

const db = createClient({
  url,
  authToken,
});

export async function initDB() {
  console.log('Initializing database tables for Palabra del Día...');
  try {
    const tableQueries = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        public_key TEXT NOT NULL,
        counter INTEGER DEFAULT 0,
        transports TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        challenge TEXT,
        expires_at INTEGER NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`,
      `CREATE TABLE IF NOT EXISTS user_guesses (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        word_index INTEGER NOT NULL,
        guesses TEXT NOT NULL,
        won INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(user_id, date, word_index)
      )`,
      `CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        max_streak INTEGER DEFAULT 0,
        last_played_date TEXT,
        guess_distribution TEXT
      )`
    ];

    await db.batch(tableQueries);
    console.log('Database tables successfully initialized.');
  } catch (error) {
    console.error('Error initializing database tables:', error);
    throw error;
  }
}

export default db;

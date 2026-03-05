import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '../blindtest.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    answer TEXT NOT NULL,
    theme TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    start_time INTEGER NOT NULL DEFAULT 0
  )
`);

export interface Track {
    id: number;
    title: string;
    answer: string;
    theme: string;
    difficulty: string;
    audio_url: string;
    start_time: number;
}

export function getTracks(limit: number = 3, theme: string = 'Tous'): Track[] {
    if (theme === 'Tous') {
        const stmt = db.prepare('SELECT * FROM tracks ORDER BY RANDOM() LIMIT ?');
        return stmt.all(limit) as Track[];
    } else {
        const stmt = db.prepare('SELECT * FROM tracks WHERE theme = ? ORDER BY RANDOM() LIMIT ?');
        return stmt.all(theme, limit) as Track[];
    }
}

export function getThemes(): string[] {
    const stmt = db.prepare('SELECT DISTINCT theme FROM tracks');
    const rows = stmt.all() as { theme: string }[];
    return rows.map(r => r.theme).sort((a, b) => a.localeCompare(b));
}

export function addTrack(track: Omit<Track, 'id'>) {
    // Add start_time column if it doesn't exist (migration for existing DBs)
    try { db.exec('ALTER TABLE tracks ADD COLUMN start_time INTEGER NOT NULL DEFAULT 0'); } catch (_) { }
    const stmt = db.prepare(`
        INSERT INTO tracks (title, answer, theme, difficulty, audio_url, start_time)
        VALUES (@title, @answer, @theme, @difficulty, @audio_url, @start_time)
    `);
    stmt.run({ ...track, start_time: track.start_time ?? 0 });
}

export function clearTracks() {
    db.exec('DELETE FROM tracks');
}

export default db;

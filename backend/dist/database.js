"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTracks = getTracks;
exports.getThemes = getThemes;
exports.addTrack = addTrack;
exports.clearTracks = clearTracks;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const dbPath = path_1.default.join(__dirname, '../blindtest.db');
const db = new better_sqlite3_1.default(dbPath);
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
function getTracks(limit = 3, theme = 'Tous') {
    if (theme === 'Tous') {
        const stmt = db.prepare('SELECT * FROM tracks ORDER BY RANDOM() LIMIT ?');
        return stmt.all(limit);
    }
    else {
        const stmt = db.prepare('SELECT * FROM tracks WHERE theme = ? ORDER BY RANDOM() LIMIT ?');
        return stmt.all(theme, limit);
    }
}
function getThemes() {
    const stmt = db.prepare('SELECT DISTINCT theme FROM tracks');
    const rows = stmt.all();
    return rows.map(r => r.theme);
}
function addTrack(track) {
    // Add start_time column if it doesn't exist (migration for existing DBs)
    try {
        db.exec('ALTER TABLE tracks ADD COLUMN start_time INTEGER NOT NULL DEFAULT 0');
    }
    catch (_) { }
    const stmt = db.prepare(`
        INSERT INTO tracks (title, answer, theme, difficulty, audio_url, start_time)
        VALUES (@title, @answer, @theme, @difficulty, @audio_url, @start_time)
    `);
    stmt.run({ ...track, start_time: track.start_time ?? 0 });
}
function clearTracks() {
    db.exec('DELETE FROM tracks');
}
exports.default = db;

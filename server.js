'use strict';

// Math Quest Kids server: serves the game and stores every player's records in a SQLite database,
// so the same name sees the same history on any machine that opens this server.
// Needs Node.js 22.5+ (uses the built-in node:sqlite module, no npm install required).

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'mathquest.db');
const MAX_BODY = 10 * 1024;
const NAME_RE = /^[\p{L}\p{N} ._-]{1,30}$/u;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Database ----------
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_key   TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_visit TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS records (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date       TEXT NOT NULL,
    correct    INTEGER NOT NULL DEFAULT 0,
    wrong      INTEGER NOT NULL DEFAULT 0,
    total_time REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
  );
`);

const sql = {
  upsertUser: db.prepare(`
    INSERT INTO users (user_key, name, created_at, last_visit) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_key) DO UPDATE SET name = excluded.name, last_visit = excluded.last_visit
    RETURNING id, user_key, name`),
  records: db.prepare(`
    SELECT date, correct, wrong, total_time FROM records WHERE user_id = ? ORDER BY date DESC`),
  addResult: db.prepare(`
    INSERT INTO records (user_id, date, correct, wrong, total_time) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET
      correct = correct + excluded.correct,
      wrong = wrong + excluded.wrong,
      total_time = total_time + excluded.total_time`),
};

const userKey = (name) => name.trim().replace(/\s+/g, ' ').toLowerCase();

// Creates the user if they don't exist, otherwise updates their last visit.
function upsertUser(name) {
  const now = new Date().toISOString();
  const clean = name.trim().replace(/\s+/g, ' ');
  return sql.upsertUser.get(userKey(clean), clean, now, now);
}

function userWithRecords(user) {
  const records = sql.records.all(user.id).map((r) => {
    const total = r.correct + r.wrong;
    return {
      date: r.date,
      correct: r.correct,
      wrong: r.wrong,
      totalTime: r.total_time,
      avgTime: total ? r.total_time / total : 0,
    };
  });
  return { key: user.user_key, name: user.name, records };
}

// ---------- HTTP helpers ----------
function send(res, status, body, type = 'application/json; charset=utf-8') {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('Body too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function validName(name) {
  return typeof name === 'string' && NAME_RE.test(name.trim());
}

// ---------- API ----------
async function handleApi(req, res, pathname) {
  if (req.method === 'POST' && pathname === '/api/users') {
    const { name } = await readJson(req);
    if (!validName(name)) return send(res, 400, { error: 'Please use 1-30 letters, numbers or spaces for the name.' });
    return send(res, 200, userWithRecords(upsertUser(name)));
  }

  if (req.method === 'POST' && pathname === '/api/results') {
    const { name, date, correct, seconds } = await readJson(req);
    if (!validName(name)) return send(res, 400, { error: 'Invalid name.' });
    if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) {
      return send(res, 400, { error: 'Invalid date.' });
    }
    if (typeof correct !== 'boolean') return send(res, 400, { error: 'Invalid result.' });
    const secs = Number(seconds);
    if (!Number.isFinite(secs) || secs < 0) return send(res, 400, { error: 'Invalid time.' });

    const user = upsertUser(name);
    sql.addResult.run(user.id, date, correct ? 1 : 0, correct ? 0 : 1, Math.min(secs, 3600));
    return send(res, 200, userWithRecords(user));
  }

  return send(res, 404, { error: 'Not found' });
}

// ---------- Static files (only the game's own files are served) ----------
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
};

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
    const file = STATIC[pathname];
    if (!file || req.method !== 'GET') return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    return send(res, 200, fs.readFileSync(path.join(__dirname, file[0])), file[1]);
  } catch (err) {
    if (!err.status) console.error(err);
    return send(res, err.status || 500, { error: err.status ? err.message : 'Server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Math Quest Kids running at http://localhost:${PORT}`);
  console.log(`Database: ${DB_FILE}`);
});

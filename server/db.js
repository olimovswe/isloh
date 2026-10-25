'use strict';
/* Ma'lumotlar bazasi: Node.js'ning o'ziga qurilgan SQLite (node:sqlite) — tashqi kutubxona kerak emas. */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  tg_id INTEGER UNIQUE,
  phone TEXT UNIQUE,
  username TEXT DEFAULT '',
  tg_name TEXT DEFAULT '',
  name TEXT DEFAULT '',
  birth_date TEXT DEFAULT '',
  wake TEXT DEFAULT '05:00',
  sleep TEXT DEFAULT '22:30',
  city TEXT DEFAULT 'toshkent',
  tz REAL DEFAULT 5,
  notify_lead INTEGER DEFAULT 10,
  task_lead INTEGER DEFAULT 5,
  plan_remind TEXT DEFAULT '21:30',
  prayer_mins INTEGER DEFAULT 20,
  theme TEXT DEFAULT 'dark',
  onboarded INTEGER DEFAULT 0,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS login_codes (
  code TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER,
  last_seen INTEGER
);
CREATE TABLE IF NOT EXISTS templates (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  category TEXT DEFAULT 'boshqa',
  kind TEXT DEFAULT 'task',
  days INTEGER DEFAULT 127,
  active INTEGER DEFAULT 1,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  category TEXT DEFAULT 'boshqa',
  kind TEXT DEFAULT 'task',
  template_id INTEGER,
  status TEXT DEFAULT 'planned',
  actual_start INTEGER,
  actual_end INTEGER,
  rating INTEGER,
  note TEXT DEFAULT '',
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS tasks_user_date ON tasks(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_tpl ON tasks(user_id, date, template_id) WHERE template_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS skipped_tpl (
  user_id INTEGER, date TEXT, template_id INTEGER, PRIMARY KEY (user_id, date, template_id)
);
CREATE TABLE IF NOT EXISTS prayers (
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  prayer TEXT NOT NULL,
  status TEXT NOT NULL,
  marked_at INTEGER,
  PRIMARY KEY (user_id, date, prayer)
);
CREATE TABLE IF NOT EXISTS days (
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  plan_ready INTEGER DEFAULT 0,
  wake_at INTEGER,
  sleep_at INTEGER,
  note TEXT DEFAULT '',
  PRIMARY KEY (user_id, date)
);
CREATE TABLE IF NOT EXISTS sent (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  at INTEGER,
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY,
  channel_id TEXT UNIQUE NOT NULL,
  title TEXT DEFAULT '',
  url TEXT DEFAULT '',
  category TEXT DEFAULT 'podkast',
  added_by INTEGER,
  last_fetch INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  published INTEGER,
  description TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS videos_pub ON videos(published DESC);
CREATE TABLE IF NOT EXISTS watched (
  user_id INTEGER, video_id TEXT, at INTEGER, PRIMARY KEY (user_id, video_id)
);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  author TEXT DEFAULT '',
  pages INTEGER DEFAULT 0,
  current INTEGER DEFAULT 0,
  created_at INTEGER,
  finished_at INTEGER
);
`;

function open(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'isloh.db'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  db.exec(SCHEMA);
  const api = {
    raw: db,
    all: (sql, ...a) => db.prepare(sql).all(...a),
    get: (sql, ...a) => db.prepare(sql).get(...a) || null,
    run: (sql, ...a) => db.prepare(sql).run(...a),
    tx(fn) {
      db.exec('BEGIN');
      try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
  return api;
}

module.exports = { open };

import { ConfigurationError, sha256 } from "./utils.js";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'unsubscribed')),
    confirmation_token_hash TEXT,
    confirmation_expires_at TEXT,
    created_at TEXT NOT NULL,
    confirmed_at TEXT,
    unsubscribed_at TEXT,
    updated_at TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'site'
  )`,
  "CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status)",
  "CREATE INDEX IF NOT EXISTS idx_subscribers_confirmation ON subscribers(confirmation_token_hash)",
  `CREATE TABLE IF NOT EXISTS campaigns (
    notice_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    recipient_count INTEGER NOT NULL DEFAULT 0,
    sent_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    notice_id TEXT NOT NULL,
    subscriber_id INTEGER NOT NULL,
    provider_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
    sent_at TEXT,
    error TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE(notice_id, subscriber_id),
    FOREIGN KEY(subscriber_id) REFERENCES subscribers(id)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_deliveries_notice ON deliveries(notice_id, status)",
  `CREATE TABLE IF NOT EXISTS page_views (
    day TEXT NOT NULL,
    path TEXT NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(day, path)
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    subject TEXT,
    detail TEXT,
    created_at TEXT NOT NULL
  )`
];

const initializedDatabases = new WeakSet();

export async function getDb(env) {
  const db = env.SUBSCRIBERS_DB;
  if (!db) throw new ConfigurationError("Missing SUBSCRIBERS_DB binding");
  if (!initializedDatabases.has(db)) {
    await db.batch(SCHEMA.map((statement) => db.prepare(statement)));
    initializedDatabases.add(db);
  }
  return db;
}

export async function checkRateLimit(db, rawKey, limit, windowMs) {
  const key = await sha256(rawKey);
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs).toISOString();
  const current = await db.prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?").bind(key).first();

  if (!current || current.reset_at <= now.toISOString()) {
    await db.prepare(`INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`).bind(key, resetAt).run();
    return true;
  }

  if (current.count >= limit) return false;
  await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}

export async function writeAudit(db, event, subject = null, detail = null) {
  await db.prepare("INSERT INTO audit_log (event, subject, detail, created_at) VALUES (?, ?, ?, ?)")
    .bind(event, subject, detail, new Date().toISOString()).run();
}

export { SCHEMA };


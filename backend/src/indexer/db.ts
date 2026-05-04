// Strix Protocol — SQLite database initialization and queries

import Database from 'better-sqlite3';
import path from 'path';
import type { DbEvent, DbFeedback } from '../types';
import { logger } from '../logger';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'strix.db');
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDatabase(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      tx_hash TEXT NOT NULL UNIQUE,
      block_time INTEGER NOT NULL,
      user_address TEXT,
      data TEXT NOT NULL,
      indexed_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_address TEXT,
      rating INTEGER,
      category TEXT,
      message TEXT NOT NULL,
      submitted_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault_stats_cache (
      id INTEGER PRIMARY KEY,
      tvl TEXT NOT NULL,
      total_shares TEXT NOT NULL,
      locked TEXT NOT NULL,
      available TEXT NOT NULL,
      share_price TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS options_chain_cache (
      expiry INTEGER PRIMARY KEY,
      strikes_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_address);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
    CREATE INDEX IF NOT EXISTS idx_events_block_time ON events(block_time);
  `);

  logger.info(`[DB] Initialized at ${DB_PATH}`);
}

// ── Event queries ──────────────────────────────────────────────────────────

export function insertEvent(event: Omit<DbEvent, 'id'>): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO events (event_type, tx_hash, block_time, user_address, data, indexed_at)
    VALUES (@event_type, @tx_hash, @block_time, @user_address, @data, @indexed_at)
  `);
  stmt.run(event);
}

export function getEventsByUser(userAddress: string): DbEvent[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM events WHERE user_address = ? ORDER BY block_time DESC LIMIT 100
  `).all(userAddress) as DbEvent[];
}

export function getEventsByType(eventType: string, limit = 50): DbEvent[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM events WHERE event_type = ? ORDER BY block_time DESC LIMIT ?
  `).all(eventType, limit) as DbEvent[];
}

export function getRecentEvents(limit = 20): DbEvent[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM events ORDER BY block_time DESC LIMIT ?
  `).all(limit) as DbEvent[];
}

export function getLastIndexedBlock(): number {
  const db = getDb();
  const row = db.prepare(`SELECT MAX(block_time) as last_time FROM events`).get() as { last_time: number | null };
  return row?.last_time ?? 0;
}

// ── Feedback queries ───────────────────────────────────────────────────────

export function insertFeedback(feedback: Omit<DbFeedback, 'id'>): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO feedback (user_address, rating, category, message, submitted_at)
    VALUES (@user_address, @rating, @category, @message, @submitted_at)
  `).run(feedback);
}

export function getAllFeedback(): DbFeedback[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM feedback ORDER BY submitted_at DESC`).all() as DbFeedback[];
}

// ── Cache queries ──────────────────────────────────────────────────────────

export function getVaultStatsCache(): Record<string, string | number> | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM vault_stats_cache WHERE id = 1`).get() as Record<string, string | number> | undefined;
  return row ?? null;
}

export function setVaultStatsCache(stats: {
  tvl: string; totalShares: string; locked: string; available: string; sharePrice: string;
}): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT OR REPLACE INTO vault_stats_cache (id, tvl, total_shares, locked, available, share_price, cached_at)
    VALUES (1, @tvl, @totalShares, @locked, @available, @sharePrice, @cachedAt)
  `).run({ ...stats, cachedAt: now });
}

export function getOptionsChainCache(expiry: number): Record<string, unknown> | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM options_chain_cache WHERE expiry = ?`).get(expiry) as Record<string, unknown> | undefined;
  if (!row) return null;
  return { ...row, strikes: JSON.parse(row.strikes_json as string) };
}

export function setOptionsChainCache(expiry: number, strikes: unknown[]): void {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT OR REPLACE INTO options_chain_cache (expiry, strikes_json, cached_at)
    VALUES (?, ?, ?)
  `).run(expiry, JSON.stringify(strikes), now);
}

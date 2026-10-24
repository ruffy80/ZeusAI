'use strict';

/**
 * SQLite memory for one validated research-pipeline record.
 * Separate from the commerce database in backend/db.js.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const openDbs = new Map();

function defaultDbPath() {
  if (process.env.PIPELINE_MEMORY_DB) return process.env.PIPELINE_MEMORY_DB;
  return path.join(__dirname, '..', '..', 'data', 'research-pipeline.db');
}

function open(dbPath = defaultDbPath()) {
  const key = path.resolve(dbPath);
  const existing = openDbs.get(key);
  if (existing) return existing;
  fs.mkdirSync(path.dirname(key), { recursive: true });
  const db = new Database(key);
  db.pragma('journal_mode = DELETE');
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      correlation_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      source_url TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  openDbs.set(key, db);
  return db;
}

function write(record, dbPath = defaultDbPath()) {
  const db = open(dbPath);
  const createdAt = record.createdAt || new Date().toISOString();
  const payload = JSON.stringify(record.payload || record);
  const info = db.prepare(`
    INSERT INTO pipeline_memory (
      correlation_id, title, description, source_url, provider, model, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(record.correlationId),
    String(record.title),
    String(record.description),
    String(record.sourceUrl),
    record.provider ? String(record.provider) : null,
    record.model ? String(record.model) : null,
    payload,
    createdAt
  );
  return readById(info.lastInsertRowid, dbPath);
}

function rowToObject(row) {
  if (!row) return null;
  return {
    id: row.id,
    correlationId: row.correlation_id,
    title: row.title,
    description: row.description,
    sourceUrl: row.source_url,
    provider: row.provider,
    model: row.model,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
  };
}

function readById(id, dbPath = defaultDbPath()) {
  const db = open(dbPath);
  const row = db.prepare('SELECT * FROM pipeline_memory WHERE id = ?').get(id);
  return rowToObject(row);
}

function readByCorrelation(correlationId, dbPath = defaultDbPath()) {
  const db = open(dbPath);
  const row = db.prepare(
    'SELECT * FROM pipeline_memory WHERE correlation_id = ? ORDER BY id DESC LIMIT 1'
  ).get(String(correlationId));
  return rowToObject(row);
}

function close(dbPath = defaultDbPath()) {
  const key = path.resolve(dbPath);
  const db = openDbs.get(key);
  if (!db) return;
  db.close();
  openDbs.delete(key);
}

function getStatus() {
  return {
    id: 'pipeline-memory/1.0',
    health: 'ok',
    engine: 'better-sqlite3',
    table: 'pipeline_memory',
    running: false,
    active: false,
    started: false,
  };
}

module.exports = {
  defaultDbPath,
  open,
  write,
  readById,
  readByCorrelation,
  close,
  getStatus,
};

// aiFutureDb.js — persistent storage for all future AI modules
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(__dirname, 'ai-future-db.json');

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { audit: [], identity: [], transfer: [], consensus: [], simulation: [], collab: [], convergence: [] };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

module.exports = {
  log(type, entry) {
    const db = loadDb();
    if (!db[type]) db[type] = [];
    db[type].push({ ...entry, ts: Date.now() });
    saveDb(db);
  },
  get(type) {
    const db = loadDb();
    return db[type] || [];
  },
  all() {
    return loadDb();
  }
};

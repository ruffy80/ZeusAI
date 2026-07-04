'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const SNAP_DIR = path.join(__dirname, '../../snapshots/runtime');
try { fs.mkdirSync(SNAP_DIR, { recursive: true }); } catch (_) {}

const state = { restores: 0, snapshots: 0, lastSnapshot: null, lastRestore: null };

function createSnapshot({ name = 'snapshot', payload = {} } = {}) {
  const id = `${Date.now()}_${String(name).replace(/[^a-z0-9_-]/gi,'_')}`;
  const file = path.join(SNAP_DIR, `${id}.json`);
  const data = { id, ts: new Date().toISOString(), name, payload };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  state.snapshots += 1;
  state.lastSnapshot = data.ts;
  return { ok: true, id, file };
}

function listSnapshots(limit = 100) {
  const files = fs.readdirSync(SNAP_DIR).filter(f => f.endsWith('.json')).sort().reverse().slice(0, limit);
  return files.map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(SNAP_DIR, f), 'utf8')); } catch (_) { return null; }
  }).filter(Boolean);
}

function restoreSnapshot(id) {
  const file = path.join(SNAP_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return { ok: false, error: 'snapshot-not-found' };
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  state.restores += 1;
  state.lastRestore = new Date().toISOString();
  return { ok: true, restored: data };
}

function router() {
  const r = express.Router();
  r.get('/status', (_q,res)=>res.json({ ok:true, ...state }));
  r.get('/snapshots', (q,res)=>res.json({ ok:true, snapshots:listSnapshots(Math.min(Number(q.query.limit)||50,200)) }));
  r.post('/snapshot', express.json(), (q,res)=>res.json(createSnapshot(q.body||{})));
  r.post('/restore/:id', (q,res)=>res.json(restoreSnapshot(q.params.id)));
  return r;
}

function getStatus(){ return { name:'rollback-engine', health:'good', ...state }; }

module.exports = { createSnapshot, listSnapshots, restoreSnapshot, router, getStatus };

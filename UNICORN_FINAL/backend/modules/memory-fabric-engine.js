'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');

const DIR = path.join(__dirname, '../../data/memory-fabric');
const FILE = path.join(DIR, 'store.json');
try { fs.mkdirSync(DIR, { recursive: true }); } catch (_) {}

let db = (()=>{ try { return JSON.parse(fs.readFileSync(FILE,'utf8')); } catch { return { short:[], long:[], success:[], failure:[] }; } })();

function persist(){ try { fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); } catch (_) {} }
function add(kind, record){
  if (!db[kind]) return { ok:false, error:'unknown-kind' };
  const item = { id:`m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, ts:new Date().toISOString(), ...record };
  db[kind].push(item);
  if (db[kind].length > (kind==='short'?500:5000)) db[kind] = db[kind].slice(-(kind==='short'?500:5000));
  persist();
  return { ok:true, item };
}
function query(kind, q=''){ const arr=db[kind]||[]; const s=String(q).toLowerCase(); return arr.filter(x=>JSON.stringify(x).toLowerCase().includes(s)).slice(-100).reverse(); }
function stats(){ return { short:db.short.length, long:db.long.length, success:db.success.length, failure:db.failure.length }; }

function router(){
  const r=express.Router();
  r.get('/status', (_q,res)=>res.json({ ok:true, stats:stats() }));
  r.post('/short', express.json(), (q,res)=>res.json(add('short', q.body||{})));
  r.post('/long', express.json(), (q,res)=>res.json(add('long', q.body||{})));
  r.post('/success', express.json(), (q,res)=>res.json(add('success', q.body||{})));
  r.post('/failure', express.json(), (q,res)=>res.json(add('failure', q.body||{})));
  r.get('/query/:kind', (q,res)=>res.json({ ok:true, rows:query(q.params.kind, q.query.q||'') }));
  return r;
}

function getStatus(){ return { name:'memory-fabric-engine', health:'good', ...stats() }; }

module.exports = { add, query, stats, router, getStatus };

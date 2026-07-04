// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-04T11:19:48.511Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const vm = require('vm');
const express = require('express');

const state = { runs: 0, blocked: 0, passed: 0, failed: 0, lastRun: null };

function runMutation({ code = '', context = {}, timeoutMs = 800 } = {}) {
  state.runs += 1;
  state.lastRun = new Date().toISOString();
  if (!code || typeof code !== 'string') return { ok:false, error:'code-required' };
  if (/require\(|process\.|child_process|fs\.|net\.|http\./.test(code)) {
    state.blocked += 1;
    return { ok:false, error:'blocked-unsafe-pattern' };
  }
  try {
    const sandbox = { input: context, output: null, Math, Date, JSON };
    vm.createContext(sandbox);
    const script = new vm.Script(code);
    const out = script.runInContext(sandbox, { timeout: timeoutMs });
    state.passed += 1;
    return { ok:true, result: out, output: sandbox.output ?? null };
  } catch (e) {
    state.failed += 1;
    return { ok:false, error: e.message };
  }
}

function router(){
  const r=express.Router();
  r.get('/status', (_q,res)=>res.json({ ok:true, ...state }));
  r.post('/run', express.json(), (q,res)=>res.json(runMutation(q.body||{})));
  return r;
}

function getStatus(){ return { name:'mutation-sandbox', health:'good', ...state }; }

module.exports = { runMutation, router, getStatus };

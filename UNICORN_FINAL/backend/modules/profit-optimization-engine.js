'use strict';

const express = require('express');

const state = { runs: 0, lastRun: null, lastRecommendations: [] };

function optimize({ modules = [] } = {}) {
  state.runs += 1;
  state.lastRun = new Date().toISOString();
  const rec = [];
  for (const m of modules) {
    const revenue = Number(m.revenue||0);
    const cost = Number(m.cost||0);
    const retries = Number(m.retries||0);
    const margin = revenue > 0 ? ((revenue-cost)/revenue)*100 : -100;
    if (margin < 20) rec.push({ module: m.name||m.module||'unknown', action:'raise-price-or-cut-cost', margin:+margin.toFixed(1) });
    if (retries > 10) rec.push({ module: m.name||m.module||'unknown', action:'reduce-failure-retries', retries });
  }
  state.lastRecommendations = rec.slice(0, 100);
  return { ok:true, at:state.lastRun, recommendations: state.lastRecommendations };
}

function router(){
  const r=express.Router();
  r.get('/status', (_q,res)=>res.json({ ok:true, ...state }));
  r.post('/optimize', express.json(), (q,res)=>res.json(optimize(q.body||{})));
  return r;
}

function getStatus(){ return { name:'profit-optimization-engine', health:'good', runs:state.runs, lastRun:state.lastRun, recommendations:state.lastRecommendations.length }; }

module.exports = { optimize, router, getStatus };

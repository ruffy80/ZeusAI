'use strict';

const express = require('express');

const state = { analyses: 0, lastAt: null, cohorts: [] };

function analyze({ customers = [] } = {}) {
  state.analyses += 1;
  state.lastAt = new Date().toISOString();
  const rows = customers.map(c => {
    const daysSince = Math.max(0, Math.floor((Date.now()-new Date(c.lastActiveAt||Date.now()).getTime())/86400000));
    const risk = daysSince > 30 ? 'high' : daysSince > 14 ? 'medium' : 'low';
    const score = Math.max(0, 100 - daysSince*2 - (Number(c.supportTickets||0)*3));
    return { customerId: c.id||c.customerId, risk, retentionScore: score, daysSinceLastActive: daysSince, action: risk==='high'?'winback-campaign':risk==='medium'?'nudges':'upsell' };
  });
  state.cohorts = rows;
  return { ok:true, at:state.lastAt, cohorts: rows };
}

function router(){
  const r=express.Router();
  r.get('/status', (_q,res)=>res.json({ ok:true, analyses:state.analyses, lastAt:state.lastAt, cohortSize:state.cohorts.length }));
  r.post('/analyze', express.json(), (q,res)=>res.json(analyze(q.body||{})));
  return r;
}

function getStatus(){ return { name:'retention-engine', health:'good', analyses:state.analyses, lastAt:state.lastAt, cohortSize:state.cohorts.length }; }

module.exports = { analyze, router, getStatus };

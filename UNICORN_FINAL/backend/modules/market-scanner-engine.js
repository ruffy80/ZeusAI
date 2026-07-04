'use strict';

const express = require('express');

const state = { scans: 0, lastScan: null, opportunities: [] };

function scoreGap(x){
  const demand = Number(x.demand||0);
  const competition = Number(x.competition||0);
  const price = Number(x.avgPrice||0);
  return +(Math.max(0, (demand*0.6 + price*0.3 - competition*0.5))).toFixed(2);
}

function scan({ markets = [] } = {}) {
  state.scans += 1;
  state.lastScan = new Date().toISOString();
  const opp = markets.map(m => ({ ...m, score: scoreGap(m) })).sort((a,b)=>b.score-a.score).slice(0, 50);
  state.opportunities = opp;
  return { ok:true, scanAt: state.lastScan, opportunities: opp };
}

function router(){
  const r=express.Router();
  r.get('/status', (_q,res)=>res.json({ ok:true, ...state, top: state.opportunities.slice(0,5) }));
  r.post('/scan', express.json(), (q,res)=>res.json(scan(q.body||{})));
  return r;
}

function getStatus(){ return { name:'market-scanner-engine', health:'good', scans:state.scans, opportunities:state.opportunities.length, lastScan:state.lastScan }; }

module.exports = { scan, router, getStatus };

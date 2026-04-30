// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.683Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// blockchain-audit.js
// Modul simplu pentru logare acțiuni critice pe un blockchain privat (simulat)

'use strict';

const fs = require('fs');
const path = require('path');
const AUDIT_FILE = path.join(__dirname, '../../data/blockchain-audit.json');

function logAction(action, details) {
  let chain = [];
  try { if (fs.existsSync(AUDIT_FILE)) chain = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')); } catch {}
  const prevHash = chain.length ? chain[chain.length-1].hash : 'GENESIS';
  const block = {
    ts: Date.now(),
    action,
    details,
    prevHash,
    hash: require('crypto').createHash('sha256').update(JSON.stringify({action,details,prevHash,ts:Date.now()})).digest('hex')
  };
  chain.push(block);
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(chain, null, 2));
}

function getChain() {
  try { if (fs.existsSync(AUDIT_FILE)) return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')); } catch {}
  return [];
}

module.exports = { logAction, getChain };

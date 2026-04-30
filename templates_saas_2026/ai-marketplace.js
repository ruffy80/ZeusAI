// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.682Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// ai-marketplace.js
// Marketplace extensibil pentru module/servicii AI terțe, review-uri și scoring

'use strict';

const fs = require('fs');
const path = require('path');
const MARKET_FILE = path.join(__dirname, '../../data/ai-marketplace.json');

function addModule({ name, description, author, url }) {
  let mods = [];
  try { if (fs.existsSync(MARKET_FILE)) mods = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8')); } catch {}
  mods.push({ id: Date.now(), name, description, author, url, reviews: [], score: 0 });
  fs.writeFileSync(MARKET_FILE, JSON.stringify(mods, null, 2));
}

function getModules() {
  try { if (fs.existsSync(MARKET_FILE)) return JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8')); } catch {}
  return [];
}

function addReview(moduleId, user, rating, text) {
  let mods = getModules();
  const idx = mods.findIndex(m => m.id === moduleId);
  if (idx >= 0) {
    mods[idx].reviews.push({ user, rating, text, ts: Date.now() });
    // Scoring automatizat: medie rating + bonus dacă multe review-uri
    const avg = mods[idx].reviews.reduce((a,b)=>a+b.rating,0)/mods[idx].reviews.length;
    mods[idx].score = avg + Math.log2(mods[idx].reviews.length+1);
    fs.writeFileSync(MARKET_FILE, JSON.stringify(mods, null, 2));
  }
}

module.exports = { addModule, getModules, addReview };

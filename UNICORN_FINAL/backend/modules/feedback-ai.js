// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-29T16:15:58.684Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// feedback-ai.js
// Modul pentru colectare feedback user și prioritizare AI

'use strict';

const fs = require('fs');
const path = require('path');
const FEEDBACK_FILE = path.join(__dirname, '../../data/feedback.json');

function addFeedback(user, text, feature) {
  let feedback = [];
  try { if (fs.existsSync(FEEDBACK_FILE)) feedback = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); } catch {}
  feedback.push({ ts: Date.now(), user, text, feature });
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));
}

function getFeedback() {
  try { if (fs.existsSync(FEEDBACK_FILE)) return JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8')); } catch {}
  return [];
}

function prioritizeFeatures() {
  const feedback = getFeedback();
  const counts = {};
  feedback.forEach(fb => {
    if (fb.feature) counts[fb.feature] = (counts[fb.feature] || 0) + 1;
  });
  // Returnează top 3 funcții de optimizat/lansat
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([f])=>f);
}

module.exports = { addFeedback, getFeedback, prioritizeFeatures };

#!/usr/bin/env node
'use strict';

/**
 * Read a CSV of prospects and print personalized outreach drafts.
 * This process does not open a socket, does not import a mailer, and
 * does not send email. A human copies a draft only after reading the
 * destination community's rules.
 *
 * Usage:
 *   node scripts/outreach-draft.js prospects.csv
 *
 * CSV header: name,email,company,note
 */

const fs = require('fs');
const path = require('path');
const dto = require('../src/site/v2/discover-trust-os');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/outreach-draft.js prospects.csv');
    console.error('Columns: name,email,company,note');
    console.error('Nothing is sent.');
    process.exit(1);
  }
  const abs = path.resolve(file);
  const text = fs.readFileSync(abs, 'utf8');
  const table = parseCsv(text);
  if (!table.length) {
    console.error('CSV is empty.');
    process.exit(1);
  }
  const header = table[0].map((h) => String(h).trim().toLowerCase());
  const records = table.slice(1).map((cols) => {
    const rec = {};
    header.forEach((key, idx) => { rec[key] = cols[idx] == null ? '' : String(cols[idx]).trim(); });
    return rec;
  });
  const draft = dto.draftOutreach(records);
  if (draft.sent !== false || draft.transport !== 'none') {
    console.error('Refusing to run: transport is not none.');
    process.exit(2);
  }
  draft.messages.forEach((msg, i) => {
    process.stdout.write('--- draft ' + (i + 1) + ' ---\n');
    process.stdout.write('To: ' + (msg.to || '(no email)') + '\n');
    process.stdout.write('Subject: ' + msg.subject + '\n');
    process.stdout.write('Sent: false\n\n');
    process.stdout.write(msg.body + '\n\n');
  });
  process.stdout.write('Generated ' + draft.count + ' draft(s). None were sent.\n');
}

main();

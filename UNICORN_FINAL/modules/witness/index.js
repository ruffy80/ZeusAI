'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fetchQueries } = require('./gsc');
const contracts = require('./contracts');
const { verifyContract, publicKeyBase64 } = require('./signer');
const { renderHTML } = require('./render');
const routes = require('./routes');

function testEmptyState() {
  const previous = process.env.WITNESS_DB;
  const tmp = path.join(require('os').tmpdir(), 'witness-empty-' + process.pid + '.sqlite');
  process.env.WITNESS_DB = tmp;
  try { fs.unlinkSync(tmp); } catch (_) { /* fresh */ }
  const list = contracts.listWitnesses();
  const html = renderHTML(list);
  const honest = list.length === 0
    && html.includes('0 contracts signed. This page will populate only when Search Console returns real query rows. No data is fabricated.')
    && html.includes(publicKeyBase64());
  console.log(honest ? 'EMPTY_OK count=0' : 'EMPTY_FAIL count=' + list.length);
  if (previous == null) delete process.env.WITNESS_DB;
  else process.env.WITNESS_DB = previous;
  try { fs.unlinkSync(tmp); } catch (_) { /* ignore */ }
  return honest;
}

async function testSignedFixture() {
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'witness-fix-'));
  const db = path.join(dir, 'witness.sqlite');
  const fixture = path.join(dir, 'gsc.json');
  fs.writeFileSync(fixture, JSON.stringify([
    { query: 'website audit bitcoin', clicks: 1, impressions: 4, date: '2026-10-29' },
  ]));
  const previous = {
    db: process.env.WITNESS_DB,
    fixture: process.env.WITNESS_GSC_FIXTURE,
    nodeEnv: process.env.NODE_ENV,
  };
  process.env.WITNESS_DB = db;
  process.env.WITNESS_GSC_FIXTURE = fixture;
  process.env.NODE_ENV = 'test';
  const sync = await routes.syncNow();
  const body = routes.jsonList();
  const contract = body.contracts[0];
  const valid = !!(contract && verifyContract(contract));
  console.log(JSON.stringify({
    created: sync.created,
    count: body.count,
    valid,
    query: contract && contract.payload && contract.payload.query_text,
    db,
  }));
  if (previous.db == null) delete process.env.WITNESS_DB;
  else process.env.WITNESS_DB = previous.db;
  if (previous.fixture == null) delete process.env.WITNESS_GSC_FIXTURE;
  else process.env.WITNESS_GSC_FIXTURE = previous.fixture;
  process.env.NODE_ENV = previous.nodeEnv;
  fs.rmSync(dir, { recursive: true, force: true });
  return valid && sync.created === 1 && body.count === 1;
}

module.exports = {
  fetchQueries,
  testEmptyState,
  testSignedFixture,
  verifyContract,
  publicKeyBase64,
  ...contracts,
  ...routes,
};

'use strict';

/**
 * AutonomousSpaceComputing — local compute space.
 * Jobs run in this process. The module does not operate a spacecraft.
 */

const os = require('os');
const { Engine } = require('./engine-core');

const CAPACITY = 8;
const jobs = new Map();

function submit(input) {
  const body = input && typeof input === 'object' ? input : { payload: input };
  const work = Engine.defaultWork(body.payload != null ? body.payload : body);
  const id = String(body.id || work.checksum).slice(0, 80);
  if (jobs.size >= CAPACITY && !jobs.has(id)) {
    return { ok: false, reason: 'space_full', capacity: CAPACITY, used: jobs.size, claimsOrbital: false };
  }
  const job = {
    id,
    checksum: work.checksum,
    bytes: work.bytes,
    at: new Date().toISOString(),
  };
  jobs.set(id, job);
  return { ok: true, job, used: jobs.size, capacity: CAPACITY, claimsOrbital: false };
}

function release(id) {
  const removed = jobs.delete(String(id || ''));
  return { ok: true, removed, used: jobs.size, capacity: CAPACITY, claimsOrbital: false };
}

function getStatus() {
  const total = os.totalmem() || 1;
  return {
    ok: true,
    name: 'AutonomousSpaceComputing',
    capacity: CAPACITY,
    used: jobs.size,
    freeMemPct: Math.round((os.freemem() / total) * 1000) / 10,
    loadAvg: os.loadavg()[0],
    jobs: [...jobs.values()].slice(-CAPACITY),
    claimsOrbital: false,
  };
}

module.exports = {
  submit,
  release,
  process: submit,
  getStatus,
  name: 'AutonomousSpaceComputing',
};

'use strict';

/**
 * usi-skills — a small set of callable skills. Unknown names return a miss.
 */

const { Engine } = require('./engine-core');

const skills = {
  checksum(input) {
    return Engine.defaultWork(input);
  },
  uptime() {
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.round(process.uptime()),
      rssMb: Math.round(mem.rss / 1048576),
    };
  },
};

function invoke(name, input) {
  const fn = skills[String(name || '')];
  if (!fn) {
    return { ok: false, reason: 'unknown_skill', known: Object.keys(skills) };
  }
  return { ok: true, skill: String(name), result: fn(input) };
}

function getStatus() {
  return { ok: true, name: 'usi-skills', known: Object.keys(skills), inventsSkills: false };
}

module.exports = { invoke, getStatus, name: 'usi-skills' };

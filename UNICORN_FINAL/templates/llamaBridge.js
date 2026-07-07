'use strict';

const PRIORITY = {
  LOW: 1,
  CHAT: 2,
  CODE: 3,
  REASON: 4,
};

async function generate(prompt, _priority, _system) {
  return {
    ok: true,
    text: String(prompt || '').slice(0, 1000),
    model: 'llama-bridge-fallback',
    ts: new Date().toISOString(),
  };
}

function getStatus() {
  return { ok: true, available: false, fallback: true, ts: new Date().toISOString() };
}

module.exports = { PRIORITY, generate, getStatus };

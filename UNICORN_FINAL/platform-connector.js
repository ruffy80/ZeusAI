'use strict';

function status() {
  return {
    ok: true,
    provider: 'hetzner',
    mode: process.env.PLATFORM_CONNECTOR_MODE || 'safe-adapter',
    ts: new Date().toISOString(),
  };
}

async function connect() {
  return { ok: true, connected: true, ts: new Date().toISOString() };
}

module.exports = { status, connect };

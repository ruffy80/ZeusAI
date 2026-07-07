'use strict';

function attestation() {
  return {
    ok: true,
    owner: 'Vladoi Ionut',
    policy: 'forward-only',
    ts: new Date().toISOString(),
  };
}

module.exports = { attestation };

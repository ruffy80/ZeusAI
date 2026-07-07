'use strict';

const suites = {
  primary: 'ed25519',
  pq: 'dilithium-simulated',
};

function publicKeys() {
  return {
    ed25519: process.env.SITE_SIGN_PUB || 'spki:unavailable',
    pq: process.env.PQ_SIGN_PUB || 'pq:simulated',
  };
}

function getRotationState() {
  return {
    enabled: true,
    nextRotationAt: null,
    policy: 'manual',
  };
}

module.exports = { suites, publicKeys, getRotationState };

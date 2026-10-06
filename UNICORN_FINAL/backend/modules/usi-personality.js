'use strict';

/**
 * usi-personality — the operator policy a reply must obey.
 * It does not generate a persona, a customer, or a revenue figure.
 */

const POLICY = {
  operator: 'Vladoi Ionut',
  domain: 'zeusai.pro',
  inventsCustomers: false,
  inventsRevenue: false,
  inventsReach: false,
  language: 'ro',
};

function getStatus() {
  return { ok: true, name: 'usi-personality', policy: POLICY };
}

function processInput() {
  return { ok: true, policy: POLICY, answered: false, reason: 'policy_only' };
}

module.exports = { getStatus, process: processInput, name: 'usi-personality' };

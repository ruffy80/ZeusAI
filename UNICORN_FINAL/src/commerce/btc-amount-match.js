'use strict';

/**
 * A receipt is paid only when an output to the invoice address equals the
 * expected sats, within one sat. A larger or unrelated payment does not match.
 * Unconfirmed outputs wait unless BTC_ACCEPT_UNCONFIRMED=1.
 */

function expectedSats(btcAmount) {
  const n = Number(btcAmount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1e8);
}

function outputMatches(sats, wantSats) {
  const got = Number(sats);
  const want = Number(wantSats);
  if (!Number.isFinite(got) || !Number.isFinite(want) || want <= 0) return false;
  return Math.abs(got - want) <= 1;
}

function acceptConfirmation(confirmed) {
  if (String(process.env.BTC_ACCEPT_UNCONFIRMED || '') === '1') return true;
  return confirmed === true;
}

module.exports = { expectedSats, outputMatches, acceptConfirmation };

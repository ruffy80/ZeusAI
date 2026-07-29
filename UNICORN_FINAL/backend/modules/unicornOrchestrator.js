// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * Legacy public entry → IAK guardian facet (8 autonomous engines).
 * Former unicornOrchestrator body retired into iak/guardian-engines.js.
 */
const iak = require('./integrated-autonomy-kernel');
const facet = require('./iak/guardian-engines');
module.exports = iak.guardian;
module.exports.UnicornOrchestrator = facet.UnicornOrchestrator;
if (typeof iak.guardian.getStatus === 'function') {
  module.exports.statusFn = () => iak.guardian.getStatus();
}

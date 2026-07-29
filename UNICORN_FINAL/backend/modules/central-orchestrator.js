// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================

'use strict';

/**
 * Legacy public entry → IAK external-sense facet.
 * Former central-orchestrator body retired into iak/external-sense.js.
 */
const iak = require('./integrated-autonomy-kernel');
const facet = require('./iak/external-sense');
module.exports = iak.external;
module.exports.CentralOrchestrator = facet.CentralOrchestrator;

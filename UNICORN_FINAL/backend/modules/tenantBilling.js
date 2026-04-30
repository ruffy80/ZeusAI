// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-30T15:05:08.929Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
/*
 * tenantBilling — additive shim
 * Re-exports ./tenant-billing so that MODULE_REGISTRY name lookups by both kebab-case
 * and camelCase resolve to the same implementation. kebab → camel alias
 */
module.exports = require('./tenant-billing');

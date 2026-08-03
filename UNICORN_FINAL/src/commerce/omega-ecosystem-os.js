'use strict';

// Re-export the Omega Ecosystem OS (OMEGA/1.0) from its canonical backend home
// so commerce-layer callers can require it via the src/commerce/ surface.
module.exports = require('../../backend/modules/omega-ecosystem-os');

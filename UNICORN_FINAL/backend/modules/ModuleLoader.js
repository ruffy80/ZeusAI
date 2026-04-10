// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.211Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.230Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.089Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.602Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.142Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.443Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.195Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.284Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.145Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.797Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.985Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// ModuleLoader.js – Dynamic module loading system
'use strict';

const path = require('path');
const fs = require('fs');

const MODULES_DIR = path.join(__dirname);
const loadedModules = new Map();
const failedModules = new Map();

function loadModule(name) {
  if (loadedModules.has(name)) return loadedModules.get(name);

  const filePath = path.join(MODULES_DIR, `${name}.js`);
  if (!fs.existsSync(filePath)) {
    console.warn(`[ModuleLoader] Module not found: ${name}`);
    failedModules.set(name, 'FILE_NOT_FOUND');
    return null;
  }

  try {
    const mod = require(filePath);
    loadedModules.set(name, mod);
    console.log(`[ModuleLoader] ✅ Loaded: ${name}`);
    return mod;
  } catch (e) {
    console.error(`[ModuleLoader] ❌ Failed to load ${name}:`, e.message);
    failedModules.set(name, e.message);
    return null;
  }
}

function loadAll(moduleNames) {
  const results = {};
  moduleNames.forEach(name => {
    results[name] = loadModule(name);
  });
  return results;
}

function getAvailableModules() {
  try {
    return fs.readdirSync(MODULES_DIR)
      .filter(f => f.endsWith('.js') && f !== 'ModuleLoader.js')
      .map(f => f.replace('.js', ''));
  } catch {
    return [];
  }
}

function getStatus() {
  return {
    loaded: Array.from(loadedModules.keys()),
    failed: Object.fromEntries(failedModules),
    available: getAvailableModules(),
    loadedCount: loadedModules.size,
    failedCount: failedModules.size,
  };
}

function reloadModule(name) {
  if (loadedModules.has(name)) {
    const filePath = path.join(MODULES_DIR, `${name}.js`);
    delete require.cache[require.resolve(filePath)];
    loadedModules.delete(name);
  }
  return loadModule(name);
}

module.exports = { loadModule, loadAll, getAvailableModules, getStatus, reloadModule };

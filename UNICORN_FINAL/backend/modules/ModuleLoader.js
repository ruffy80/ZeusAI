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

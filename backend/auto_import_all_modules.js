// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-18T17:12:57.327Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// Auto-import and register all modules in backend/modules
// Run this script to ensure all modules are loaded and registered in orchestrator/mesh

const fs = require('fs');
const path = require('path');
const modulesDir = path.join(__dirname, 'modules');
const imported = [];
const failed = [];

const meshOrchestrator = require('./modules/unicornMeshOrchestrator');

fs.readdirSync(modulesDir).forEach(file => {
  if (!file.endsWith('.js')) return;
  const modName = file.replace('.js', '');
  try {
    const mod = require(path.join(modulesDir, file));
    imported.push(modName);
    // Register in mesh if not already
    try {
      meshOrchestrator.register(modName, mod, { statusFn: typeof mod.getStatus === 'function' ? 'getStatus' : null });
    } catch (e) {}
  } catch (e) {
    failed.push({ modName, error: e.message });
  }
});

console.log('Imported:', imported.length, imported);
if (failed.length) {
  console.error('Failed:', failed);
} else {
  console.log('All modules imported successfully.');
}

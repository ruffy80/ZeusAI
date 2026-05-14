// ADI-Core Discovery — REAL, autonom
// Genereaza candidati pe baza catalogului:
//   - providerii keyless intra automat
//   - providerii cu cheie disponibila (process.env sau vault) intra ca remote-api
//   - providerii fara cheie ies cu type='awaiting-key' (ca sa apara in onboarding hints)
// In plus, scaneaza module locale AI-related din folderul backend/modules.

const fs   = require('fs');
const path = require('path');
const catalog = require('./provider-catalog');
const { PROVIDERS } = catalog;
const vault = require('./key-vault');

function discoverLocalModules() {
  const out = [];
  const modulesDir = path.join(__dirname, '..');
  try {
    for (const e of fs.readdirSync(modulesDir, { withFileTypes: true })) {
      const name = e.name.toLowerCase();
      if (name === 'adi-core') continue;
      if (/ai|llm|provider|router|model|gpt|claude|gemini/.test(name)) {
        out.push({
          id: `local:${e.name}`,
          type: 'local-module',
          path: path.join(modulesDir, e.name),
          meta: { tags: ['local', 'module'] },
        });
      }
    }
  } catch {}
  return out;
}

function discoverFromCatalog() {
  vault.reseedProcessEnv();
  const out = [];
  for (const p of catalog.all()) {
    const tags = [...(p.tags || [])];
    if (p.keyless) {
      out.push({
        id: p.id,
        type: 'remote-api',
        flavor: p.flavor,
        url: p.probeUrl,
        chatUrl: p.chatUrl,
        defaultModel: p.defaultModel,
        envVar: null,
        keyless: true,
        meta: { tags: [...tags, 'keyless'], signupUrl: p.signupUrl || null },
      });
      continue;
    }
    const aliases = p.envAliases || [String(p.id).toUpperCase() + '_API_KEY'];
    const found = vault.findKey(aliases);
    if (found) {
      out.push({
        id: p.id,
        type: 'remote-api',
        flavor: p.flavor,
        url: p.probeUrl,
        chatUrl: p.chatUrl,
        defaultModel: p.defaultModel,
        envVar: found.alias,
        keyless: false,
        meta: { tags, hasKey: true },
      });
    } else {
      out.push({
        id: p.id,
        type: 'awaiting-key',
        flavor: p.flavor,
        url: p.probeUrl,
        chatUrl: p.chatUrl,
        envAliases: aliases,
        signupUrl: p.signupUrl || null,
        meta: { tags: [...tags, 'awaiting-key'], hasKey: false },
      });
    }
  }
  return out;
}

async function discover() {
  return [...discoverFromCatalog(), ...discoverLocalModules()];
}

module.exports = { discover, PROVIDERS };

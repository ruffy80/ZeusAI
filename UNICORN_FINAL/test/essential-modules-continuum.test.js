'use strict';

/**
 * essential-modules-continuum.test.js — EMC/1.0
 */

process.env.NODE_ENV = 'test';
process.env.DISABLE_SELF_MUTATION = '1';
process.env.UNICORN_RUNTIME_PROFILE = 'stable';
process.env.ENABLE_AUTO_DEPLOY = '0';
process.env.ENABLE_FILE_MUTATORS = '0';
process.env.DB_PATH = ':memory:';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
function check(name, fn) {
  const ret = fn();
  if (ret && typeof ret.then === 'function') {
    return ret.then(() => { passed += 1; console.log('✓', name); });
  }
  passed += 1;
  console.log('✓', name);
  return undefined;
}

const REQUIRED = {
  unicornEternalEngine: ['start', 'runEternalCycle', 'generateFutureInnovations', 'predictiveUpdate', 'healEverything', 'constructMissingParts', 'verifyFutureReadiness'],
  quantumResilienceCore: ['init', 'startAutoScaler', 'startLoadBalancer', 'startHealthMonitor', 'startGlobalEdgeNetwork', 'getStatus'],
  totalSystemHealer: ['start', 'scanAndHeal', 'checkModuleHealth', 'repairModule', 'analyzeLogs'],
  selfConstruction: ['start', 'scanAllModules', 'enhanceModule', 'createMissingModules'],
  codeSanityEngine: ['start', 'fullScan', 'analyzeFile', 'findDuplicates', 'checkAllLocations', 'validateAllImports'],
  innovationEngine: ['start', 'analyzeTrends', 'generateInnovations', 'implementInnovation'],
  autoDeploy: ['start', 'watchFiles', 'commitAndPush'],
  selfDocumenter: ['generateReadme', 'generateAPIDocs'],
  quantumPaymentNexus: ['processPayment', 'createCryptoPayment', 'processCardPayment', 'createRecurringPayment', 'createEscrow'],
  globalDigitalStandard: ['connectToGiants', 'processAPIRequest', 'createUniversalIdentity', 'processCrossPlatformPayment', 'getStatus'],
  universalMarketNexus: ['connectExchanges', 'executeTrade', 'executeArbitrage', 'startMarketDataAggregator', 'getStatus'],
  serviceMarketplace: ['getAllServices', 'getPersonalizedPrice', 'recordPurchase', 'getRecommendations'],
  legalFortress: ['checkOwnershipStatus', 'addOwnershipWatermark', 'registerWithOSIM', 'registerCopyright', 'registerTrademark'],
  sovereignAccessGuardian: ['authenticate', 'verifyPassword', 'verify2FA', 'createSession', 'adminMiddleware'],
  configurationManager: ['loadConfig', 'saveConfig', 'encrypt', 'decrypt', 'get', 'set', 'backupConfig', 'validateAll'],
  unicornAutoGenesis: ['run', 'collectInfo', 'initGit', 'setupGitHubActions', 'setupSecrets', 'createHetznerScript', 'finalPush', 'triggerDeploy'],
  domainAutomationManager: ['init', 'runFullSetup', 'configureSavDNS', 'addDomainToVercel', 'configureNginxSSL', 'updateGitHubWebhook'],
};

const PATHS = {
  unicornEternalEngine: '../backend/modules/unicornEternalEngine',
  quantumResilienceCore: '../backend/modules/quantumResilienceCore',
  totalSystemHealer: '../backend/modules/totalSystemHealer',
  selfConstruction: '../backend/modules/selfConstruction',
  codeSanityEngine: '../backend/modules/codeSanityEngine',
  innovationEngine: '../backend/modules/innovationEngine',
  autoDeploy: '../backend/modules/autoDeploy',
  selfDocumenter: '../backend/modules/selfDocumenter',
  quantumPaymentNexus: '../backend/modules/quantumPaymentNexus',
  globalDigitalStandard: '../backend/modules/globalDigitalStandard',
  universalMarketNexus: '../backend/modules/universalMarketNexus',
  serviceMarketplace: '../backend/modules/serviceMarketplace',
  legalFortress: '../backend/modules/legalFortress',
  sovereignAccessGuardian: '../backend/modules/sovereignAccessGuardian',
  configurationManager: '../backend/modules/configurationManager',
  unicornAutoGenesis: '../backend/modules/unicornAutoGenesis',
  domainAutomationManager: '../backend/modules/domainAutomationManager',
};

async function main() {
  await check('all 17 essential module files exist', () => {
    for (const rel of Object.values(PATHS)) {
      const abs = path.join(__dirname, rel + '.js');
      assert.ok(fs.existsSync(abs), 'missing ' + abs);
    }
  });

  const emc = require('../backend/modules/essential-modules-continuum');

  await check('EMC start under stable does not arm mutators', () => {
    const s = emc.start({ stable: true });
    assert.equal(s.protocol, 'EMC/1.0');
    assert.equal(s.running, true);
    assert.ok(s.okCount >= 10, 'expected many modules ok, got ' + s.okCount);
    assert.equal(s.honesty.mutatorsGated, true);
    assert.equal(s.honesty.noInventedGmv, true);
  });

  await check('each essential module exposes required methods', () => {
    for (const [name, methods] of Object.entries(REQUIRED)) {
      const mod = require(PATHS[name]);
      const miss = methods.filter((m) => typeof mod[m] !== 'function');
      assert.deepEqual(miss, [], `${name} missing: ${miss.join(',')}`);
    }
  });

  await check('unicornAutoGenesis is real genesis (not innovator proxy)', async () => {
    const uag = require('../backend/modules/unicornAutoGenesis');
    assert.equal(typeof uag.repo, 'string');
    assert.equal(typeof uag.branch, 'string');
    const st = uag.getStatus();
    assert.equal(st.honesty.inventsProvisioning, false);
    const run = await uag.run();
    assert.equal(run.honesty.inventsProvisioning, false);
    assert.ok(Array.isArray(run.steps) && run.steps.length >= 5);
  });

  await check('QPN crypto helpers settle toward BTC address', async () => {
    const qpn = require('../backend/modules/quantumPaymentNexus');
    const pay = await qpn.createCryptoPayment({ amount: 10, userId: 't', serviceId: 's' });
    assert.ok(pay.btcAddress);
    assert.equal(pay.method, 'btc');
    const escrow = await qpn.createEscrow({ amount: 5 });
    assert.equal(escrow.ok, false);
    assert.ok(/not_armed|idle/i.test(escrow.error + escrow.note));
  });

  await check('EMC mountRoutes + mesh register', () => {
    const routes = [];
    const app = { get(p, h) { routes.push(p); }, post() {} };
    assert.equal(emc.mountRoutes(app).ok, true);
    assert.ok(routes.includes('/api/emc/status'));
    const registered = [];
    const mesh = { register(n) { registered.push(n); } };
    const r = emc.registerWithMesh(mesh);
    assert.equal(r.ok, true);
    assert.ok(registered.includes('unicornEternalEngine'));
    assert.ok(registered.includes('unicornAutoGenesis'));
    assert.ok(registered.includes('essentialModulesContinuum'));
  });

  await check('index.js wires EMC boot + honest UAG status', () => {
    const src = fs.readFileSync(path.join(__dirname, '../backend/index.js'), 'utf8');
    assert.ok(src.includes('essential-modules-continuum'));
    assert.ok(src.includes('essentialModulesContinuum.start'));
    assert.ok(src.includes('Essential Modules Continuum'));
    assert.ok(!/module:\s*'UnicornAutoGenesis',\s*status:\s*'active'/.test(src));
  });

  console.log(`✅ EMC/1.0: ${passed} tests passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error('EMC test failed:', e);
  process.exit(1);
});

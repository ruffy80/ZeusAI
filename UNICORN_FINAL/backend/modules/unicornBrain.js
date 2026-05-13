// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-05-13T14:40:03.779Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// unicornBrain.js — Modul suprem de orchestrare adaptivă
// SURSE: Consolidare AdaptiveModule01-20 (Grup B)
// Comentarii bilingve pentru trasabilitate
// =====================================================================

'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

// MeshBus central pentru evenimente interne
class MeshBus extends EventEmitter {}
const meshBus = new MeshBus();

// Factory pentru straturi adaptive (fostele AdaptiveModule01-20)
function createAdaptiveLayer(id) {
  const state = {
    id,
    active: true,
    cycles: 0,
    lastRun: null,
    data: {}
  };
  return {
    process(input = {}) {
      state.cycles++;
      state.lastRun = new Date().toISOString();
      state.data = { ...state.data, ...input };
      meshBus.emit('layer:process', { id, input, cycles: state.cycles });
      return { success: true, module: id, cycles: state.cycles, processed: input };
    },
    getStatus() {
      return { module: id, active: state.active, cycles: state.cycles, lastRun: state.lastRun };
    },
    init() { state.active = true; return true; },
    start() { state.active = true; return true; },
    state
  };
}

// Loader cu whitelist pentru straturi adaptive (AdaptiveModule01..82)
const ADAPTIVE_COUNT = 82;
const ADAPTIVE_IDS = Array.from({length: ADAPTIVE_COUNT}, (_, i) => `AdaptiveModule${(i+1).toString().padStart(2,'0')}`);
const adaptiveLayers = {};
ADAPTIVE_IDS.forEach(id => { adaptiveLayers[id] = createAdaptiveLayer(id); });

// Coordonator de conflicte (placeholder, extins la nevoie)
function conflictCoordinator() {
  // TODO: Implementare logică de detecție/rezolvare conflicte
  return null;
}

// Ciclu principal unic
let mainCycleCount = 0;
let lastStatus = {};
const MAIN_INTERVAL = 1000; // 1s
setInterval(() => {
  mainCycleCount++;
  Object.values(adaptiveLayers).forEach(layer => {
    if (layer.state.active) {
      layer.process({ tick: mainCycleCount });
    }
  });
  lastStatus = getStatus();
  meshBus.emit('brain:tick', { mainCycleCount, status: lastStatus });
}, MAIN_INTERVAL);

// API-uri expuse
function getStatus() {
  return {
    mainCycleCount,
    layers: Object.fromEntries(
      Object.entries(adaptiveLayers).map(([id, layer]) => [id, layer.getStatus()])
    ),
    lastStatus,
    timestamp: new Date().toISOString()
  };
}

function getLayer(id) {
  return adaptiveLayers[id] || null;
}

function getMeshBus() {
  return meshBus;
}

// =====================================================================
// GENOME MANAGER — ADN auto-evolutiv al Unicornului
// EN: Loads, validates, and backs up unicorn-genome.json
// RO: Citește, validează și face backup la genome la pornire
// =====================================================================
const GENOME_PATH = path.resolve(__dirname, '..', '..', 'unicorn-genome.json');
const GENOME_BACKUP_DIR = path.resolve(__dirname, '..', '..', 'data', 'backups', 'genome');
let cachedGenome = null;
let genomeLoadError = null;

function loadGenome() {
  try {
    if (!fs.existsSync(GENOME_PATH)) {
      genomeLoadError = 'genome file missing';
      cachedGenome = null;
      return null;
    }
    const raw = fs.readFileSync(GENOME_PATH, 'utf8');
    cachedGenome = JSON.parse(raw);
    genomeLoadError = null;
    return cachedGenome;
  } catch (err) {
    genomeLoadError = err.message;
    cachedGenome = null;
    return null;
  }
}

function validateGenome(g = cachedGenome) {
  if (!g || typeof g !== 'object') return { valid: false, reason: 'not-an-object' };
  const required = ['version', 'identity', 'modules'];
  for (const k of required) {
    if (!(k in g)) return { valid: false, reason: `missing-${k}` };
  }
  return { valid: true };
}

function backupGenome() {
  try {
    if (!cachedGenome) return false;
    if (!fs.existsSync(GENOME_BACKUP_DIR)) {
      fs.mkdirSync(GENOME_BACKUP_DIR, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(GENOME_BACKUP_DIR, `genome-${stamp}.json`);
    fs.writeFileSync(dest, JSON.stringify(cachedGenome, null, 2));
    return dest;
  } catch (err) {
    return false;
  }
}

function getGenome() {
  if (!cachedGenome) loadGenome();
  return cachedGenome;
}

function genomeManager() {
  loadGenome();
  const validation = validateGenome();
  if (validation.valid) backupGenome();
  return { loaded: !!cachedGenome, validation, error: genomeLoadError };
}

// Inițializare genome la pornire (safe)
try { genomeManager(); } catch (e) { /* fallback silent */ }


module.exports = {
  getStatus,
  getLayer,
  getMeshBus,
  conflictCoordinator,
  getGenome,
  validateGenome,
  genomeManager,
  // Pentru compatibilitate: expunem și primul strat ca default
  ...adaptiveLayers
};

// EN: Supreme orchestrator module, consolidates all AdaptiveModules (B group)
// RO: Modul suprem de orchestrare, consolidează toate AdaptiveModule (grupa B)

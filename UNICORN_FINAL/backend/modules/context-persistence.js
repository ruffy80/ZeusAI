// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-04T11:19:48.507Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';
// =====================================================================================
// OWNERSHIP: Proprietatea lui Vladoi Ionut · vladoi_ionut@yahoo.com
// BTC: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// =====================================================================================
//
// context-persistence.js
// ──────────────────────
// Long-term memory + context persistence layer for all autonomous agents.
//
// Architecture:
//  - In-memory sliding window (last N turns per agent)
//  - Disk snapshot (data/context/*.json) when CONTEXT_PERSIST=1
//  - Vector-like keyword indexing for semantic recall (no ML dependency)
//  - Adaptive: agents can store failure/success episodes and retrieve similar past context
//
// API:
//  store(agentId, role, content, metadata?)     — add a turn to agent memory
//  recall(agentId, query, topK?)                — retrieve top-K contextually similar turns
//  summarise(agentId, maxTokens?)               — get compressed summary of agent history
//  clearAgent(agentId)                          — reset agent memory
//  getStatus()                                  — global stats

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'context');
const PERSIST = process.env.CONTEXT_PERSIST === '1';
const MAX_TURNS_PER_AGENT = Number(process.env.CONTEXT_MAX_TURNS || 500);
const MAX_AGENTS = Number(process.env.CONTEXT_MAX_AGENTS || 200);

// ── Storage ────────────────────────────────────────────────────────────────────
const _memories = new Map(); // agentId -> [turn]

function _ensureDir() {
  if (PERSIST) try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

function _savAgent(agentId) {
  if (!PERSIST) return;
  try {
    _ensureDir();
    const turns = _memories.get(agentId) || [];
    const file = path.join(DATA_DIR, `${agentId.replace(/[^a-z0-9_-]/gi, '_')}.json`);
    fs.writeFileSync(file, JSON.stringify({ agentId, turns, updatedAt: new Date().toISOString() }, null, 2));
  } catch (_) {}
}

function _loadAgent(agentId) {
  if (!PERSIST) return [];
  try {
    const file = path.join(DATA_DIR, `${agentId.replace(/[^a-z0-9_-]/gi, '_')}.json`);
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(d.turns) ? d.turns : [];
  } catch (_) { return []; }
}

function _getOrCreate(agentId) {
  if (!_memories.has(agentId)) {
    // Evict oldest agent if at capacity
    if (_memories.size >= MAX_AGENTS) {
      const oldest = [..._memories.entries()].sort(
        (a, b) => (a[1].slice(-1)[0]?.ts || 0) - (b[1].slice(-1)[0]?.ts || 0)
      )[0];
      if (oldest) _memories.delete(oldest[0]);
    }
    const persisted = _loadAgent(agentId);
    _memories.set(agentId, persisted);
  }
  return _memories.get(agentId);
}

// ── Tokenisation / keyword index ───────────────────────────────────────────────
function _tokenise(text) {
  return String(text || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function _similarity(queryTokens, turnTokens) {
  if (!queryTokens.length || !turnTokens.length) return 0;
  const setA = new Set(queryTokens);
  const setB = new Set(turnTokens);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  return intersection / (Math.sqrt(setA.size) * Math.sqrt(setB.size));
}

// ── Public API ─────────────────────────────────────────────────────────────────
/**
 * Store a turn in agent memory.
 * @param {string} agentId   - unique agent identifier
 * @param {'user'|'assistant'|'system'|'observation'} role
 * @param {string} content   - text content
 * @param {object} [meta]    - optional metadata (confidence, source, episode type)
 */
function store(agentId, role, content, meta = {}) {
  const turns = _getOrCreate(agentId);
  const turn = {
    id: crypto.randomBytes(6).toString('hex'),
    role: String(role || 'system'),
    content: String(content || '').slice(0, 4000), // cap at 4k chars
    tokens: _tokenise(content),
    ts: Date.now(),
    confidence: Number(meta.confidence || 0),
    episode: meta.episode || null, // 'failure' | 'success' | 'observation'
    source: meta.source || null,
  };
  turns.push(turn);
  // Trim to window
  if (turns.length > MAX_TURNS_PER_AGENT) {
    turns.splice(0, turns.length - MAX_TURNS_PER_AGENT);
  }
  _memories.set(agentId, turns);
  _savAgent(agentId);
  return turn;
}

/**
 * Recall top-K turns semantically similar to query.
 */
function recall(agentId, query, topK = 10) {
  const turns = _getOrCreate(agentId);
  if (!turns.length) return [];
  const qTokens = _tokenise(query);
  return turns
    .map(t => ({ ...t, _sim: _similarity(qTokens, t.tokens) }))
    .filter(t => t._sim > 0)
    .sort((a, b) => b._sim - a._sim || b.ts - a.ts)
    .slice(0, topK)
    .map(({ _sim, tokens, ...rest }) => ({ ...rest, similarity: Number(_sim.toFixed(4)) }));
}

/**
 * Get compressed summary — last N turns formatted as prompt context.
 */
function summarise(agentId, maxChars = 3000) {
  const turns = _getOrCreate(agentId);
  const recent = turns.slice(-40);
  const parts = recent.map(t => `[${t.role}]: ${t.content}`);
  let out = parts.join('\n');
  if (out.length > maxChars) out = '...' + out.slice(-(maxChars - 3));
  return out;
}

/**
 * Get episodes of a given type (failure/success/observation).
 */
function getEpisodes(agentId, episodeType, limit = 20) {
  const turns = _getOrCreate(agentId);
  return turns
    .filter(t => t.episode === episodeType)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

function clearAgent(agentId) {
  _memories.delete(agentId);
  if (PERSIST) {
    try {
      const file = path.join(DATA_DIR, `${agentId.replace(/[^a-z0-9_-]/gi, '_')}.json`);
      fs.unlinkSync(file);
    } catch (_) {}
  }
  return { ok: true };
}

function getStatus() {
  return {
    ok: true,
    name: 'context-persistence',
    agentCount: _memories.size,
    totalTurns: [..._memories.values()].reduce((s, t) => s + t.length, 0),
    maxAgents: MAX_AGENTS,
    maxTurnsPerAgent: MAX_TURNS_PER_AGENT,
    persist: PERSIST,
  };
}

module.exports = { store, recall, summarise, getEpisodes, clearAgent, getStatus, name: 'context-persistence' };

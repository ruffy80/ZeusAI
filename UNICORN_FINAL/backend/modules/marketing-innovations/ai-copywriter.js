// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/ai-copywriter.js
//
// LLM-backed copy generator with deterministic fallback. If
// OPENAI_API_KEY (or ANTHROPIC_API_KEY) is set, calls the provider via
// global `fetch`. Otherwise, falls back to the seeded variants from
// content-multichannel — guaranteeing the function is always usable
// offline. Prompt+output cache keyed by SHA-256 of inputs.
// =====================================================================

'use strict';

const crypto = require('crypto');
const content = require('./content-multichannel');

const DISABLED = process.env.MARKETING_AI_COPY_DISABLED === '1';
const PROVIDER = (process.env.MARKETING_AI_PROVIDER || 'auto').toLowerCase();
const MAX_CACHE = 500;
const _cache = new Map();

function _key(o) { return crypto.createHash('sha256').update(JSON.stringify(o || {})).digest('hex'); }

function _detectProvider() {
  if (PROVIDER === 'openai' || (PROVIDER === 'auto' && process.env.OPENAI_API_KEY)) return 'openai';
  if (PROVIDER === 'anthropic' || (PROVIDER === 'auto' && process.env.ANTHROPIC_API_KEY)) return 'anthropic';
  return 'fallback';
}

async function _callOpenAI(prompt) {
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.MARKETING_AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    }),
  });
  if (!r.ok) throw new Error('openai_http_' + r.status);
  const j = await r.json();
  return (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
}

async function _callAnthropic(prompt) {
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.MARKETING_AI_MODEL || 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error('anthropic_http_' + r.status);
  const j = await r.json();
  return (j && j.content && j.content[0] && j.content[0].text) || '';
}

function _fallback(opts) {
  const out = content.generateMultiChannel({
    topic: opts.topic || 'Unicorn Automation',
    channels: opts.channels || ['X', 'LinkedIn'],
    perChannel: opts.perChannel || 1,
    seed: opts.seed || (opts.topic + ':' + (opts.channels || []).join(',')),
  });
  return {
    provider: 'fallback',
    prompt: opts.prompt || `Topic: ${opts.topic}`,
    text: out.variants.map((v) => `[${v.channel}] ${v.body}`).join('\n\n'),
    variants: out.variants,
  };
}

/**
 * Generate copy. Returns {provider, text, cached?, variants?}.
 *  opts = { prompt?, topic?, channels?, perChannel?, seed? }
 */
async function generate(opts) {
  if (DISABLED) return _fallback(opts || {});
  const o = opts || {};
  const k = _key(o);
  if (_cache.has(k)) return Object.assign({}, _cache.get(k), { cached: true });

  const prov = _detectProvider();
  if (prov === 'fallback') {
    const r = _fallback(o);
    _cache.set(k, r); _trim();
    return r;
  }
  const prompt = o.prompt
    || `Write ${o.perChannel || 1} short marketing variant(s) about "${o.topic || 'Unicorn'}" for channels: ${(o.channels || ['X']).join(', ')}. Use a single hook + CTA per variant. Keep each under 280 chars.`;
  let text;
  try {
    text = prov === 'openai' ? await _callOpenAI(prompt) : await _callAnthropic(prompt);
  } catch (_e) {
    const r = _fallback(o);
    _cache.set(k, r); _trim();
    return r;
  }
  const r = { provider: prov, prompt, text: String(text || '').trim() };
  _cache.set(k, r); _trim();
  return r;
}

function _trim() {
  while (_cache.size > MAX_CACHE) {
    const first = _cache.keys().next().value;
    if (!first) break;
    _cache.delete(first);
  }
}

function status() {
  return {
    disabled: DISABLED,
    provider: _detectProvider(),
    cacheSize: _cache.size,
    cacheCap: MAX_CACHE,
  };
}

function _resetForTests() { _cache.clear(); }

module.exports = { generate, status, _resetForTests };

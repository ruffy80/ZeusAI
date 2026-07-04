// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC — Product copywriter.
// RO: generează descrieri de vânzare pentru produsele dropship. Două căi:
//   • template(product) — sincron, determinist, on-brand (folosit imediat la
//     publicare ca să nu blocheze bucla autonomă);
//   • ai(product) — asincron, folosește routerul multi-provider REAL din
//     backend/modules/aiProviders.js (DeepSeek → Mistral → Groq → Gemini →
//     Claude → OpenAI → ...). Dacă nicio cheie nu e configurată, întoarce null
//     și rămâne template-ul. Best-effort, fail-soft, nu aruncă niciodată.

'use strict';

const { logger } = require('./util');

const log = logger('describe');

// Deterministic, sales-ready fallback. On-brand, bilingual-friendly.
function template(product) {
  const p = product || {};
  const cat = String(p.category || '').toLowerCase();
  const benefit = cat === 'electronics' ? 'engineered for daily reliability'
    : cat === 'fitness' ? 'designed for visible, measurable progress'
    : cat === 'beauty' ? 'crafted for a salon-grade finish at home'
    : cat === 'home' ? 'made to elevate the rooms you actually live in'
    : cat === 'pet' ? 'built around the needs of pets and the people who love them'
    : cat === 'kitchen' ? 'made for the cooks who want effortless precision'
    : cat === 'office' ? 'tuned for people who ship work, not waste time'
    : cat === 'kids' ? 'safe, durable and genuinely loved by kids'
    : cat === 'auto' ? 'built to survive real road use, day after day'
    : cat === 'travel' ? 'made for people who pack light and move fast'
    : 'crafted for performance, longevity and instant payoff';
  return [
    (p.name || 'This product') + ' — ' + benefit + '.',
    'Hand-picked by Zeus Autonomic Commerce Core after scoring across price, demand, and reviews (' + (p.reviews || 0) + ' verified, ' + (p.rating || 4.5) + '/5).',
    'Ships globally. Pay in Bitcoin. The system handles sourcing, dispatch and delivery end-to-end — zero manual steps.',
  ].join(' ');
}

// Async, real AI copy via the existing multi-provider router. Returns a clean
// description string, or null if no provider is configured / all failed.
async function ai(product) {
  const p = product || {};
  let providers;
  try { providers = require('../aiProviders'); }
  catch (e) { log.warn('aiProviders unavailable:', e.message); return null; }
  if (!providers || typeof providers.chat !== 'function') return null;

  const prompt = [
    'Write a concise, high-converting e-commerce product description (3 short sentences, max ~60 words).',
    'Tone: confident, modern, benefit-led. No emojis. No markdown. Plain text only.',
    'Mention it ships globally and accepts Bitcoin payment.',
    '',
    'Product: ' + (p.name || 'Unnamed product'),
    'Category: ' + (p.category || 'general'),
    'Rating: ' + (p.rating || 4.5) + '/5 from ' + (p.reviews || 0) + ' reviews',
    'Price: $' + (p.priceUsd || p.retailUsd || 0),
  ].join('\n');

  try {
    const result = await providers.chat(prompt, [], { skipUnstable: true });
    if (result && result.reply && typeof result.reply === 'string') {
      const txt = result.reply.trim().replace(/\s+/g, ' ');
      if (txt.length >= 20) {
        log.info('AI description generated via', result.model || 'provider', 'for', p.name);
        return txt.slice(0, 600);
      }
    }
  } catch (e) { log.warn('AI description failed:', e.message); }
  return null;
}

module.exports = { template, ai };

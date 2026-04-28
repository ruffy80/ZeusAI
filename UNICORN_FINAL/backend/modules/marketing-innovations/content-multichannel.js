// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/content-multichannel.js
//
// Generates platform-tailored marketing content variants for a topic.
// Each channel has its own tone, length budget, hashtag style and CTA
// vocabulary. Output is deterministic given a seed (for testability).
//
// Channels: X (Twitter), LinkedIn, Reddit, TikTok, YouTube, Instagram,
//           Email, PushNotification, SMS, Facebook
//
// Pure additive · no outbound network calls.
// =====================================================================

'use strict';

const crypto = require('crypto');

// Channel-specific generation rules.
const CHANNELS = {
  X: {
    maxChars: 280, hashtags: 3, tone: 'punchy', emoji: true,
    ctas: ['Try free →', 'Claim access ↗', 'Get started 🚀', 'Join now', 'See live demo →'],
  },
  LinkedIn: {
    maxChars: 1300, hashtags: 5, tone: 'professional', emoji: false,
    ctas: ['Learn more in the comments.', 'Book a demo →', 'DM me for early access.', 'Read the case study →'],
  },
  Reddit: {
    maxChars: 600, hashtags: 0, tone: 'authentic', emoji: false,
    ctas: ['Happy to answer questions in the comments.', 'Curious what you think.', 'Open-sourcing parts of it soon.'],
  },
  TikTok: {
    maxChars: 150, hashtags: 6, tone: 'energetic', emoji: true,
    ctas: ['Link in bio 🔗', 'Try it 👀', 'Watch till the end', 'Save this 💾'],
  },
  YouTube: {
    maxChars: 5000, hashtags: 8, tone: 'storytelling', emoji: true,
    ctas: ['Subscribe for more', 'Click the link in description', 'Comment your use-case'],
  },
  Instagram: {
    maxChars: 2200, hashtags: 10, tone: 'inspirational', emoji: true,
    ctas: ['Tap the link in bio 🔗', 'Save & share', 'Follow for daily tips'],
  },
  Email: {
    maxChars: 600, hashtags: 0, tone: 'direct', emoji: false,
    ctas: ['Reply to this email to start.', 'Click here to claim →', 'Schedule a 15-min call →'],
  },
  PushNotification: {
    maxChars: 90, hashtags: 0, tone: 'urgent', emoji: true,
    ctas: ['Tap to open', 'Open now →'],
  },
  SMS: {
    maxChars: 160, hashtags: 0, tone: 'concise', emoji: false,
    ctas: ['Reply YES to start.', 'Tap →'],
  },
  Facebook: {
    maxChars: 800, hashtags: 4, tone: 'friendly', emoji: true,
    ctas: ['Learn more →', 'Share with a friend who needs this', 'Get the free guide'],
  },
};

const HOOK_FORMULAS = [
  'Stop ${PAIN}. Start ${BENEFIT}.',
  'Most teams ${OLD_WAY}. The smart ones use ${NEW_WAY}.',
  '${OUTCOME} in ${TIMEFRAME} — without ${RISK}.',
  'Here is how I ${ACHIEVEMENT} using ${TOOL}.',
  '${NUMBER}× ${METRIC} with one change to your ${SYSTEM}.',
  'If you are still ${OLD_WAY}, you are leaving ${VALUE} on the table.',
  'The fastest way to ${OUTCOME}? ${PROOF}.',
];

const TOPICS_DEFAULTS = {
  PAIN: ['manual outreach', 'spreadsheet chaos', 'paying 5 vendors', 'guessing your CAC', 'losing trial users'],
  BENEFIT: ['compounding revenue', 'autonomous growth', 'predictable pipeline', 'a flywheel'],
  OLD_WAY: ['hiring SDRs', 'buying ads blindly', 'doing this in Notion', 'using 10 SaaS tools'],
  NEW_WAY: ['the Unicorn platform', 'a single autonomous agent', 'ZEUS AI'],
  OUTCOME: ['10x your pipeline', 'cut CAC by 60%', 'launch a product weekly', 'auto-generate revenue'],
  TIMEFRAME: ['7 days', '30 days', 'a single sprint', '24 hours'],
  RISK: ['burning runway', 'firing your team', 'rebuilding your stack'],
  ACHIEVEMENT: ['shipped a unicorn-grade SaaS', 'reached $1M ARR solo', 'replaced 4 tools'],
  TOOL: ['the Unicorn platform', 'an autonomous agent', 'a self-healing AI mesh'],
  NUMBER: ['3', '5', '10', '47'],
  METRIC: ['conversion', 'reach', 'CTR', 'retention'],
  SYSTEM: ['onboarding', 'pricing page', 'cold email', 'landing page'],
  VALUE: ['millions', 'qualified leads', 'compounding signups'],
  PROOF: ['stop guessing — automate it', 'let the agent do the loops', 'wire it once and watch it grow'],
};

function _rng(seed) {
  // xmur3 + sfc32 deterministic PRNG.
  let s = String(seed || crypto.randomBytes(4).toString('hex'));
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = (h ^ 0xDEADBEEF) >>> 0;
  let b = (h ^ 0x41C64E6D) >>> 0;
  let c = (h ^ 0x6D2B79F5) >>> 0;
  let d = (h ^ 0x9E3779B9) >>> 0;
  return function next() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = ((c << 21) | (c >>> 11));
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function _pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function _hashtagify(token) {
  return '#' + String(token).replace(/[^a-zA-Z0-9]+/g, '');
}

function _hashtags(rng, topic, count) {
  const base = ['ZeusAI', 'UnicornAutomation', 'AutonomousGrowth', 'SaaS', 'AI', 'GrowthHacking', 'B2B', 'Productivity', 'NoCode', 'Startups', 'Marketing', 'AIagent'];
  const out = new Set();
  if (topic) out.add(_hashtagify(topic));
  while (out.size < count) out.add(_hashtagify(_pick(rng, base)));
  return Array.from(out).slice(0, count);
}

function _fillFormula(rng, formula, topic) {
  const ctx = Object.assign({}, TOPICS_DEFAULTS);
  if (topic) ctx.OUTCOME = [topic, ...ctx.OUTCOME];
  return formula.replace(/\$\{([A-Z_]+)\}/g, (_, k) => {
    const arr = ctx[k] || [k.toLowerCase()];
    return _pick(rng, arr);
  });
}

/**
 * Generate one variant for a single channel.
 * @param {string} channel
 * @param {object} opts {topic, seed, ctaIndex}
 */
function generateVariant(channel, opts) {
  const cfg = CHANNELS[channel];
  if (!cfg) throw new Error(`unknown_channel: ${channel}`);
  const topic = (opts && opts.topic) || 'Unicorn Automation';
  const seed = (opts && opts.seed) || `${channel}:${topic}:${Date.now()}`;
  const rng = _rng(seed);

  const hookFormula = _pick(rng, HOOK_FORMULAS);
  const hook = _fillFormula(rng, hookFormula, topic);
  const cta = (opts && Number.isInteger(opts.ctaIndex))
    ? cfg.ctas[opts.ctaIndex % cfg.ctas.length]
    : _pick(rng, cfg.ctas);

  const tags = _hashtags(rng, topic, cfg.hashtags);
  const emojiPool = ['🚀', '⚡', '🦄', '💎', '🔥', '✨', '📈', '🤖', '🧠', '🌍'];
  const lead = cfg.emoji ? `${_pick(rng, emojiPool)} ` : '';

  let body = `${lead}${hook}\n\n${cta}`;
  if (tags.length) body += `\n\n${tags.join(' ')}`;

  // Trim to max chars while preserving CTA.
  if (body.length > cfg.maxChars) {
    const reserve = cta.length + (tags.length ? tags.join(' ').length + 2 : 0) + 4;
    const room = Math.max(40, cfg.maxChars - reserve);
    const head = `${lead}${hook}`.slice(0, room - 1).trim() + '…';
    body = `${head}\n\n${cta}` + (tags.length ? `\n${tags.join(' ')}` : '');
    if (body.length > cfg.maxChars) body = body.slice(0, cfg.maxChars);
  }

  const id = 'VAR-' + crypto.createHash('sha256').update(`${seed}:${channel}:${hookFormula}`).digest('hex').slice(0, 12);
  return {
    id,
    channel,
    topic,
    body,
    cta,
    hashtags: tags,
    hookFormula,
    tone: cfg.tone,
    chars: body.length,
    maxChars: cfg.maxChars,
    seed,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Generate variants across multiple channels.
 * @param {object} opts {topic, channels?: string[], seed?, perChannel?: number}
 */
function generateMultiChannel(opts) {
  const o = opts || {};
  const channels = Array.isArray(o.channels) && o.channels.length
    ? o.channels.filter((c) => CHANNELS[c])
    : Object.keys(CHANNELS);
  const per = Math.max(1, Math.min(parseInt(o.perChannel, 10) || 1, 10));
  const seedBase = o.seed || `${o.topic || 'Unicorn'}:${Date.now()}`;
  const variants = [];
  for (const ch of channels) {
    for (let i = 0; i < per; i++) {
      variants.push(generateVariant(ch, { topic: o.topic, seed: `${seedBase}:${i}`, ctaIndex: i }));
    }
  }
  return {
    topic: o.topic || 'Unicorn Automation',
    requestedChannels: channels,
    perChannel: per,
    variants,
    generatedAt: new Date().toISOString(),
  };
}

function listChannels() {
  return Object.keys(CHANNELS).map((k) => ({
    channel: k,
    maxChars: CHANNELS[k].maxChars,
    tone: CHANNELS[k].tone,
    hashtagSlots: CHANNELS[k].hashtags,
  }));
}

module.exports = {
  CHANNELS,
  generateVariant,
  generateMultiChannel,
  listChannels,
};

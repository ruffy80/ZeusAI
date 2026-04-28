// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// marketing-innovations/viral-amplifier.js
//
// Maximum-force virality booster for the unicorn site and the unicorn
// itself. Combines:
//
//   - Viral-loop registry  (referral, content, marketplace, network, FOMO)
//   - Share-asset bundle   (OG image alt-text, share copy per channel,
//                           one-tap social URLs)
//   - Social-proof badges  (count-up users, BTC-paid sats, k-factor)
//   - Boost factor         (combines k-factor + CTR + share-rate + recency)
//   - Launch amplifier     (one call → builds variants, tracks bandit
//                           impressions, generates affiliate links,
//                           records share assets) — pure synchronous, no IO
//
// All sub-functions are pure where possible; in-memory loop registry is
// auto-seeded with safe defaults.
// =====================================================================

'use strict';

const crypto = require('crypto');
const content = require('./content-multichannel');
const affiliate = require('./affiliate-revenue');
const seo = require('./seo-engine');

const _loops = new Map();      // loopId → loop
const _shareEvents = [];       // share telemetry
const _amplifications = [];    // launch amplifier results

const DEFAULT_LOOPS = [
  { id: 'referral-2sided', name: 'Two-sided referral (sender + recipient reward)', kind: 'referral', strength: 0.85, kFactorTarget: 1.2 },
  { id: 'content-loop',    name: 'Content engine (every active user → 1 piece)', kind: 'content', strength: 0.7, kFactorTarget: 0.9 },
  { id: 'marketplace-loop', name: 'Marketplace seller invites buyer', kind: 'marketplace', strength: 0.75, kFactorTarget: 1.0 },
  { id: 'network-effect',  name: 'Network effect (multiplayer/shared workspace)', kind: 'network', strength: 0.9, kFactorTarget: 1.4 },
  { id: 'fomo-launch',     name: 'FOMO launch (countdown + waitlist)', kind: 'fomo', strength: 0.65, kFactorTarget: 0.8 },
  { id: 'btc-payout-loop', name: 'Affiliate BTC payouts → public proof → invites', kind: 'incentive', strength: 0.8, kFactorTarget: 1.1 },
];

function _seedLoops() {
  if (_loops.size) return;
  for (const l of DEFAULT_LOOPS) {
    _loops.set(l.id, {
      ...l,
      registeredAt: new Date().toISOString(),
      observations: 0,
      kFactorObserved: 0,
      shareCount: 0,
      ctrAvg: 0,
    });
  }
}
_seedLoops();

function registerLoop(opts) {
  const o = opts || {};
  const id = String(o.id || ('LOOP-' + crypto.randomBytes(3).toString('hex'))).slice(0, 64);
  const loop = {
    id,
    name: String(o.name || id).slice(0, 128),
    kind: String(o.kind || 'custom').slice(0, 32),
    strength: Math.max(0, Math.min(1, Number(o.strength != null ? o.strength : 0.5))),
    kFactorTarget: Math.max(0, Number(o.kFactorTarget || 1)),
    registeredAt: new Date().toISOString(),
    observations: 0,
    kFactorObserved: 0,
    shareCount: 0,
    ctrAvg: 0,
  };
  _loops.set(id, loop);
  return loop;
}

function listLoops() {
  return Array.from(_loops.values()).map((l) => ({
    ...l,
    healthScore: Math.round((l.strength * 0.4 + Math.min(1, l.kFactorObserved / Math.max(0.01, l.kFactorTarget)) * 0.6) * 100),
  })).sort((a, b) => b.healthScore - a.healthScore);
}

function recordLoopOutcome(opts) {
  const o = opts || {};
  const loop = _loops.get(String(o.id));
  if (!loop) return { ok: false, error: 'unknown_loop' };
  loop.observations += 1;
  if (o.kFactor != null) {
    const k = Math.max(0, Number(o.kFactor));
    loop.kFactorObserved = (loop.kFactorObserved * (loop.observations - 1) + k) / loop.observations;
  }
  if (o.ctr != null) {
    const c = Math.max(0, Math.min(1, Number(o.ctr)));
    loop.ctrAvg = (loop.ctrAvg * (loop.observations - 1) + c) / loop.observations;
  }
  if (o.shares != null) loop.shareCount += Math.max(0, Number(o.shares) | 0);
  return { ok: true, loop };
}

/**
 * Build a share-asset bundle for a given launch.
 * Returns one-tap URLs per channel that can be embedded in the UI.
 */
function buildShareAssets(opts) {
  const o = opts || {};
  const url = String(o.url || 'https://unicorn.example');
  const title = String(o.title || 'I am using the Unicorn — autonomous SaaS platform');
  const text = String(o.text || `${title} — try it: ${url}`);
  const hashtagBase = String(o.hashtag || 'UnicornAutomation');

  const enc = encodeURIComponent;
  const channels = [
    { channel: 'X', shareUrl: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}&hashtags=${enc(hashtagBase)}` },
    { channel: 'LinkedIn', shareUrl: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { channel: 'Facebook', shareUrl: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { channel: 'Reddit', shareUrl: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}` },
    { channel: 'Telegram', shareUrl: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { channel: 'WhatsApp', shareUrl: `https://wa.me/?text=${enc(text)}` },
    { channel: 'Email', shareUrl: `mailto:?subject=${enc(title)}&body=${enc(text)}` },
    { channel: 'HackerNews', shareUrl: `https://news.ycombinator.com/submitlink?u=${enc(url)}&t=${enc(title)}` },
  ];
  const meta = seo.buildMetaTags({ title, description: text, url, image: `${url}/og.png` });
  const ogAlt = `${title} — autonomous unicorn-grade SaaS`.slice(0, 160);
  const id = 'SH-' + crypto.createHash('sha256').update(url + '|' + title).digest('hex').slice(0, 12);
  const evt = { id, url, title, text, hashtag: hashtagBase, channels, meta: meta.tags, ogAlt, generatedAt: new Date().toISOString() };
  _shareEvents.push(evt);
  if (_shareEvents.length > 200) _shareEvents.splice(0, _shareEvents.length - 200);
  return evt;
}

/**
 * Social-proof bundle. Numbers can be supplied or come from optional
 * autoViralGrowth metrics — caller decides.
 */
function socialProof(opts) {
  const o = opts || {};
  const users = Math.max(0, Number(o.users || 0));
  const referralSignups = Math.max(0, Number(o.referralSignups || 0));
  const partnerMentions = Math.max(0, Number(o.partnerMentions || 0));
  const estimatedReach = Math.max(0, Number(o.estimatedReach || 0));
  const satsPaid = Math.max(0, Number(o.satsPaid || 0));
  const kFactor = Math.max(0, Number(o.kFactor || 0));
  const badges = [];
  if (users > 0) badges.push({ label: `${users.toLocaleString()} active builders` });
  if (referralSignups > 0) badges.push({ label: `${referralSignups.toLocaleString()} signups via referral` });
  if (partnerMentions > 0) badges.push({ label: `${partnerMentions.toLocaleString()} partner mentions` });
  if (estimatedReach > 0) badges.push({ label: `${estimatedReach.toLocaleString()} people reached` });
  if (satsPaid > 0) badges.push({ label: `${satsPaid.toLocaleString()} sats paid to affiliates` });
  if (kFactor > 0) badges.push({ label: `k-factor ${kFactor.toFixed(2)}${kFactor >= 1 ? ' · self-sustaining' : ''}` });
  return { badges, count: badges.length, generatedAt: new Date().toISOString() };
}

/**
 * Compute a single overall viral boost factor in [0..10] from internal
 * loop health, observed CTR and share counts. Useful as a UI indicator.
 */
function boostFactor() {
  const loops = listLoops();
  if (!loops.length) return { factor: 0, components: {}, generatedAt: new Date().toISOString() };
  const avgHealth = loops.reduce((a, l) => a + l.healthScore, 0) / loops.length / 100;     // 0..1
  const avgCtr = loops.reduce((a, l) => a + (l.ctrAvg || 0), 0) / loops.length;             // 0..1
  const totalShares = loops.reduce((a, l) => a + (l.shareCount || 0), 0);
  const shareScore = Math.min(1, Math.log10(1 + totalShares) / 4);                          // 0..1
  const recentBoost = Math.min(1, _amplifications.length / 50);                             // 0..1
  const factor = Math.round((avgHealth * 4 + avgCtr * 3 + shareScore * 2 + recentBoost) * 10) / 10;
  return {
    factor: Math.min(10, factor),
    components: { avgHealth, avgCtr, totalShares, shareScore, recentBoost },
    loops: loops.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * One-shot launch amplifier. Generates content variants, builds short
 * affiliate links, generates share assets, and records a launch entry.
 * Returns everything wired together so the caller can fan it out.
 */
function launchAmplify(opts) {
  const o = opts || {};
  const topic = String(o.topic || 'Unicorn Autonomous Marketing').slice(0, 128);
  const url = String(o.url || 'https://unicorn.example').slice(0, 256);
  const channels = Array.isArray(o.channels) && o.channels.length ? o.channels : ['X', 'LinkedIn', 'Reddit', 'Email'];
  const code = String(o.affiliateCode || '').slice(0, 64);

  const variants = content.generateMultiChannel({ topic, channels, perChannel: Math.max(1, Math.min(5, Number(o.perChannel) || 2)) });
  const links = variants.variants.map((v) => {
    const built = affiliate.buildLink({
      code, target: url, campaign: o.campaign || 'launch',
      source: v.channel.toLowerCase(), medium: 'social', content: v.id,
    });
    if (!built.ok) return { variantId: v.id, error: built.error };
    const sh = affiliate.shorten(built.url);
    return { variantId: v.id, url: built.url, shortPath: sh.ok ? sh.shortPath : null };
  });
  const shareBundle = buildShareAssets({ url, title: topic });
  const proof = socialProof(o.proof || {});

  const result = {
    id: 'AMPL-' + crypto.randomBytes(4).toString('hex'),
    topic, url,
    channels: variants.requestedChannels,
    variants: variants.variants,
    links,
    shareBundle,
    proof,
    boost: boostFactor(),
    generatedAt: new Date().toISOString(),
  };
  _amplifications.push({ id: result.id, ts: result.generatedAt, topic, url, variantCount: result.variants.length });
  if (_amplifications.length > 500) _amplifications.splice(0, _amplifications.length - 500);
  return result;
}

function recentAmplifications(limit) {
  const n = Math.max(1, Math.min(200, Number(limit) || 20));
  return _amplifications.slice(-n).reverse();
}

function getStatus() {
  return {
    loops: _loops.size,
    amplifications: _amplifications.length,
    shareBundlesGenerated: _shareEvents.length,
    boost: boostFactor(),
  };
}

function _resetForTests() {
  _loops.clear();
  _shareEvents.length = 0;
  _amplifications.length = 0;
  _seedLoops();
}

module.exports = {
  registerLoop,
  listLoops,
  recordLoopOutcome,
  buildShareAssets,
  socialProof,
  boostFactor,
  launchAmplify,
  recentAmplifications,
  getStatus,
  _resetForTests,
  DEFAULT_LOOPS,
};

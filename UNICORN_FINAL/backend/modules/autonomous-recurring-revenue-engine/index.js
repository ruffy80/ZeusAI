// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Protocol: ARRE/1.0 — Autonomous Recurring Revenue, Drift Watch & Global Utility
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const PROTOCOL = 'ARRE/1.0';
const APP_ROOT = path.resolve(__dirname, '..', '..', '..');
const DOMAIN = (process.env.PUBLIC_APP_URL || 'https://zeusai.pro')
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');

function safeReq(relPath) {
  try { return require(relPath); } catch (_) { return null; }
}

function resolveDataDir() {
  const dir = process.env.ARRE_DATA_DIR
    || (process.env.ZEUS_STATE_DIR ? path.join(process.env.ZEUS_STATE_DIR, 'arre') : null)
    || path.join(APP_ROOT, 'data', 'arre');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return dir;
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}';
}

function loadEd25519Keypair() {
  const keyFile = process.env.SITE_SIGN_KEY_FILE
    || path.join(os.homedir(), '.unicorn-keys', 'site-sign.pem');
  try {
    if (fs.existsSync(keyFile)) {
      const pem = fs.readFileSync(keyFile, 'utf8');
      const privateKey = crypto.createPrivateKey(pem);
      const publicKey = crypto.createPublicKey(privateKey);
      return {
        privateKey,
        publicKey,
        publicKeyBase64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
        keySource: 'site_persistent_ed25519',
      };
    }
  } catch (_) {}
  const pair = crypto.generateKeyPairSync('ed25519');
  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    publicKeyBase64: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    keySource: 'ephemeral_ed25519',
  };
}

// Universal Global Solution Matrix: Every Person + All 18 World Industries
const UNIVERSAL_PERSONAS = {
  individual_career: {
    label: 'Individual · Career & Personal Growth',
    headline: 'Instant Career Acceleration & Personal Brand Kit',
    primaryServiceId: 'instant-resume-makeover',
    bundleIds: ['instant-resume-makeover', 'instant-brand-voice'],
    why: 'Upgrade your resume, LinkedIn positioning, and personal brand voice autonomously in minutes.',
  },
  creator_brand: {
    label: 'Creator · Content & Social Growth',
    headline: 'Autonomous Creator Content, Logo & SEO Engine',
    primaryServiceId: 'instant-social-media-kit',
    bundleIds: ['instant-social-media-kit', 'instant-logo-kit', 'instant-seo-content-pack'],
    why: 'Launch a cohesive visual identity, social calendar, and AI-discoverable SEO/AEO content pack with 20% bundle savings.',
  },
  startup_smb: {
    label: 'Startup & Small Business',
    headline: 'Complete Launch, Audit & Conversion Growth Bundle',
    primaryServiceId: 'instant-website-audit',
    bundleIds: ['instant-website-audit', 'instant-seo-content-pack', 'instant-email-sequence'],
    why: 'Fix technical SEO/AEO/security gaps, publish citation-ready content, and automate high-converting email sequences.',
  },
  agency_developer: {
    label: 'Developer · Agency · AI Builder',
    headline: 'White-Label Autonomous Audit, MCP Tools & API Stack',
    primaryServiceId: 'instant-website-audit',
    bundleIds: ['instant-website-audit', 'instant-landing-page'],
    why: 'Connect 20 live MCP tools directly in Claude/Cursor/VS Code, earn 10% A2A affiliate commissions, and deploy client sites fast.',
  },
  ecommerce_retail: {
    label: 'E-Commerce & Retail',
    headline: 'Conversion Recovery, SEO Singularity & 24/7 AI Closer',
    primaryServiceId: 'instant-website-audit',
    bundleIds: ['instant-website-audit', 'instant-seo-content-pack', 'instant-email-sequence'],
    why: 'Eliminate checkout leakage, rank in Google + ChatGPT + Perplexity, and recover abandoned buyers autonomously.',
  },
  enterprise_industry: {
    label: 'Enterprise & Regulated Industries (18 Vertical OSes)',
    headline: 'Sovereign Vertical AI OS + Ed25519 Compliance Attestation',
    primaryServiceId: 'instant-security-program',
    bundleIds: ['instant-security-program', 'instant-website-audit'],
    why: 'Deploy sovereign multi-LLM routing, zero-CVE supply-chain attestation, and continuous autonomous governance.',
  },
};

const GLOBAL_INDUSTRIES = [
  'fintech', 'health', 'retail', 'logistics', 'manufacturing', 'energy',
  'agri', 'edu', 'govtech', 'legaltech', 'hospitality', 'media',
  'gaming', 'realestate', 'mobility', 'biotech', 'security', 'climate',
];

const DEFAULT_BANDIT_ARMS = [
  { id: 'proof_first_btc_bundle', label: 'Proof-Before-Pay Audit → -15% Bundle + -10% BTC', pulls: 1, totalRewardUsd: 0, paidConversions: 0 },
  { id: 'universal_solution_finder', label: 'Universal Persona/Industry Finder → Tailored Bundle', pulls: 1, totalRewardUsd: 0, paidConversions: 0 },
  { id: 'weekly_drift_watch_recurring', label: 'Audit + Weekly Autonomous Drift Watch Upsell', pulls: 1, totalRewardUsd: 0, paidConversions: 0 },
  { id: 'a2a_agent_affiliate_loop', label: 'MCP Agent-to-Agent 10%/10% Affiliate Funnel', pulls: 1, totalRewardUsd: 0, paidConversions: 0 },
];

class AutonomousRecurringRevenueEngine {
  constructor() {
    this.protocol = PROTOCOL;
    this.startedAt = new Date().toISOString();
    this.keys = loadEd25519Keypair();
    this.driftWatches = new Map();
    this.affiliates = new Map();
    this.banditArms = DEFAULT_BANDIT_ARMS.map((a) => Object.assign({}, a));
    this.totalBanditSelections = 0;
    this._loadState();
  }

  _signEnvelope(payload) {
    const payloadHash = crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
    const raw = Buffer.from(canonicalJson({ payloadHash, payload }), 'utf8');
    const signature = crypto.sign(null, raw, this.keys.privateKey).toString('base64');
    return {
      algorithm: 'Ed25519',
      keySource: this.keys.keySource,
      payloadHash,
      signature,
      publicKeyBase64: this.keys.publicKeyBase64,
    };
  }

  _stateFile(name) {
    return path.join(resolveDataDir(), name);
  }

  _loadState() {
    try {
      const bp = this._stateFile('bandit.json');
      if (fs.existsSync(bp)) {
        const parsed = JSON.parse(fs.readFileSync(bp, 'utf8'));
        if (Array.isArray(parsed.arms) && parsed.arms.length >= 2) {
          this.banditArms = parsed.arms;
        }
      }
    } catch (_) {}
    try {
      const dp = this._stateFile('drift-watches.jsonl');
      if (fs.existsSync(dp)) {
        for (const line of fs.readFileSync(dp, 'utf8').split('\n').filter(Boolean)) {
          try {
            const rec = JSON.parse(line);
            if (rec && rec.watchId) this.driftWatches.set(rec.watchId, rec);
          } catch (_) {}
        }
      }
    } catch (_) {}
    try {
      const ap = this._stateFile('affiliates.jsonl');
      if (fs.existsSync(ap)) {
        for (const line of fs.readFileSync(ap, 'utf8').split('\n').filter(Boolean)) {
          try {
            const rec = JSON.parse(line);
            if (rec && rec.code) this.affiliates.set(rec.code, rec);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  _saveBandit() {
    try {
      const p = this._stateFile('bandit.json');
      const tmp = `${p}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ updatedAt: new Date().toISOString(), arms: this.banditArms }, null, 2), 'utf8');
      fs.renameSync(tmp, p);
    } catch (_) {}
  }

  _appendJsonl(fileName, rec) {
    try {
      fs.appendFileSync(this._stateFile(fileName), JSON.stringify(rec) + '\n', 'utf8');
    } catch (_) {}
  }

  /**
   * 1. Universal Global Utility & 18-Industry Solution Finder
   * Matches ANY human or ANY of the 18 world industries to real buyable services & bundles.
   */
  recommendUniversalSolution(opts = {}) {
    const rawPersona = String(opts.persona || '').trim().toLowerCase();
    const rawIndustry = String(opts.industry || '').trim().toLowerCase().replace(/-os$/, '');
    const rawGoal = String(opts.goal || '').trim().toLowerCase();

    let personaKey = 'startup_smb';
    if (UNIVERSAL_PERSONAS[rawPersona]) {
      personaKey = rawPersona;
    } else if (/career|resume|cv|job|linkedin|student|personal/.test(rawPersona + ' ' + rawGoal)) {
      personaKey = 'individual_career';
    } else if (/creator|brand|social|logo|youtube|tiktok|content/.test(rawPersona + ' ' + rawGoal)) {
      personaKey = 'creator_brand';
    } else if (/dev|agency|mcp|api|code|engineer|builder|saas/.test(rawPersona + ' ' + rawGoal)) {
      personaKey = 'agency_developer';
    } else if (/ecom|shop|store|retail|sales|cart/.test(rawPersona + ' ' + rawGoal)) {
      personaKey = 'ecommerce_retail';
    } else if (/enterprise|bank|fintech|health|gov|legal|security|energy|biotech|manufactur/.test(rawPersona + ' ' + rawIndustry + ' ' + rawGoal)) {
      personaKey = 'enterprise_industry';
    }

    const profile = UNIVERSAL_PERSONAS[personaKey];
    const matchedIndustry = GLOBAL_INDUSTRIES.includes(rawIndustry) ? rawIndustry : null;
    const verticalOsId = matchedIndustry ? `${matchedIndustry}-os` : null;

    const smce = safeReq('../autonomous-m2m-commerce-engine');
    const deal = smce && typeof smce.negotiateAutonomousDeal === 'function'
      ? smce.negotiateAutonomousDeal({
        serviceIds: profile.bundleIds,
        budgetUsd: opts.budgetUsd,
        rail: opts.rail || 'btc',
        referralCode: opts.ref || opts.referralCode,
        domain: opts.domain,
      })
      : null;

    return {
      ok: true,
      protocol: PROTOCOL,
      personaKey,
      personaLabel: profile.label,
      headline: profile.headline,
      why: profile.why,
      matchedIndustry,
      verticalOsId,
      verticalOsUrl: verticalOsId ? `${DOMAIN}/services/${encodeURIComponent(verticalOsId)}` : null,
      freeEntryToolUrl: `${DOMAIN}/#proofMagnetStudio`,
      primaryServiceId: profile.primaryServiceId,
      recommendedBundleIds: profile.bundleIds,
      bundleOffer: deal && deal.ok ? deal.payload : null,
      attestation: deal && deal.ok ? deal.attestation : null,
      allSupportedPersonas: Object.keys(UNIVERSAL_PERSONAS).map((k) => ({ id: k, label: UNIVERSAL_PERSONAS[k].label })),
      allSupportedIndustries: GLOBAL_INDUSTRIES.map((ind) => `${ind}-os`),
    };
  }

  /**
   * 2. Weekly Client Drift Watch (Recurring Retention & Differential Ed25519 Proofs)
   */
  registerDriftWatch({ domain, email = null, orderId = null, baselineScore = null, cadenceDays = 7 } = {}) {
    const cleanDomain = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/[^a-z0-9.-]/g, '').slice(0, 120);
    if (!cleanDomain || !cleanDomain.includes('.')) {
      return { ok: false, protocol: PROTOCOL, error: 'valid_public_domain_required' };
    }
    const watchId = 'dw_' + crypto.createHash('sha256').update(cleanDomain + '|' + (orderId || 'public')).digest('hex').slice(0, 12);
    const nowIso = new Date().toISOString();
    const nextRunIso = new Date(Date.now() + Math.max(1, Number(cadenceDays) || 7) * 86400 * 1000).toISOString();
    const record = {
      watchId,
      domain: cleanDomain,
      url: `https://${cleanDomain}`,
      orderId: orderId || null,
      emailMasked: email ? (String(email).slice(0, 2) + '***') : null,
      cadenceDays: Math.max(1, Math.min(30, Number(cadenceDays) || 7)),
      baselineScore: typeof baselineScore === 'number' ? baselineScore : null,
      lastScore: typeof baselineScore === 'number' ? baselineScore : null,
      runsCompleted: 0,
      status: 'ACTIVE_WEEKLY_WATCH',
      createdAt: nowIso,
      nextRunAt: nextRunIso,
      history: [],
    };
    this.driftWatches.set(watchId, record);
    this._appendJsonl('drift-watches.jsonl', record);
    return { ok: true, protocol: PROTOCOL, watch: record };
  }

  async runDriftWatchCycle(watchId, { dryRunHtml = null } = {}) {
    const rec = this.driftWatches.get(String(watchId || ''));
    if (!rec) return { ok: false, protocol: PROTOCOL, error: 'drift_watch_not_found' };
    const acme = safeReq('../autonomous-client-magnet');
    if (!acme || typeof acme.runProofBeforePayTeaser !== 'function') {
      return { ok: false, protocol: PROTOCOL, error: 'acme_unavailable' };
    }
    const scan = await acme.runProofBeforePayTeaser(rec.url, { dryRunHtml });
    if (!scan || !scan.ok) {
      return { ok: false, protocol: PROTOCOL, error: (scan && scan.error) || 'scan_failed' };
    }
    const prevScore = typeof rec.lastScore === 'number' ? rec.lastScore : scan.liveScore;
    if (rec.baselineScore == null) rec.baselineScore = scan.liveScore;
    const scoreDelta = scan.liveScore - prevScore;
    rec.lastScore = scan.liveScore;
    rec.runsCompleted += 1;
    rec.lastRunAt = new Date().toISOString();
    rec.nextRunAt = new Date(Date.now() + rec.cadenceDays * 86400 * 1000).toISOString();

    const diffReport = {
      protocol: PROTOCOL,
      watchId: rec.watchId,
      domain: rec.domain,
      scannedAt: rec.lastRunAt,
      baselineScore: rec.baselineScore,
      previousScore: prevScore,
      currentScore: scan.liveScore,
      scoreDelta,
      driftDetected: scoreDelta < 0 || (scan.detectedGaps && scan.detectedGaps.length > 0),
      detectedGapsCount: scan.detectedGaps ? scan.detectedGaps.length : 0,
      remediationBundleUrl: `${DOMAIN}/checkout/?plan=instant-website-audit&add=instant-seo-content-pack&url=${encodeURIComponent(rec.url)}&rail=btc`,
    };
    const attestation = this._signEnvelope(diffReport);
    rec.history.unshift({ at: rec.lastRunAt, score: scan.liveScore, delta: scoreDelta, gaps: diffReport.detectedGapsCount });
    if (rec.history.length > 12) rec.history.length = 12;
    this._appendJsonl('drift-watches.jsonl', rec);

    return { ok: true, report: diffReport, attestation };
  }

  /**
   * 3. Global Agent-to-Agent Affiliate Mesh (10% friend discount + 10% partner commission)
   */
  enrollAgentAffiliate({ agentOrPartnerId, payoutBtcAddress = null, channel = 'mcp_agent' } = {}) {
    const cleanId = String(agentOrPartnerId || '').trim().slice(0, 100);
    if (!cleanId) return { ok: false, protocol: PROTOCOL, error: 'partner_id_required' };
    const acme = safeReq('../autonomous-client-magnet');
    const ref = acme && typeof acme.createReferralLink === 'function'
      ? acme.createReferralLink(cleanId)
      : {
        code: 'zeus_' + crypto.createHash('sha256').update(cleanId.toLowerCase() + '|acme-v1').digest('hex').slice(0, 10),
        shareUrl: `${DOMAIN}/?ref=zeus_${crypto.createHash('sha256').update(cleanId.toLowerCase() + '|acme-v1').digest('hex').slice(0, 10)}`,
      };

    const rec = {
      code: ref.code,
      partnerHash: crypto.createHash('sha256').update(cleanId.toLowerCase()).digest('hex').slice(0, 16),
      channel: String(channel || 'mcp_agent').slice(0, 40),
      payoutBtcSet: Boolean(payoutBtcAddress && /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,62}$/.test(String(payoutBtcAddress).trim())),
      friendDiscountPct: 10,
      commissionPct: 10,
      shareUrl: ref.shareUrl,
      auditShareTemplate: `${DOMAIN}/?audit=<target-domain>&ref=${encodeURIComponent(ref.code)}`,
      enrolledAt: new Date().toISOString(),
    };
    this.affiliates.set(rec.code, rec);
    this._appendJsonl('affiliates.jsonl', rec);
    return { ok: true, protocol: PROTOCOL, affiliate: rec };
  }

  /**
   * 4. Real-Revenue UCB1 Conversion Bandit (ONLY learns from real verified revenue)
   */
  selectConversionVariant() {
    this.totalBanditSelections += 1;
    const totalPulls = this.banditArms.reduce((s, a) => s + Math.max(1, a.pulls), 0);
    const C = 1.4;
    let best = this.banditArms[0];
    let bestScore = -Infinity;
    for (const arm of this.banditArms) {
      const meanReward = arm.totalRewardUsd / Math.max(1, arm.pulls);
      const ucb = meanReward + C * Math.sqrt(Math.log(totalPulls + 1) / Math.max(1, arm.pulls));
      if (ucb > bestScore) {
        bestScore = ucb;
        best = arm;
      }
    }
    return {
      ok: true,
      protocol: PROTOCOL,
      inventsConversions: false,
      selectedVariant: best.id,
      label: best.label,
      ucbScore: Number(bestScore.toFixed(4)),
      arms: this.banditArms,
    };
  }

  recordRealConversionOutcome({ variantId, confirmedRevenueUsd = 0 } = {}) {
    const arm = this.banditArms.find((a) => a.id === variantId);
    if (!arm) return { ok: false, error: 'unknown_variant' };
    arm.pulls += 1;
    const rev = Number(confirmedRevenueUsd || 0);
    if (rev > 0) {
      arm.totalRewardUsd = Number((arm.totalRewardUsd + rev).toFixed(2));
      arm.paidConversions += 1;
    }
    this._saveBandit();
    return { ok: true, protocol: PROTOCOL, arm };
  }

  getArreManifest() {
    const payload = {
      protocol: PROTOCOL,
      name: 'ZeusAI Autonomous Recurring Revenue, Drift Watch & Global Utility Engine',
      domain: DOMAIN,
      issuedAt: new Date().toISOString(),
      inventsMetrics: false,
      inventsConversions: false,
      supportedPersonasCount: Object.keys(UNIVERSAL_PERSONAS).length,
      supportedIndustriesCount: GLOBAL_INDUSTRIES.length,
      activeDriftWatches: this.driftWatches.size,
      enrolledAffiliates: this.affiliates.size,
      banditArms: this.banditArms,
      endpoints: {
        recommend: `${DOMAIN}/api/arre/recommend`,
        enrollAffiliate: `${DOMAIN}/api/arre/affiliate/enroll`,
        registerDriftWatch: `${DOMAIN}/api/arre/drift-watch/register`,
        runDriftWatch: `${DOMAIN}/api/arre/drift-watch/run`,
        bandit: `${DOMAIN}/api/arre/bandit`,
      },
    };
    const attestation = this._signEnvelope(payload);
    return { ok: true, payload, attestation };
  }

  getStatus() {
    return {
      ok: true,
      module: 'autonomous-recurring-revenue-engine',
      protocol: PROTOCOL,
      startedAt: this.startedAt,
      activeDriftWatches: this.driftWatches.size,
      enrolledAffiliates: this.affiliates.size,
      banditArmsCount: this.banditArms.length,
      supportedPersonasCount: Object.keys(UNIVERSAL_PERSONAS).length,
      supportedIndustriesCount: GLOBAL_INDUSTRIES.length,
    };
  }

  health() {
    return {
      ok: true,
      protocol: PROTOCOL,
      activeDriftWatches: this.driftWatches.size,
      enrolledAffiliates: this.affiliates.size,
      supportedIndustriesCount: GLOBAL_INDUSTRIES.length,
    };
  }
}

const arre = new AutonomousRecurringRevenueEngine();
module.exports = arre;

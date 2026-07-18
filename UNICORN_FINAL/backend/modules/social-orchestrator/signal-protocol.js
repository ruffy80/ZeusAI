// =====================================================================
// ZEUSAI SOCIAL — Autonomous Signal Protocol (v1)
//
// INVENTION: a public, hash-chained ledger of social-autonomy decisions
// (health · strategy · viral · federation · commerce mirror) plus
// Proof-of-Reach — transparent reach of the autonomous layer without
// fake likes / fake followers.
// =====================================================================
'use strict';

const crypto = require('crypto');

const PROTOCOL = 'zeusai-social-asp-v1';
const MAX_ENTRIES = Math.max(50, Number(process.env.ZEUSAI_SOCIAL_LEDGER || 400));

function now() { return new Date().toISOString(); }

class AutonomousSignalProtocol {
  constructor() {
    this.entries = [];
    this.signals = 0;
    this.startedAt = now();
  }

  _hash(body) {
    return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
  }

  append(type, payload) {
    const prev = this.entries[0] || null;
    const prevHash = prev ? prev.hash : 'genesis';
    const seq = prev ? (Number(prev.seq) || 0) + 1 : 1;
    const core = {
      protocol: PROTOCOL,
      at: now(),
      prevHash,
      seq,
      type: String(type || 'signal'),
      payload: payload || {},
    };
    const hash = this._hash(core);
    const rec = Object.assign({}, core, { hash });
    this.entries.unshift(rec);
    if (this.entries.length > MAX_ENTRIES) this.entries.length = MAX_ENTRIES;
    this.signals += 1;
    return rec;
  }

  /** Build a public feed item from an orchestrator decision / log. */
  materializeFeed(decisions, logs, viralStatus) {
    const out = [];
    for (const d of (decisions || []).slice(0, 16)) {
      out.push({
        kind: 'strategy-signal',
        author: 'ZeusAI Social · Autonomy',
        title: d.title || 'autonomous decision',
        body: d.result || 'logged',
        at: d.ts || now(),
        proof: 'decision-ledger',
      });
    }
    for (const l of (logs || []).slice(-8).reverse()) {
      out.push({
        kind: 'system-signal',
        author: 'ZeusAI Social · Kernel',
        title: l.type || 'system',
        body: typeof l.payload === 'string'
          ? l.payload
          : (l.payload && (l.payload.note || l.payload.action || l.payload.result)) || 'cycle recorded',
        at: l.ts || now(),
        proof: 'system-log',
      });
    }
    if (viralStatus && viralStatus.ok !== false) {
      out.push({
        kind: 'viral-signal',
        author: 'ZeusAI Social · Viral Engine',
        title: 'Distribution pulse',
        body: viralStatus.lastPost
          ? String(viralStatus.lastPost).slice(0, 220)
          : ('Engine ' + (viralStatus.state || viralStatus.mode || 'armed') + ' · posts queued autonomously when providers are connected'),
        at: viralStatus.lastAt || now(),
        proof: 'viral-engine',
      });
    }
    // Newest first by timestamp when possible
    out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return out.slice(0, 24);
  }

  proofOfReach(metrics, modules, mode) {
    const activeMods = (modules || []).filter((m) => m && m.state === 'active').length;
    const totalMods = (modules || []).length || 10;
    const usd = Number((metrics && metrics.profitUsdDay) || 0);
    const coverage = Math.round((activeMods / Math.max(1, totalMods)) * 100);
    // Attention Arbitrage Score — ranks autonomous density × commerce mirror
    // without inventing vanity followers. Scale is relative / honest.
    const attentionArbitrage = Math.min(99, Math.round(
      (coverage * 0.45) + (Math.min(usd, 5000) / 5000) * 35 + Math.min(this.signals, 200) / 200 * 20
    ));
    return {
      ok: true,
      protocol: PROTOCOL,
      honesty: 'Proof-of-Reach reports autonomous layer capacity — not scraped follower counts from third-party networks.',
      mode: mode || 'dry-run',
      modulesActive: activeMods,
      modulesTotal: totalMods,
      autonomyCoveragePct: coverage,
      signalCount: this.signals,
      ledgerDepth: this.entries.length,
      commerceMirrorUsdDay: usd,
      commerceMirrorBtcDay: Number((metrics && metrics.profitBtcDay) || 0),
      attentionArbitrageScore: attentionArbitrage,
      differentiators: [
        'Autonomous Signal Protocol — hash-chained social decisions',
        'Proof-of-Reach — transparent capacity, zero fake engagement UI',
        'Commerce Mirror — social autonomy tied to live Zeus revenue engines',
        'Attention Arbitrage Score — economic density of autonomy, not vanity likes',
        'Provider-honest posting — real distribution only when keys exist',
        'Federation-ready ActivityPub broadcasts when peers are discovered',
      ],
    };
  }

  pulse(limit) {
    const n = Math.max(1, Math.min(40, Number(limit) || 12));
    return {
      ok: true,
      brand: 'ZeusAI Social',
      protocol: PROTOCOL,
      invention: 'Autonomous Signal Protocol — the social layer that logs every autonomy decision in a public hash chain and proves reach without fake likes.',
      signals: this.signals,
      startedAt: this.startedAt,
      ledgerHead: this.entries[0] || null,
      recent: this.entries.slice(0, n),
      chainIntact: this.verifyChain().ok,
    };
  }

  verifyChain() {
    if (!this.entries.length) return { ok: true, checked: 0 };
    const chronological = this.entries.slice().reverse();
    let prevHash = 'genesis';
    for (let i = 0; i < chronological.length; i++) {
      const rec = chronological[i];
      if (rec.prevHash !== prevHash) {
        return { ok: false, brokenAt: rec.seq, expectedPrev: prevHash, gotPrev: rec.prevHash };
      }
      const core = Object.assign({}, rec);
      delete core.hash;
      if (rec.hash !== this._hash(core)) {
        return { ok: false, brokenAt: rec.seq, reason: 'hash_mismatch' };
      }
      prevHash = rec.hash;
    }
    return { ok: true, checked: chronological.length, head: this.entries[0].hash };
  }
}

module.exports = { AutonomousSignalProtocol, PROTOCOL };

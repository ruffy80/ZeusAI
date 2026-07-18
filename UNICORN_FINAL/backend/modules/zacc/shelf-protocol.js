// =====================================================================
// ZEUS ASP — Autonomous Shelf Protocol (v1)
//
// INVENTION: the first commerce protocol where listed SKUs continuously
// compete for shelf rank by living fitness, and every autonomous decision
// (tournament / promote / demote / margin-seal) is appended to a public,
// hash-chained Yield Ledger anyone can audit.
//
// Shopify-class platforms hide ranking, ads, and fee math. ASP makes the
// store's nervous system legible — a capability the world needs and that
// did not exist as a packaged storefront primitive.
// =====================================================================
'use strict';

const crypto = require('crypto');
const { now, clamp, round2, logger } = require('./util');

const log = logger('shelf');

const SHELF_CAP = Math.max(1, Number(process.env.ZACC_SHELF_CAP || 80) || 80);
const MAX_LEDGER = Math.max(50, Number(process.env.ZACC_SHELF_LEDGER || 500));
const PROTOCOL = 'zeus-asp-v1';

function fitness(p) {
  const margin = clamp((Number(p.marginPct) || 0) / 100, 0, 1);
  const profit = clamp((Number(p.netProfitUsd) || 0) / 50, 0, 1);
  const potential = clamp((Number(p.profitPotential) || 0) / 100, 0, 1);
  const views = clamp(Math.log10(1 + ((p.metrics && p.metrics.views) || 0)) / 3, 0, 1);
  const sales = clamp(((p.metrics && p.metrics.sales) || 0) / 10, 0, 1);
  const carts = clamp(((p.metrics && p.metrics.carts) || 0) / 20, 0, 1);
  const fulfill = (p.delivery && p.delivery.automated) ? 1 : 0.55;
  const demoPenalty = p.demoOnly === true ? 0.72 : 1;
  const publishedMs = Date.parse(p.publishedAt || '') || Date.now();
  const ageDays = Math.max(0, (Date.now() - publishedMs) / 86400000);
  const fresh = clamp(1 - (ageDays / 14), 0.35, 1);
  const score = (
    margin * 0.26 +
    profit * 0.20 +
    potential * 0.16 +
    sales * 0.12 +
    carts * 0.08 +
    views * 0.06 +
    fulfill * 0.07 +
    fresh * 0.05
  ) * demoPenalty;
  return round2(score * 100);
}

function why(p, score, rank) {
  const bits = [
    'fitness ' + score,
    'rank #' + rank,
    'margin ' + round2(Number(p.marginPct) || 0) + '%',
    'net $' + round2(Number(p.netProfitUsd) || 0),
  ];
  if (p.delivery && p.delivery.automated) bits.push('auto-fulfil');
  else bits.push('desk-fulfil');
  return bits.join(' · ');
}

class AutonomousShelfProtocol {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.ledger = []; // newest-first, hash-chained
    this.lastTournament = null;
    this.tournaments = 0;
    this.seals = 0;
    this.startedAt = now();
  }

  _hash(body) {
    return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 32);
  }

  _append(entry) {
    const prev = this.ledger[0] || null;
    const prevHash = prev ? prev.hash : 'genesis';
    const seq = prev ? (Number(prev.seq) || 0) + 1 : 1;
    const core = Object.assign({ protocol: PROTOCOL, at: now(), prevHash, seq }, entry);
    const hash = this._hash(core);
    const rec = Object.assign({}, core, { hash });
    this.ledger.unshift(rec);
    if (this.ledger.length > MAX_LEDGER) this.ledger.length = MAX_LEDGER;
    return rec;
  }

  /**
   * Run a full shelf tournament: reorder publisher.published by fitness,
   * stamp shelf metadata, soft-hide SKUs beyond SHELF_CAP, append ledger.
   */
  runTournament(publisher) {
    if (!publisher || !Array.isArray(publisher.published)) {
      return { ok: false, error: 'publisher_unavailable' };
    }
    const items = publisher.published.slice();
    const prevRank = new Map();
    items.forEach((p, i) => prevRank.set(p.id, (p.shelf && p.shelf.rank) || (i + 1)));

    const scored = items.map((p) => ({ p, fitness: fitness(p) }))
      .sort((a, b) => b.fitness - a.fitness || String(a.p.id).localeCompare(String(b.p.id)));

    const promoted = [];
    const demoted = [];
    const archived = [];

    publisher.published = scored.map((row, i) => {
      const rank = i + 1;
      const prev = prevRank.get(row.p.id) || null;
      row.p.shelf = {
        fitness: row.fitness,
        rank,
        prevRank: prev,
        delta: prev != null ? (prev - rank) : 0,
        why: why(row.p, row.fitness, rank),
        tournamentAt: now(),
        protocol: PROTOCOL,
      };
      row.p.shelfHidden = rank > SHELF_CAP;
      if (row.p.shelfHidden) archived.push(row.p.id);
      if (prev != null && rank < prev) promoted.push({ id: row.p.id, title: row.p.title, from: prev, to: rank, fitness: row.fitness });
      if (prev != null && rank > prev) demoted.push({ id: row.p.id, title: row.p.title, from: prev, to: rank, fitness: row.fitness });
      return row.p;
    });

    if (publisher.byId && typeof publisher.byId.clear === 'function') {
      publisher.byId.clear();
      for (const p of publisher.published) publisher.byId.set(p.id, p);
    }

    const decision = {
      type: 'shelf_tournament',
      listed: publisher.published.length,
      visible: Math.min(SHELF_CAP, publisher.published.length),
      shelfCap: SHELF_CAP,
      promoted: promoted.slice(0, 8),
      demoted: demoted.slice(0, 8),
      archived: archived.slice(0, 12),
      top: scored.slice(0, 5).map((x) => ({
        id: x.p.id,
        title: x.p.title,
        fitness: x.fitness,
        marginPct: x.p.marginPct,
        priceUsd: x.p.priceUsd,
      })),
    };
    const rec = this._append(decision);
    this.lastTournament = Object.assign({}, decision, { hash: rec.hash, seq: rec.seq, at: rec.at });
    this.tournaments += 1;
    log.info('tournament #' + this.tournaments, 'visible', decision.visible, 'promoted', promoted.length, 'demoted', demoted.length);
    return { ok: true, tournament: this.lastTournament, ledgerHash: rec.hash };
  }

  /** Cryptographic commitment to Proof-of-Margin at quote time. */
  sealMargin(product, extra) {
    if (!product || !product.id) return { ok: false, error: 'product_required' };
    const proof = product.proofOfMargin || {
      costUsd: product.costUsd,
      shippingUsd: product.shippingUsd,
      netProfitUsd: product.netProfitUsd,
      marginPct: product.marginPct,
    };
    const payload = {
      productId: product.id,
      title: product.title,
      priceUsd: product.priceUsd,
      proof,
      shelf: product.shelf ? { rank: product.shelf.rank, fitness: product.shelf.fitness } : null,
      extra: extra || null,
      at: now(),
    };
    const seal = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 40);
    const rec = this._append({
      type: 'margin_seal',
      productId: product.id,
      seal,
      priceUsd: product.priceUsd,
      marginPct: proof.marginPct,
    });
    this.seals += 1;
    return { ok: true, seal, protocol: PROTOCOL, ledgerHash: rec.hash, seq: rec.seq, committed: payload };
  }

  pulse(limit) {
    const n = Math.max(1, Math.min(40, Number(limit) || 12));
    return {
      ok: true,
      protocol: PROTOCOL,
      invention: 'Autonomous Shelf Protocol — SKUs compete for shelf rank by living fitness; every decision is hash-chained in a public Yield Ledger.',
      differentiator: 'No Shopify-class storefront exposes a verifiable, append-only autonomy ledger of shelf + margin decisions.',
      tournaments: this.tournaments,
      seals: this.seals,
      shelfCap: SHELF_CAP,
      lastTournament: this.lastTournament,
      ledgerHead: this.ledger[0] || null,
      recent: this.ledger.slice(0, n),
      startedAt: this.startedAt,
    };
  }

  ledger(limit) {
    const n = Math.max(1, Math.min(200, Number(limit) || 50));
    return {
      ok: true,
      protocol: PROTOCOL,
      count: this.ledger.length,
      items: this.ledger.slice(0, n),
      intact: this.verifyChain().ok,
    };
  }

  verifyChain() {
    if (!this.ledger.length) return { ok: true, checked: 0 };
    // ledger is newest-first; walk from oldest to newest for chain check
    const chronological = this.ledger.slice().reverse();
    let prevHash = 'genesis';
    for (let i = 0; i < chronological.length; i++) {
      const rec = chronological[i];
      if (rec.prevHash !== prevHash) {
        return { ok: false, brokenAt: rec.seq, expectedPrev: prevHash, gotPrev: rec.prevHash };
      }
      const { hash, ...core } = rec;
      const expect = this._hash(core);
      if (hash !== expect) {
        return { ok: false, brokenAt: rec.seq, reason: 'hash_mismatch' };
      }
      prevHash = hash;
    }
    return { ok: true, checked: chronological.length, head: this.ledger[0].hash };
  }

  status() {
    return {
      ok: true,
      protocol: PROTOCOL,
      tournaments: this.tournaments,
      seals: this.seals,
      ledger: this.ledger.length,
      shelfCap: SHELF_CAP,
      lastTournamentAt: this.lastTournament && this.lastTournament.at,
      chainIntact: this.verifyChain().ok,
    };
  }

  toState() {
    return {
      ledger: this.ledger.slice(0, 100),
      tournaments: this.tournaments,
      seals: this.seals,
      lastTournament: this.lastTournament,
      startedAt: this.startedAt,
    };
  }

  fromState(s) {
    if (!s) return;
    if (Array.isArray(s.ledger)) this.ledger = s.ledger.slice(0, MAX_LEDGER);
    if (Number.isFinite(s.tournaments)) this.tournaments = s.tournaments;
    if (Number.isFinite(s.seals)) this.seals = s.seals;
    if (s.lastTournament) this.lastTournament = s.lastTournament;
    if (s.startedAt) this.startedAt = s.startedAt;
  }
}

module.exports = {
  AutonomousShelfProtocol,
  PROTOCOL,
  SHELF_CAP,
  fitness,
  why,
};

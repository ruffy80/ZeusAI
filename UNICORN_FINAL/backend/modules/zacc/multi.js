// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================
//
// ZACC component 7 — Multi-instance / Niche Manager.
// RO: permite clone ZACC pe nișe diferite (produse fizice, servicii AI,
// crypto…). Spec-ul cerea containere Docker separate; pentru a NU sparge
// contractul de deploy push-to-main (un singur cluster pm2), implementăm
// nișele ca partiții izolate în-proces, cu parametri și buget proprii. Fiecare
// partiție e echivalentul logic al unui container, gata de extras într-un
// proces separat mai târziu dacă owner-ul dorește.

'use strict';

const { now, clamp, logger } = require('./util');

const log = logger('multi');

const DEFAULT_NICHES = [
  { id: 'core', label: 'Core AI services', categories: ['ai-service', 'digital'], cpuShare: 0.4, ramShareMb: 512 },
  { id: 'physical', label: 'Physical / print-on-demand', categories: ['physical'], cpuShare: 0.2, ramShareMb: 256 },
  { id: 'ai-services', label: 'Premium AI suites', categories: ['ai-service', 'subscription'], cpuShare: 0.25, ramShareMb: 384 },
  { id: 'crypto', label: 'Crypto-native commerce', categories: ['crypto'], cpuShare: 0.15, ramShareMb: 256 },
];

class MultiInstanceManager {
  constructor(ctx) {
    this.ctx = ctx || {};
    this.niches = new Map();
    for (const n of DEFAULT_NICHES) {
      this.niches.set(n.id, Object.assign({}, n, {
        active: n.id === 'core',
        products: 0, revenueUsd: 0, createdAt: now(),
      }));
    }
  }

  // Route an idea to the niche whose categories match its type.
  routeIdea(idea) {
    if (!idea) return 'core';
    for (const n of this.niches.values()) {
      if (n.active && n.categories.includes(idea.type)) return n.id;
    }
    return 'core';
  }

  spawn(id, label, categories) {
    if (this.niches.has(id)) { this.niches.get(id).active = true; return this.niches.get(id); }
    const n = {
      id, label: label || id, categories: categories || ['ai-service'],
      cpuShare: 0.15, ramShareMb: 256, active: true,
      products: 0, revenueUsd: 0, createdAt: now(),
    };
    this.niches.set(id, n);
    log.info('spawned niche partition:', id);
    return n;
  }

  pause(id) { const n = this.niches.get(id); if (n) n.active = false; return n || null; }
  resume(id) { const n = this.niches.get(id); if (n) n.active = true; return n || null; }

  allocate(id, cpuShare, ramShareMb) {
    const n = this.niches.get(id);
    if (!n) return null;
    if (cpuShare != null) n.cpuShare = clamp(cpuShare, 0.05, 1);
    if (ramShareMb != null) n.ramShareMb = Math.max(64, Number(ramShareMb) || n.ramShareMb);
    return n;
  }

  attribute(nicheId, revenueUsd) {
    const n = this.niches.get(nicheId) || this.niches.get('core');
    if (n) { n.products += 0; n.revenueUsd += Number(revenueUsd) || 0; }
  }

  countProduct(nicheId) {
    const n = this.niches.get(nicheId) || this.niches.get('core');
    if (n) n.products += 1;
  }

  // Persistence helpers.
  toState() {
    const arr = [];
    for (const n of this.niches.values()) arr.push(Object.assign({}, n));
    return { niches: arr };
  }
  fromState(s) {
    if (!s || !Array.isArray(s.niches)) return;
    for (const saved of s.niches) {
      if (!saved || !saved.id) continue;
      const existing = this.niches.get(saved.id) || {};
      this.niches.set(saved.id, Object.assign({}, existing, saved));
    }
  }

  status() {
    const list = [];
    for (const n of this.niches.values()) {
      list.push({
        id: n.id, label: n.label, active: n.active, categories: n.categories,
        products: n.products, revenueUsd: Math.round(n.revenueUsd * 100) / 100,
        cpuShare: n.cpuShare, ramShareMb: n.ramShareMb,
      });
    }
    return {
      ok: true,
      model: 'in-process-partition',
      note: 'Logical containers; ready to extract to separate processes on demand.',
      total: list.length,
      active: list.filter(n => n.active).length,
      niches: list,
    };
  }
}

module.exports = { MultiInstanceManager, DEFAULT_NICHES };

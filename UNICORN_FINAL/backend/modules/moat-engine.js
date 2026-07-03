// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =============================================================================
// moat-engine.js — Competitive Moat Creation & Defensibility Engine
// Motor de creare avantaj competitiv pentru platforma Unicorn SaaS
// =============================================================================
// Identifies, scores and strengthens:
//   1. Proprietary Systems      — unique platform capabilities
//   2. Data Moats               — unique datasets, feedback loops
//   3. Intelligence Loops       — self-improving AI feedback cycles
//   4. Retention Advantages     — switching costs, lock-in, network effects
//   5. Infrastructure Moats     — speed, reliability, cost advantages
//   6. Ecosystem Moats          — integrations, marketplace, developer network
//   7. Brand & Trust Moats      — reputation, certifications, compliance
// =============================================================================

'use strict';

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const DATA_DIR  = path.join(__dirname, '../../data/moat-engine');
const DATA_FILE = path.join(DATA_DIR, 'moat-state.json');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}

// ── §1  MOAT CATALOG ──────────────────────────────────────────────────────

const MOAT_CATALOG = [
  // Proprietary Systems
  {
    id: 'autonomous-ai-brain',
    category: 'proprietary',
    name: 'Autonomous AI Brain (ZAC)',
    description: 'Self-healing, self-improving AI orchestrator that competitors cannot clone quickly',
    defensibilityScore: 92,
    maturity: 'active',
    strengtheningActions: ['publish benchmark results', 'patent key algorithms', 'publish case studies'],
  },
  {
    id: 'unicorn-module-mesh',
    category: 'proprietary',
    name: 'Unicorn Module Mesh (169+ modules)',
    description: 'Integrated multi-domain module system covering 50+ business verticals simultaneously',
    defensibilityScore: 88,
    maturity: 'active',
    strengtheningActions: ['open SDK for third-party modules', 'module marketplace', 'developer certifications'],
  },
  {
    id: 'self-evolving-codebase',
    category: 'proprietary',
    name: 'Self-Evolving Codebase',
    description: 'Code that autonomously improves, repairs, and expands itself — unique in market',
    defensibilityScore: 94,
    maturity: 'active',
    strengtheningActions: ['mutation sandbox live demo', 'publish evolution stats', 'academic paper'],
  },
  // Data Moats
  {
    id: 'business-intelligence-dataset',
    category: 'data',
    name: 'Proprietary Business Intelligence Dataset',
    description: 'Multi-tenant behavioral data across industries — trains more accurate AI models',
    defensibilityScore: 75,
    maturity: 'growing',
    strengtheningActions: ['implement data consent flows', 'launch anonymized benchmark reports', 'train private models on this data'],
  },
  {
    id: 'pricing-intelligence',
    category: 'data',
    name: 'Dynamic Pricing Intelligence',
    description: 'Real-time pricing data from 10+ competitor sources, market patterns, conversion history',
    defensibilityScore: 78,
    maturity: 'active',
    strengtheningActions: ['expand competitor monitoring', 'publish pricing insights newsletter', 'train pricing recommendation AI'],
  },
  // Intelligence Loops
  {
    id: 'success-failure-memory',
    category: 'intelligence',
    name: 'AI Success/Failure Memory Loop',
    description: 'System learns from every task outcome — compounds intelligence over time',
    defensibilityScore: 85,
    maturity: 'active',
    strengtheningActions: ['vector memory expansion', 'cross-tenant learning (anonymized)', 'publish improvement velocity metrics'],
  },
  {
    id: 'competitor-signal-loop',
    category: 'intelligence',
    name: 'Competitor Signal Intelligence Loop',
    description: 'Automated competitor monitoring feeds product decisions and pricing adjustments',
    defensibilityScore: 65,
    maturity: 'growing',
    strengtheningActions: ['add G2/Trustpilot scraping', 'sentiment scoring', 'automatic pricing response'],
  },
  // Retention Moats
  {
    id: 'high-switching-cost',
    category: 'retention',
    name: 'High Switching Cost',
    description: 'Deep workflow integrations, custom training, stored memory — hard to migrate away',
    defensibilityScore: 80,
    maturity: 'active',
    strengtheningActions: ['launch data portability (paradox: increases trust)', 'migration guarantees', 'yearly contracts'],
  },
  {
    id: 'network-effects',
    category: 'retention',
    name: 'Marketplace Network Effects',
    description: 'More sellers/buyers increases value for all — classic two-sided network effect',
    defensibilityScore: 55,
    maturity: 'building',
    strengtheningActions: ['referral program', 'seller incentives', 'buyer volume discounts', 'community building'],
  },
  // Infrastructure Moats
  {
    id: 'performance-leadership',
    category: 'infrastructure',
    name: 'Sub-100ms API Performance',
    description: 'Edge-deployed, optimized responses that competitors struggle to match at scale',
    defensibilityScore: 70,
    maturity: 'active',
    strengtheningActions: ['publish latency benchmarks', 'SLA guarantees', 'CDN expansion'],
  },
  {
    id: 'multi-cloud-resilience',
    category: 'infrastructure',
    name: 'Multi-Cloud Autonomous Resilience',
    description: 'Auto-failover across providers — 99.99% uptime target without manual intervention',
    defensibilityScore: 72,
    maturity: 'active',
    strengtheningActions: ['publish uptime history', 'SOC2 certification', 'disaster recovery SLA'],
  },
  // Ecosystem Moats
  {
    id: 'integration-breadth',
    category: 'ecosystem',
    name: 'Integration Breadth (200+ connectors)',
    description: 'Deepest integration catalog in the AI-SaaS space — every workflow connects here',
    defensibilityScore: 68,
    maturity: 'growing',
    strengtheningActions: ['launch integration marketplace', 'integration partner program', 'no-code connector builder'],
  },
  // Brand & Trust
  {
    id: 'compliance-certifications',
    category: 'brand',
    name: 'Compliance & Certifications',
    description: 'GDPR, SOC2, ISO27001 — enterprise sales gate openers',
    defensibilityScore: 60,
    maturity: 'building',
    strengtheningActions: ['start SOC2 Type II', 'GDPR DPA templates', 'security whitepaper', 'bug bounty program'],
  },
];

// ── §2  MOAT SCORING ENGINE ───────────────────────────────────────────────

/**
 * getMoatScore — overall platform defensibility score (0-100)
 * Scor global de apărabilitate a platformei
 */
function getMoatScore() {
  const scores = MOAT_CATALOG.map(m => m.defensibilityScore);
  const avg    = scores.reduce((s, v) => s + v, 0) / scores.length;
  const weights = { proprietary: 0.30, data: 0.20, intelligence: 0.20, retention: 0.15, infrastructure: 0.08, ecosystem: 0.05, brand: 0.02 };

  let weightedScore = 0;
  let totalWeight   = 0;
  const byCategory  = {};

  for (const m of MOAT_CATALOG) {
    const w = weights[m.category] || 0.05;
    weightedScore += m.defensibilityScore * w;
    totalWeight   += w;
    if (!byCategory[m.category]) byCategory[m.category] = { scores: [], category: m.category };
    byCategory[m.category].scores.push(m.defensibilityScore);
  }

  const finalScore = totalWeight > 0 ? weightedScore / totalWeight : avg;

  return {
    overallScore:   +finalScore.toFixed(1),
    avgScore:       +avg.toFixed(1),
    grade:          finalScore >= 85 ? 'A' : finalScore >= 70 ? 'B' : finalScore >= 55 ? 'C' : 'D',
    assessment:     finalScore >= 85 ? 'Strong moat — high defensibility' : finalScore >= 70 ? 'Good moat — competitors face meaningful barriers' : finalScore >= 55 ? 'Moderate moat — needs strengthening' : 'Weak moat — vulnerable to competition',
    categoryScores: Object.entries(byCategory).map(([cat, d]) => ({
      category: cat,
      avgScore: +(d.scores.reduce((s, v) => s + v, 0) / d.scores.length).toFixed(1),
      moats:    d.scores.length,
    })).sort((a, b) => b.avgScore - a.avgScore),
  };
}

/**
 * getMoatsByPriority — ranked list of moats to strengthen first
 */
function getMoatsByPriority() {
  return MOAT_CATALOG
    .map(m => ({
      ...m,
      improvementPotential: 100 - m.defensibilityScore,
    }))
    .sort((a, b) => {
      // Priority: building > growing > active (focus on early-stage moats)
      const maturityWeight = { building: 3, growing: 2, active: 1 };
      const mw = (maturityWeight[a.maturity] || 1) - (maturityWeight[b.maturity] || 1);
      if (mw !== 0) return mw;
      return b.improvementPotential - a.improvementPotential;
    });
}

/**
 * getStrengtheningRoadmap — quarterly roadmap for moat building
 */
function getStrengtheningRoadmap() {
  const byCategory = {};
  for (const m of MOAT_CATALOG) {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  }

  return {
    q1: {
      focus:    'Data & Intelligence Moats',
      actions:  [
        ...MOAT_CATALOG.filter(m => m.category === 'data' || m.category === 'intelligence')
          .flatMap(m => m.strengtheningActions.slice(0, 1).map(a => ({ moat: m.name, action: a }))),
      ],
    },
    q2: {
      focus:    'Retention & Ecosystem',
      actions:  [
        ...MOAT_CATALOG.filter(m => m.category === 'retention' || m.category === 'ecosystem')
          .flatMap(m => m.strengtheningActions.slice(0, 1).map(a => ({ moat: m.name, action: a }))),
      ],
    },
    q3: {
      focus:    'Brand & Compliance',
      actions:  [
        ...MOAT_CATALOG.filter(m => m.category === 'brand')
          .flatMap(m => m.strengtheningActions.map(a => ({ moat: m.name, action: a }))),
      ],
    },
    q4: {
      focus:    'Infrastructure & Scale',
      actions:  [
        ...MOAT_CATALOG.filter(m => m.category === 'infrastructure')
          .flatMap(m => m.strengtheningActions.slice(0, 2).map(a => ({ moat: m.name, action: a }))),
      ],
    },
  };
}

// ── §3  REST ROUTER ────────────────────────────────────────────────────────

function router() {
  const r = express.Router();

  r.get('/score',    (_req, res) => res.json({ ok: true, ...getMoatScore() }));
  r.get('/catalog',  (_req, res) => res.json({ ok: true, moats: MOAT_CATALOG }));
  r.get('/priority', (_req, res) => res.json({ ok: true, moats: getMoatsByPriority() }));
  r.get('/roadmap',  (_req, res) => res.json({ ok: true, roadmap: getStrengtheningRoadmap() }));

  r.get('/category/:cat', (req, res) => {
    const moats = MOAT_CATALOG.filter(m => m.category === req.params.cat);
    if (!moats.length) return res.status(404).json({ ok: false, error: 'Category not found' });
    res.json({ ok: true, category: req.params.cat, moats });
  });

  return r;
}

function getStatus() {
  const score = getMoatScore();
  return {
    name:   'moat-engine',
    label:  'Competitive Moat Engine',
    health: 'good',
    ...score,
    totalMoats: MOAT_CATALOG.length,
  };
}

module.exports = {
  getMoatScore,
  getMoatsByPriority,
  getStrengtheningRoadmap,
  MOAT_CATALOG,
  getStatus,
  router,
};

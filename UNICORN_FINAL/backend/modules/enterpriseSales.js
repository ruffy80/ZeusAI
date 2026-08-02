'use strict';

/**
 * Enterprise Sales & CRM — B2B attraction → proposal → close.
 * Integrates aiNegotiator + legalFortress when available; never invents paid ACV.
 */

const crypto = require('crypto');

const BTC_ADDRESS =
  process.env.BTC_WALLET_ADDRESS ||
  process.env.OWNER_BTC_ADDRESS ||
  'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';

/** @type {Map<string, object>} */
const LEADS = new Map();
/** @type {Map<string, object>} */
const DEALS = new Map();

function _neg() {
  try { return require('./aiNegotiator'); } catch (_) { return null; }
}
function _legal() {
  try { return require('./legalFortress'); } catch (_) { return null; }
}
function _aedo() {
  try { return require('../../src/commerce/autonomous-enterprise-deal-orchestrator'); } catch (_) {
    try { return require('../../src/commerce/autonomous-enterprise-closure-os'); } catch (__) { return null; }
  }
}

function ingestLead({ company, email, acvUsd = 100000, segment = 'enterprise', notes = '' } = {}) {
  if (!company || !email) throw new Error('company_and_email_required');
  const id = 'lead_' + crypto.randomBytes(5).toString('hex');
  const lead = {
    id,
    company: String(company).slice(0, 120),
    email: String(email).slice(0, 160),
    acvUsd: Math.max(1000, Number(acvUsd) || 100000),
    segment,
    notes: String(notes || '').slice(0, 500),
    status: 'new',
    createdAt: new Date().toISOString(),
  };
  LEADS.set(id, lead);
  return lead;
}

async function createOffer(leadId, { discountPct = 0 } = {}) {
  const lead = LEADS.get(leadId);
  if (!lead) throw new Error('lead_not_found');
  const neg = _neg();
  let negotiation = null;
  if (neg && typeof neg.confirmAutonomous === 'function') {
    try {
      negotiation = await neg.confirmAutonomous({
        dealId: lead.id,
        acvUsd: lead.acvUsd,
        party: lead.company,
      });
    } catch (_) {
      negotiation = { mode: 'fallback', note: 'aiNegotiator unavailable path' };
    }
  } else if (neg && typeof neg.negotiate === 'function') {
    try {
      negotiation = await neg.negotiate({ amount: lead.acvUsd, counterparty: lead.company });
    } catch (_) {
      negotiation = { mode: 'quote_only' };
    }
  }

  const legal = _legal();
  let contract = null;
  if (legal && typeof legal.generateContract === 'function') {
    try {
      contract = await legal.generateContract({
        party: lead.company,
        valueUsd: lead.acvUsd,
        type: 'msa_sow',
      });
    } catch (_) {
      contract = { draft: true, type: 'msa_sow' };
    }
  } else {
    contract = {
      draft: true,
      type: 'msa_sow',
      title: `ZeusAI Enterprise MSA/SOW — ${lead.company}`,
      acvUsd: lead.acvUsd,
      settlementBtc: BTC_ADDRESS,
    };
  }

  const dealId = 'deal_' + crypto.randomBytes(5).toString('hex');
  const kickoffPct = lead.acvUsd >= 50000 ? 0.08 : 0.1;
  const kickoffUsd = Math.min(25000, Math.max(1000, Math.round(lead.acvUsd * kickoffPct)));
  const discounted = Math.round(lead.acvUsd * (1 - Math.min(0.3, Number(discountPct) || 0)));

  const deal = {
    id: dealId,
    leadId: lead.id,
    company: lead.company,
    email: lead.email,
    acvUsd: discounted,
    kickoffUsd,
    status: 'proposal',
    negotiation,
    contract,
    btcAddress: BTC_ADDRESS,
    createdAt: new Date().toISOString(),
  };
  DEALS.set(dealId, deal);
  lead.status = 'proposal';
  LEADS.set(lead.id, lead);

  // Prefer AEDO when present for autonomous close rail.
  const aedo = _aedo();
  if (aedo && typeof aedo.orchestrate === 'function') {
    try {
      deal.aedo = await aedo.orchestrate({
        company: lead.company,
        email: lead.email,
        acvUsd: discounted,
      });
    } catch (_) { /* optional */ }
  }

  return deal;
}

function listDeals({ limit = 50 } = {}) {
  return Array.from(DEALS.values()).slice(-limit).reverse();
}

function listLeads({ limit = 50 } = {}) {
  return Array.from(LEADS.values()).slice(-limit).reverse();
}

function getStatus() {
  const deals = Array.from(DEALS.values());
  const pipeline = deals.reduce((a, d) => a + Number(d.acvUsd || 0), 0);
  return {
    protocol: 'ENTERPRISE_SALES/1.0',
    active: true,
    leads: LEADS.size,
    deals: DEALS.size,
    pipelineAcvUsd: pipeline,
    btcAddress: BTC_ADDRESS,
    integrations: {
      aiNegotiator: !!_neg(),
      legalFortress: !!_legal(),
      aedo: !!_aedo(),
    },
  };
}

function start() {
  return getStatus();
}

function getRouter(secretMiddleware) {
  const express = require('express');
  const router = express.Router();
  const gate = typeof secretMiddleware === 'function' ? secretMiddleware : ((req, res, next) => next());

  router.get('/status', (req, res) => res.json(getStatus()));
  router.get('/leads', gate, (req, res) => res.json({ leads: listLeads() }));
  router.get('/deals', gate, (req, res) => res.json({ deals: listDeals() }));
  router.post('/leads', async (req, res) => {
    try { res.status(201).json(ingestLead(req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  router.post('/offers', gate, async (req, res) => {
    try { res.status(201).json(await createOffer(req.body.leadId, req.body || {})); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  return router;
}

module.exports = {
  BTC_ADDRESS,
  ingestLead,
  createOffer,
  listDeals,
  listLeads,
  getStatus,
  start,
  init: start,
  getRouter,
};

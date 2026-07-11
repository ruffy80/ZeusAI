// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-07-10T14:57:37.345Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

class DecisionCore {
  constructor(opts = {}) {
    this.model = process.env.SOCIAL_DECISION_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.maxActions = Number(process.env.SOCIAL_DECISION_MAX_ACTIONS || 3);
    this.minConfidence = Number(process.env.SOCIAL_DECISION_MIN_CONFIDENCE || 0.55);
    this.fallbackRegion = process.env.SOCIAL_DEFAULT_REGION || 'global';
    this.lastDecision = null;
    this.totalDecisions = 0;
  }

  heuristicDecision(metrics = {}, health = {}) {
    const actions = [];
    const growth = Number(metrics.userGrowthPct24h || 0);
    const conv = Number(metrics.conversionPct || 0);
    const cpu = Number(health.cpuLoadPct || 0);
    const mem = Number(health.memoryUsedPct || 0);

    if (growth < 1) actions.push({ type: 'marketing_boost', priority: 'high', params: { region: this.fallbackRegion, budgetDeltaPct: 15 } });
    if (conv < 2.5) actions.push({ type: 'creator_discount_campaign', priority: 'high', params: { discountPct: 12, durationHours: 24 } });
    if (cpu > 75 || mem > 75) actions.push({ type: 'autoscale_up', priority: 'high', params: { target: 'social-network', replicas: 2 } });
    if (!actions.length) actions.push({ type: 'steady_optimize', priority: 'normal', params: { note: 'continue current strategy' } });

    return {
      strategy: 'heuristic-fallback',
      confidence: 0.62,
      actions: actions.slice(0, this.maxActions),
      rationale: 'LLM unavailable or low-confidence response; using resilient growth heuristics.',
    };
  }

  async llmDecision(ctx = {}) {
    const llm = ctx.llm;
    if (typeof llm !== 'function') return null;
    const payload = {
      task: 'social-network-autonomous-decision',
      constraints: {
        maxActions: this.maxActions,
        minConfidence: this.minConfidence,
        policy: 'maximize long-term profit and stability, avoid risky irreversible actions',
      },
      metrics: ctx.metrics || {},
      health: ctx.health || {},
      economy: ctx.economy || {},
    };
    const text = [
      'Return STRICT JSON with keys: strategy, confidence, rationale, actions[].',
      'Each action must include: type, priority, params.',
      'No markdown. No prose outside JSON.',
      JSON.stringify(payload),
    ].join('\n');

    try {
      const out = await llm(text, { model: this.model, temperature: 0.15 });
      if (!out || typeof out !== 'object') return null;
      const confidence = Number(out.confidence || 0);
      if (confidence < this.minConfidence) return null;
      const actions = Array.isArray(out.actions) ? out.actions.slice(0, this.maxActions) : [];
      if (!actions.length) return null;
      return {
        strategy: String(out.strategy || 'llm-optimized'),
        confidence,
        rationale: String(out.rationale || 'LLM strategic analysis'),
        actions,
      };
    } catch (_) {
      return null;
    }
  }

  async runOnce(ctx = {}) {
    const llmPlan = await this.llmDecision(ctx);
    const plan = llmPlan || this.heuristicDecision(ctx.metrics, ctx.health);

    const execution = [];
    if (!ctx.dryRun && Array.isArray(plan.actions) && typeof ctx.executeAction === 'function') {
      for (const a of plan.actions) {
        execution.push(await ctx.executeAction(a));
      }
    }

    const out = {
      ok: true,
      dryRun: !!ctx.dryRun,
      ts: new Date().toISOString(),
      decision: plan,
      execution,
    };
    this.lastDecision = out;
    this.totalDecisions += 1;
    return out;
  }

  getStatus() {
    return {
      ok: true,
      model: this.model,
      totalDecisions: this.totalDecisions,
      lastDecisionAt: this.lastDecision ? this.lastDecision.ts : null,
      lastDecision: this.lastDecision,
    };
  }
}

module.exports = DecisionCore;

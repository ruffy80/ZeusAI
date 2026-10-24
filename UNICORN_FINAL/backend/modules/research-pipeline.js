'use strict';

/**
 * Glue: Research agent → model router → JSON schema → SQLite memory.
 * Every step logs the same correlation id.
 *
 * start() only arms a 24h timer when RESEARCH_PIPELINE_SCHEDULE=1.
 * The harmonic tick calls noteTick(), which also no-ops unless that env is set
 * and 24 hours have passed. Importing this module does not fetch or write.
 */

const crypto = require('crypto');
const researchAgent = require('./research-agent');
const router = require('./multi-model-router');
const memory = require('./pipeline-memory');

const DAY_MS = 24 * 60 * 60 * 1000;
const SUMMARY_SCHEMA = {
  title: { type: 'string', minLength: 3 },
  description: { type: 'string', minLength: 8 },
  sourceUrl: { type: 'string', pattern: '^https://\\S+$' },
};

let timer = null;
let lastRunAt = 0;
let lastCorrelationId = null;

function logStep(correlationId, step, extra) {
  const line = {
    ts: new Date().toISOString(),
    correlationId,
    step,
  };
  if (extra && typeof extra === 'object') Object.assign(line, extra);
  console.log(JSON.stringify(line));
}

function validateSummary(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['object'], value };
  }
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const description = typeof value.description === 'string' ? value.description.trim() : '';
  const sourceUrl = typeof value.sourceUrl === 'string' ? value.sourceUrl.trim() : '';
  if (title.length < SUMMARY_SCHEMA.title.minLength) errors.push('title');
  if (description.length < SUMMARY_SCHEMA.description.minLength) errors.push('description');
  if (!/^https:\/\/\S+$/.test(sourceUrl)) errors.push('sourceUrl');
  return {
    ok: errors.length === 0,
    errors,
    value: { title, description, sourceUrl },
  };
}

function parseModelJson(text) {
  if (!text || typeof text !== 'string') return null;
  const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text.trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function allowedSource(url, research) {
  if (!url || !research) return false;
  if (url === research.sourceUrl || url === research.queryUrl) return true;
  return false;
}

function localSummary(research, choice, meta) {
  return {
    title: research.title,
    description: research.description,
    sourceUrl: research.sourceUrl,
    provider: choice ? choice.provider : null,
    model: choice ? choice.model : null,
    providerInvoked: false,
    summarizer: 'local-extract',
    ...meta,
  };
}

async function summarize(research, choice, correlationId) {
  if (!choice || !choice.configured) {
    logStep(correlationId, 'router.invoke', {
      provider: choice && choice.provider,
      model: choice && choice.model,
      invoked: false,
      reason: 'no configured provider key; summary is the research record',
    });
    return localSummary(research, choice, {});
  }

  const prompt = [
    'Summarize the research JSON as one JSON object with keys title, description, sourceUrl.',
    'Use only facts in the research. Do not invent a model name or a URL.',
    'sourceUrl must be copied from the research sourceUrl.',
    JSON.stringify({
      found: research.found,
      title: research.title,
      description: research.description,
      sourceUrl: research.sourceUrl,
    }),
  ].join('\n');

  logStep(correlationId, 'router.invoke', {
    provider: choice.provider,
    model: choice.model,
    invoked: true,
  });
  const reply = await router.ask(prompt, {
    taskType: 'simple',
    useCache: false,
    maxTokens: 400,
    systemPrompt: 'Return only a JSON object with title, description, and sourceUrl. Do not invent facts.',
  });
  const parsed = parseModelJson(reply && reply.reply);
  const check = validateSummary(parsed);
  if (reply && check.ok && allowedSource(check.value.sourceUrl, research)) {
    return {
      ...check.value,
      provider: reply.provider || choice.provider,
      model: reply.model || choice.model,
      providerInvoked: true,
      summarizer: 'model',
    };
  }
  logStep(correlationId, 'validate.fallback', {
    reason: 'model reply missing, off-schema, or sourceUrl was not the research URL',
  });
  return localSummary(research, {
    provider: (reply && reply.provider) || choice.provider,
    model: (reply && reply.model) || choice.model,
  }, { providerInvoked: true, summarizer: 'local-extract' });
}

async function run(opts = {}) {
  const correlationId = opts.correlationId || crypto.randomUUID();
  lastCorrelationId = correlationId;
  const task = opts.task || researchAgent.TASK;
  logStep(correlationId, 'pipeline.start', { task, profile: process.env.UNICORN_RUNTIME_PROFILE || null });

  logStep(correlationId, 'research.start', { task });
  const found = await researchAgent.research(task, { fetch: opts.fetch, correlationId });
  logStep(correlationId, 'research.done', {
    found: found.found,
    title: found.title,
    sourceUrl: found.sourceUrl,
    checked: found.checked,
  });

  const choice = router.chooseProvider('simple');
  if (!choice) throw new Error('model router returned no provider');
  logStep(correlationId, 'router.choice', {
    provider: choice.provider,
    model: choice.model,
    configured: choice.configured,
    costPer1KTokens: choice.costPer1KTokens,
    speedScore: choice.speedScore,
    reason: choice.reason,
  });

  const summary = await summarize(found, choice, correlationId);
  const check = validateSummary(summary);
  logStep(correlationId, 'validate', { ok: check.ok, errors: check.errors });
  if (!check.ok) {
    throw new Error(`summary failed schema: ${check.errors.join(',')}`);
  }

  const createdAt = new Date().toISOString();
  const payload = {
    correlationId,
    title: check.value.title,
    description: check.value.description,
    sourceUrl: check.value.sourceUrl,
    provider: summary.provider,
    model: summary.model,
    providerInvoked: summary.providerInvoked === true,
    summarizer: summary.summarizer,
    research: {
      found: found.found,
      checked: found.checked,
      usable: found.usable,
      queryUrl: found.queryUrl,
      createdAt: found.createdAt || null,
    },
  };
  const row = memory.write({
    correlationId,
    title: check.value.title,
    description: check.value.description,
    sourceUrl: check.value.sourceUrl,
    provider: summary.provider,
    model: summary.model,
    createdAt,
    payload,
  }, opts.dbPath);
  logStep(correlationId, 'memory.write', {
    id: row.id,
    sourceUrl: row.sourceUrl,
    provider: row.provider,
    model: row.model,
  });
  logStep(correlationId, 'pipeline.done', { id: row.id });
  return { correlationId, research: found, choice, summary: check.value, row };
}

function start() {
  if (String(process.env.RESEARCH_PIPELINE_SCHEDULE || '') !== '1') {
    return { ok: true, scheduled: false, reason: 'schedule_off' };
  }
  if (timer) return { ok: true, scheduled: true, reason: 'already' };
  timer = setInterval(() => {
    noteTick().catch((err) => {
      console.error(JSON.stringify({
        ts: new Date().toISOString(),
        step: 'schedule.error',
        error: err.message,
      }));
    });
  }, DAY_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return { ok: true, scheduled: true, everyMs: DAY_MS };
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  return { ok: true, scheduled: false };
}

async function noteTick(now = Date.now()) {
  if (String(process.env.RESEARCH_PIPELINE_SCHEDULE || '') !== '1') {
    return { ran: false, reason: 'schedule_off' };
  }
  if (now - lastRunAt < DAY_MS) return { ran: false, reason: 'within_24h' };
  lastRunAt = now;
  try {
    const result = await run();
    return { ran: true, correlationId: result.correlationId, id: result.row.id };
  } catch (err) {
    logStep(lastCorrelationId || 'schedule', 'schedule.error', { error: err.message });
    return { ran: false, reason: err.message };
  }
}

function getStatus() {
  return {
    id: 'research-pipeline/1.0',
    health: 'ok',
    running: false,
    active: false,
    started: false,
    scheduled: timer != null,
    scheduleEnv: String(process.env.RESEARCH_PIPELINE_SCHEDULE || '') === '1',
    everyMs: DAY_MS,
    lastCorrelationId,
    lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
  };
}

module.exports = {
  run,
  start,
  stop,
  noteTick,
  getStatus,
  validateSummary,
  SUMMARY_SCHEMA,
  DAY_MS,
  logStep,
};

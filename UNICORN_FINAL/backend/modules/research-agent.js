'use strict';

/**
 * Research step for the research → router → memory pipeline.
 * Reads the public Hugging Face models API (no key). createdAt is the
 * release time. lastModified is an update and is not treated as a release.
 * If the newest page has nothing inside 7 days, the result says so.
 */

const HF_MODELS_URL = 'https://huggingface.co/api/models?sort=createdAt&direction=-1&limit=20';
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const TASK = 'Find the latest AI model released in the last 7 days';

function safeModelId(id) {
  const s = String(id || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(s)) return null;
  return s;
}

function cardUrl(id) {
  return `https://huggingface.co/${id}`;
}

function asCards(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.models)) return payload.models;
  return null;
}

async function research(task = TASK, opts = {}) {
  const fetcher = opts.fetch || globalThis.fetch;
  if (typeof fetcher !== 'function') {
    throw new Error('research fetch is unavailable');
  }
  const url = opts.url || HF_MODELS_URL;
  let response;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetcher(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'ZeusAI-research-pipeline/1.0',
        },
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout
          ? AbortSignal.timeout(20000)
          : undefined,
      });
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!response) {
    throw new Error(`research fetch failed: ${lastErr ? lastErr.message : 'no response'}`);
  }
  if (!response.ok) {
    throw new Error(`research source HTTP ${response.status}`);
  }
  const payload = await response.json();
  const cards = asCards(payload);
  if (!cards) throw new Error('research source did not return a model list');

  const now = Date.now();
  const usable = [];
  for (const card of cards) {
    const id = safeModelId(card && card.id);
    const createdMs = Date.parse(card && card.createdAt);
    if (!id || !Number.isFinite(createdMs)) continue;
    if (card.private === true || card.disabled === true) continue;
    usable.push({
      id,
      createdAt: new Date(createdMs).toISOString(),
      createdMs,
      downloads: Number.isFinite(card.downloads) ? card.downloads : null,
      pipeline: card.pipeline_tag ? String(card.pipeline_tag) : null,
    });
  }
  usable.sort((a, b) => b.createdMs - a.createdMs || a.id.localeCompare(b.id));

  const recent = usable.filter((card) => now - card.createdMs <= WINDOW_MS && card.createdMs <= now);
  const newest = usable[0] || null;

  if (!recent.length) {
    const newestText = newest
      ? `${newest.createdAt} (${newest.id})`
      : 'none of the returned cards had a parseable createdAt';
    return {
      task: String(task || TASK),
      found: false,
      title: 'No AI model release in the last 7 days',
      description: `Hugging Face models API (sort=createdAt desc, limit=20) returned ${cards.length} cards and ${usable.length} with a public id and createdAt. None have createdAt inside the last 7 days. Newest createdAt in that page is ${newestText}.`,
      sourceUrl: url,
      checked: cards.length,
      usable: usable.length,
      newestCreatedAt: newest ? newest.createdAt : null,
      newestId: newest ? newest.id : null,
      queryUrl: url,
    };
  }

  const top = recent[0];
  const pipeline = top.pipeline || 'unspecified';
  const downloads = top.downloads == null ? 'n/a' : String(top.downloads);
  return {
    task: String(task || TASK),
    found: true,
    title: top.id,
    description: `Newest public model card in the Hugging Face models API (sort=createdAt desc, limit=20) with createdAt inside the last 7 days: ${top.id}, createdAt ${top.createdAt}, pipeline ${pipeline}, downloads ${downloads}.`,
    sourceUrl: cardUrl(top.id),
    createdAt: top.createdAt,
    downloads: top.downloads,
    pipeline: top.pipeline,
    checked: cards.length,
    usable: usable.length,
    inWindow: recent.length,
    queryUrl: url,
  };
}

function getStatus() {
  return {
    id: 'research-agent/1.0',
    health: 'ok',
    source: HF_MODELS_URL,
    windowDays: 7,
    running: false,
    active: false,
    started: false,
  };
}

module.exports = {
  research,
  getStatus,
  HF_MODELS_URL,
  WINDOW_MS,
  TASK,
  safeModelId,
  cardUrl,
};

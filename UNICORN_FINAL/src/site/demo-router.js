'use strict';

/**
 * Demo-only model router. No provider is called and the prompt is not stored.
 * The example sentence returns the published sample figures. Other lengths
 * pick Groq, DeepSeek, or Claude and a consistent GPT-4 comparison.
 */

const EXAMPLE_PROMPT = 'Write a Python script to scrape a website';

const SAMPLE = Object.freeze({
  ok: true,
  simulated: true,
  stored: false,
  providerCalled: false,
  analyzed: 'Prompt analyzed.',
  routedTo: 'Groq (Llama 3 70B)',
  latencyMs: 340,
  costUsd: 0.0001,
  gpt4CostUsd: 0.0035,
  savingsPct: 97,
});

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

function optimizePrompt(prompt) {
  const text = String(prompt == null ? '' : prompt).trim();
  if (!text) return { ok: false, error: 'prompt_required' };
  if (text.length > 4000) return { ok: false, error: 'prompt_too_long' };
  if (text === EXAMPLE_PROMPT) return Object.assign({}, SAMPLE);

  const n = text.length;
  let routedTo;
  let latencyMs;
  let costUsd;
  let gpt4CostUsd;
  if (n < 280) {
    routedTo = 'Groq (Llama 3 70B)';
    latencyMs = 280 + (n % 90);
    costUsd = round4(0.00008 + n * 0.0000004);
    gpt4CostUsd = round4(0.002 + n * 0.000012);
  } else if (n < 900) {
    routedTo = 'DeepSeek (V3)';
    latencyMs = 460 + (n % 140);
    costUsd = round4(0.0003 + n * 0.0000005);
    gpt4CostUsd = round4(0.006 + n * 0.000015);
  } else {
    routedTo = 'Claude (Haiku)';
    latencyMs = 720 + (n % 180);
    costUsd = round4(0.0008 + n * 0.0000008);
    gpt4CostUsd = round4(0.012 + n * 0.00002);
  }
  if (!(gpt4CostUsd > costUsd)) gpt4CostUsd = round4(costUsd * 8);
  const savingsPct = Math.max(1, Math.min(99, Math.round((1 - costUsd / gpt4CostUsd) * 100)));
  return {
    ok: true,
    simulated: true,
    stored: false,
    providerCalled: false,
    analyzed: 'Prompt analyzed.',
    routedTo,
    latencyMs,
    costUsd,
    gpt4CostUsd,
    savingsPct,
  };
}

module.exports = {
  EXAMPLE_PROMPT,
  SAMPLE,
  optimizePrompt,
};

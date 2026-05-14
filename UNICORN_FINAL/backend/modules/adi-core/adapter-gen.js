// ADI-Core Adapter Generator — REAL OpenAI-compatible adapter
async function callOpenAICompat(model, prompt, opts = {}) {
  const key = process.env[model.envVar] || '';
  if (!key) return { ok: false, reason: 'no-api-key', model: model.id };
  const base = (model.url || '').replace(/\/models.*$/, '');
  const url  = `${base}/chat/completions`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 15000);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: opts.modelName || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: String(prompt || '').slice(0, 8000) }],
        max_tokens: opts.maxTokens || 256,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, status: r.status, model: model.id };
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || '';
    return { ok: true, model: model.id, text, usage: j?.usage || null };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e), model: model.id };
  }
}

function generateAdapter(model) {
  if (model.type === 'remote-api') return async (p, o) => callOpenAICompat(model, p, o);
  return async (p) => ({ ok: true, model: model.id, text: `[local-module:${model.id}] received: ${String(p).slice(0, 200)}`, local: true });
}

module.exports = { generateAdapter, callOpenAICompat };

'use strict';

/**
 * NeuralInterfaceAPI — command interface for this process.
 * Text becomes a memory, ranking, or checksum call. No implant is attached.
 */

function interpret(text) {
  const raw = String(text == null ? '' : text).trim();
  const lower = raw.toLowerCase();
  if (!raw) return { ok: false, reason: 'empty', claimsNeuralImplant: false };
  if (lower.startsWith('remember ')) {
    const rest = raw.slice(9).trim();
    const cut = rest.indexOf(' ');
    if (cut <= 0) return { ok: false, reason: 'missing_value', claimsNeuralImplant: false };
    return { ok: true, intent: 'remember', key: rest.slice(0, cut), value: rest.slice(cut + 1), claimsNeuralImplant: false };
  }
  if (lower.startsWith('recall ')) {
    return { ok: true, intent: 'recall', key: raw.slice(7).trim(), claimsNeuralImplant: false };
  }
  if (lower.startsWith('forget ')) {
    return { ok: true, intent: 'forget', key: raw.slice(7).trim(), claimsNeuralImplant: false };
  }
  if (lower.startsWith('rank ')) {
    return {
      ok: true,
      intent: 'rank',
      options: raw.slice(5).split('|').map((part) => part.trim()).filter(Boolean),
      claimsNeuralImplant: false,
    };
  }
  if (lower.startsWith('checksum ')) {
    return { ok: true, intent: 'checksum', payload: raw.slice(9), claimsNeuralImplant: false };
  }
  return { ok: true, intent: 'hear', heard: raw.slice(0, 200), claimsNeuralImplant: false };
}

function dispatch(text) {
  const intent = interpret(text);
  if (!intent.ok || intent.intent === 'hear') return intent;
  if (intent.intent === 'remember' || intent.intent === 'recall' || intent.intent === 'forget') {
    const memory = require('./usi-memory');
    const result = intent.intent === 'remember'
      ? memory.remember(intent.key, intent.value)
      : memory[intent.intent](intent.key);
    return { ok: result.ok !== false, intent: intent.intent, result, claimsNeuralImplant: false };
  }
  if (intent.intent === 'rank') {
    const reasoning = require('./usi-reasoning');
    return { ok: true, intent: 'rank', result: reasoning.rank(intent.options), claimsNeuralImplant: false };
  }
  const skills = require('./usi-skills');
  return { ok: true, intent: 'checksum', result: skills.invoke('checksum', intent.payload), claimsNeuralImplant: false };
}

function getStatus() {
  return {
    ok: true,
    name: 'NeuralInterfaceAPI',
    commands: ['remember', 'recall', 'forget', 'rank', 'checksum'],
    claimsNeuralImplant: false,
  };
}

module.exports = {
  interpret,
  dispatch,
  process: (body) => dispatch(body && body.text != null ? body.text : body),
  getStatus,
  name: 'NeuralInterfaceAPI',
};

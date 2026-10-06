'use strict';

/**
 * QuantumMachineLearningCore — 2-qubit statevector plus a perceptron.
 * Gates H, X, and CNOT run as linear algebra in this process.
 * No quantum processor is attached.
 */

const SQRT2 = Math.SQRT1_2;
const model = { bias: 0, weights: [0, 0], samples: 0 };

function blank() {
  return [1, 0, 0, 0];
}

function _pairs(qubit) {
  return qubit === 1 ? [[0, 2], [1, 3]] : [[0, 1], [2, 3]];
}

function h(state, qubit) {
  for (const [i0, i1] of _pairs(qubit === 1 ? 1 : 0)) {
    const a = state[i0];
    const b = state[i1];
    state[i0] = (a + b) * SQRT2;
    state[i1] = (a - b) * SQRT2;
  }
  return state;
}

function x(state, qubit) {
  for (const [i0, i1] of _pairs(qubit === 1 ? 1 : 0)) {
    const a = state[i0];
    state[i0] = state[i1];
    state[i1] = a;
  }
  return state;
}

function cnot(state, control, target) {
  const c = control === 1 ? 1 : 0;
  const t = target === 1 ? 1 : 0;
  if (c === t) return state;
  const next = state.slice();
  for (let i = 0; i < 4; i += 1) {
    if (((i >> c) & 1) === 0) continue;
    const j = i ^ (1 << t);
    if (i < j) {
      next[i] = state[j];
      next[j] = state[i];
    }
  }
  for (let k = 0; k < 4; k += 1) state[k] = next[k];
  return state;
}

function probabilities(state) {
  return state.map((amp) => Math.round(amp * amp * 1e9) / 1e9);
}

function run(program) {
  const state = blank();
  const steps = Array.isArray(program) ? program.slice(0, 32) : [];
  for (const step of steps) {
    const gate = String(step && step.gate || '').toUpperCase();
    if (gate === 'H') h(state, step.qubit);
    else if (gate === 'X') x(state, step.qubit);
    else if (gate === 'CNOT') cnot(state, step.control, step.target);
  }
  return { ok: true, probabilities: probabilities(state), claimsQuantumHardware: false };
}

function bell() {
  return run([{ gate: 'H', qubit: 0 }, { gate: 'CNOT', control: 0, target: 1 }]);
}

function _score(features) {
  const x0 = Number(features && features[0]) || 0;
  const x1 = Number(features && features[1]) || 0;
  return model.bias + (model.weights[0] * x0) + (model.weights[1] * x1);
}

function train(samples) {
  const rows = Array.isArray(samples) ? samples : [];
  for (let epoch = 0; epoch < 40; epoch += 1) {
    for (const row of rows) {
      const features = row && Array.isArray(row.features) ? row.features : [];
      const label = row && row.label ? 1 : 0;
      const pred = _score(features) >= 0 ? 1 : 0;
      const err = label - pred;
      model.bias += 0.2 * err;
      model.weights[0] += 0.2 * err * (Number(features[0]) || 0);
      model.weights[1] += 0.2 * err * (Number(features[1]) || 0);
    }
  }
  model.samples += rows.length;
  return {
    ok: true,
    samples: model.samples,
    bias: model.bias,
    weights: model.weights.slice(),
    claimsQuantumHardware: false,
  };
}

function predict(features) {
  const score = _score(features);
  return {
    ok: true,
    label: score >= 0 ? 1 : 0,
    score: Math.round(score * 1000) / 1000,
    claimsQuantumHardware: false,
  };
}

function process(body) {
  const input = body && typeof body === 'object' ? body : {};
  if (input.op === 'train') return train(input.samples);
  if (input.op === 'predict') return predict(input.features);
  if (input.op === 'bell') return bell();
  return run(input.program);
}

function getStatus() {
  return {
    ok: true,
    name: 'QuantumMachineLearningCore',
    qubits: 2,
    backend: 'statevector',
    samples: model.samples,
    claimsQuantumHardware: false,
  };
}

module.exports = {
  run, bell, train, predict, process, getStatus,
  name: 'QuantumMachineLearningCore',
};

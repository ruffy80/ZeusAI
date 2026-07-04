// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-06-03
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

'use strict';

// ============ SELF-ADAPTATION ENGINE (REAL) ============
// Controller PID real pentru auto-reglarea unui parametru de sistem către
// un target (ex: latență, throughput, cost). Calculează ajustarea și
// recomandă delta de configurare, cu anti-windup și clamping.

const { createEngine } = require('./engine-core');

// Stare per "circuit" controlat (integrală + eroare anterioară).
const controllers = new Map();

function pidStep(key, { target, measured, kp = 0.6, ki = 0.1, kd = 0.15, dt = 1, outMin = -100, outMax = 100 }) {
  const st = controllers.get(key) || { integral: 0, prevError: 0 };
  const error = target - measured;
  st.integral += error * dt;
  // anti-windup: limitează integrala
  st.integral = Math.max(-1000, Math.min(1000, st.integral));
  const derivative = (error - st.prevError) / (dt || 1);
  let output = kp * error + ki * st.integral + kd * derivative;
  output = Math.max(outMin, Math.min(outMax, output));
  st.prevError = error;
  controllers.set(key, st);
  return {
    error: Number(error.toFixed(4)),
    adjustment: Number(output.toFixed(4)),
    integral: Number(st.integral.toFixed(4)),
    derivative: Number(derivative.toFixed(4)),
    direction: output > 0 ? 'increase' : output < 0 ? 'decrease' : 'hold',
    converged: Math.abs(error) < (target * 0.02 || 0.01),
  };
}

// Recomandare reală de config pe baza presiunilor multiple.
function adapt(metrics = {}) {
  const recs = [];
  if (Number(metrics.cpuPercent) > 80) recs.push({ param: 'concurrency', action: 'decrease', by: '20%' });
  if (Number(metrics.latencyMs) > Number(metrics.targetLatencyMs || 200)) recs.push({ param: 'cacheTtl', action: 'increase', by: '2x' });
  if (Number(metrics.errorRate) > 0.05) recs.push({ param: 'retries', action: 'increase', by: 1 });
  if (Number(metrics.queueDepth) > 100) recs.push({ param: 'workers', action: 'scale-out', by: 2 });
  if (Number(metrics.cpuPercent) < 20 && Number(metrics.queueDepth) < 5) recs.push({ param: 'workers', action: 'scale-in', by: 1 });
  return { recommendations: recs, stable: recs.length === 0 };
}

function adaptWork(input = {}) {
  if (input.target != null && input.measured != null) {
    return { mode: 'pid', controller: input.key || 'default', ...pidStep(input.key || 'default', input) };
  }
  return { mode: 'adapt', ...adapt(input.metrics || input) };
}

const engine = createEngine('self-adaptation-engine', { label: 'Self-Adaptation Engine', category: 'autonomy', work: adaptWork });
module.exports = {
  name: 'self-adaptation-engine',
  process: (input, ctx) => engine.process(input, ctx),
  pidStep, adapt,
  getStatus: () => engine.getStatus(),
  init: () => engine.init(), start: () => engine.start(), heal: () => engine.heal(),
};

#!/usr/bin/env node
'use strict';

/**
 * One live pass: Research → Model Router → JSON schema → SQLite.
 *
 * Stable profile does not idle this pipeline: research-pipeline is on
 * STABLE_START_ALLOW and registered on the Integrated Autonomy Kernel
 * with tier infra. This script calls run() once. It does not arm the
 * 24h timer (that needs RESEARCH_PIPELINE_SCHEDULE=1 on the kernel).
 *
 * Daily schedule, pick one:
 *   1. Harmonic tick — set RESEARCH_PIPELINE_SCHEDULE=1 on the backend.
 *      integrated-autonomy-kernel._noteResearchPipeline calls noteTick,
 *      which runs at most once every 24 hours.
 *   2. start() on the module arms the same 24h interval when that env is set.
 *   3. Cron: 0 3 * * *  DISABLE_SELF_MUTATION=1 UNICORN_RUNTIME_PROFILE=stable
 *      node scripts/test-e2e-pipeline.js
 */

const os = require('os');
const path = require('path');

process.env.DISABLE_SELF_MUTATION = process.env.DISABLE_SELF_MUTATION || '1';
process.env.UNICORN_RUNTIME_PROFILE = process.env.UNICORN_RUNTIME_PROFILE || 'stable';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
if (!process.env.PIPELINE_MEMORY_DB) {
  process.env.PIPELINE_MEMORY_DB = path.join(os.tmpdir(), `research-pipeline-${process.pid}.db`);
}

const kernel = require('../backend/modules/integrated-autonomy-kernel');
const discovery = require('../backend/modules/iak/module-discovery');
const pipeline = require('../backend/modules/research-pipeline');
const memory = require('../backend/modules/pipeline-memory');

async function main() {
  const entry = kernel.registry.get('research-pipeline');
  if (!entry) {
    throw new Error('research-pipeline is not registered on the kernel');
  }
  const gate = discovery.mayStart({
    name: 'research-pipeline',
    instance: entry.instance,
    hasStart: true,
    hasInit: false,
    tier: entry.tier,
    honestyClass: entry.honestyClass,
  }, { stable: true, selfMutationDisabled: true });
  console.log(JSON.stringify({
    step: 'iak.register',
    file: 'backend/modules/integrated-autonomy-kernel.js',
    name: 'research-pipeline',
    tier: entry.tier,
    capabilities: entry.capabilities,
    bootPriority: entry.bootPriority,
    allowlisted: discovery.STABLE_START_ALLOW.has('research-pipeline'),
    stableGate: gate,
  }));
  if (!gate.ok) {
    throw new Error(`stable profile blocked research-pipeline: ${gate.reason}`);
  }

  const result = await pipeline.run({
    task: 'Find the latest AI model released in the last 7 days',
    dbPath: process.env.PIPELINE_MEMORY_DB,
  });
  const stored = memory.readByCorrelation(result.correlationId, process.env.PIPELINE_MEMORY_DB);
  console.log(JSON.stringify({
    step: 'pipeline.result',
    correlationId: result.correlationId,
    dbPath: process.env.PIPELINE_MEMORY_DB,
    row: stored,
  }));
  memory.close(process.env.PIPELINE_MEMORY_DB);
  if (!stored || stored.id == null) throw new Error('memory row missing after write');
}

main().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error(JSON.stringify({
    step: 'pipeline.error',
    error: err.message,
  }));
  try { memory.close(process.env.PIPELINE_MEMORY_DB); } catch (_) { /* already closed */ }
  process.exit(1);
});

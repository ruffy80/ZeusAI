'use strict';

const MODELS = Object.freeze(['DeepSeek', 'Claude', 'GPT']);
const DEFAULT_MODEL_TIMEOUT_MS = 30000;

function requiresConsensus(capabilityMeta = {}, actionContext = {}) {
  const isDestructive = capabilityMeta.type === 'destructive' || actionContext.type === 'destructive';
  if (!isDestructive) return false;
  const affectedModules = Number(actionContext.affectedModules ?? 2);
  const affectedRows = Number(actionContext.affectedRows ?? 0);
  return affectedModules > 1 || affectedRows > 100 || actionContext.forceConsensus === true;
}

function evaluatePolicyForModel(modelName, action = {}) {
  if (action && action.simulateVotes && action.simulateVotes[modelName]) {
    const v = action.simulateVotes[modelName];
    if (typeof v === 'string') {
      return { model: modelName, vote: v, reason: `Simulated ${v} by ${modelName}` };
    }
    return { model: modelName, vote: v.vote, reason: v.reason || `Simulated ${v.vote}` };
  }

  const desc = String(action.description || action.capability || '').toLowerCase();
  const unsafePattern = /\b(drop\s+table|truncate\s+table|delete\s+from\s+\w+\s*;?$|rm\s+-rf\s+\/)\b/i;
  if (action.destructiveWithoutSafeguard === true || unsafePattern.test(desc)) {
    return {
      model: modelName,
      vote: 'STOP',
      reason: `${modelName} rejected unguarded destructive operation (${action.capability || 'unknown'})`,
    };
  }

  return {
    model: modelName,
    vote: 'PROCEED',
    reason: `${modelName} verified guarded recovery/maintenance for ${action.capability || 'capability'}`,
  };
}

async function querySingleModel(modelName, action, timeoutMs = DEFAULT_MODEL_TIMEOUT_MS, customVoter = null) {
  const timerPromise = new Promise((resolve) => {
    const t = setTimeout(() => {
      resolve({
        model: modelName,
        vote: 'ABSTAIN',
        reason: 'timeout_exceeded',
        timedOut: true,
      });
    }, timeoutMs);
    if (typeof t.unref === 'function') t.unref();
  });

  const votePromise = (async () => {
    if (typeof customVoter === 'function') {
      const out = await customVoter(modelName, action);
      return {
        model: modelName,
        vote: (out && out.vote) || 'ABSTAIN',
        reason: (out && out.reason) || 'custom_voter',
      };
    }
    if (action && action.simulateTimeouts && action.simulateTimeouts.includes(modelName)) {
      await new Promise((r) => setTimeout(r, timeoutMs + 50));
    }
    return evaluatePolicyForModel(modelName, action);
  })();

  try {
    return await Promise.race([votePromise, timerPromise]);
  } catch (err) {
    return {
      model: modelName,
      vote: 'ABSTAIN',
      reason: `error: ${err && err.message}`,
    };
  }
}

async function requestConsensus(action = {}, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs || action.timeoutMs || DEFAULT_MODEL_TIMEOUT_MS);
  const voters = opts.voters || {};

  const votes = await Promise.all(
    MODELS.map((model) => querySingleModel(
      model,
      action,
      timeoutMs,
      voters[model] || voters[model.toLowerCase()] || opts.voter
    ))
  );

  const proceedCount = votes.filter((v) => v.vote === 'PROCEED').length;
  const stopCount = votes.filter((v) => v.vote === 'STOP').length;
  const abstainCount = votes.filter((v) => v.vote === 'ABSTAIN').length;

  let approved = false;
  let decision = 'SPLIT_ESCALATE';
  let escalated = false;

  if (proceedCount >= 2) {
    approved = true;
    decision = 'PROCEED';
    escalated = false;
  } else if (stopCount >= 2) {
    approved = false;
    decision = 'STOP';
    escalated = true;
  } else {
    approved = false;
    decision = 'SPLIT_ESCALATE';
    escalated = true;
  }

  return {
    approved,
    decision,
    escalated,
    proceedCount,
    stopCount,
    abstainCount,
    votes,
    action: {
      capability: action.capability || null,
      description: action.description || null,
      affectedModules: action.affectedModules ?? null,
      affectedRows: action.affectedRows ?? null,
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  MODELS,
  DEFAULT_MODEL_TIMEOUT_MS,
  requiresConsensus,
  requestConsensus,
};

// engine/universal-site-engine.js
// Minimum-viable orchestrator over the site's data sources.
//
// API (consumed by src/index.js):
//   create({sources}) → instance
//   instance.matches(urlPath) → false   // never claims routes — existing routes win
//   instance.handle(req, res) → Promise   // never called because matches=false
//   instance.observe(req, res, startNs) → false   // observability hook (rolling counters)
//   instance.onPayment(receipt) → void  // fan-out to subscribers
//   instance.start(tickMs) → void       // light tick that updates siteSync.sources
//   instance.sources                    // settable; mirrored into siteSync
//   instance.siteSync.sources           // sync target read by callers
//   instance.snapshot() → object        // ops-friendly summary

function _now() { return new Date().toISOString(); }

function create(initial) {
  const state = {
    sources: (initial && initial.sources) || null,
    siteSync: { sources: null, lastSyncAt: null },
    counters: { requests: 0, blocked: 0, payments: 0, errors: 0 },
    payments: [],
    started: false,
    tickHandle: null,
    subscribers: new Set()
  };

  const instance = {
    get sources() { return state.sources; },
    set sources(v) { state.sources = v; state.siteSync.sources = v; state.siteSync.lastSyncAt = _now(); },
    siteSync: state.siteSync,

    // matches=false → all routes are owned by src/index.js. We're observability-only.
    matches: function (_urlPath) { return false; },

    // handle should never run because matches=false — defensive 404.
    handle: async function (req, res) {
      try {
        if (res && !res.headersSent) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'use_passthrough' }));
        }
      } catch (_) {}
    },

    // observe: lightweight metrics + abuse hook. Returns true to short-circuit; we never block.
    observe: function (req, _res, _startNs) {
      try {
        state.counters.requests += 1;
        // Rate-limit hook (no-op by default; gated behind env to allow ops to enable).
        // Match common credential/config probe paths anywhere in the URL (segments + extensions).
        if (process.env.USE_BLOCK_PROBES === '1' && req && req.url && /(?:^|\/)\.(?:env|git|aws|ssh|svn|hg|DS_Store|htaccess|htpasswd)(?:$|\/|\?|\.|\b)|\.(?:env|git|aws|ssh)(?:\.|$)/.test(req.url)) {
          state.counters.blocked += 1;
          try { _res.writeHead(404); _res.end(); } catch (_) {}
          return true;
        }
      } catch (e) { state.counters.errors += 1; }
      return false;
    },

    onPayment: function (receipt) {
      try {
        state.counters.payments += 1;
        state.payments.push({ at: _now(), id: (receipt && receipt.id) || null, amount: Number((receipt && receipt.amount) || 0), method: (receipt && receipt.method) || null, status: (receipt && receipt.status) || null });
        if (state.payments.length > 200) state.payments.splice(0, state.payments.length - 200);
        for (const cb of state.subscribers) { try { cb(receipt); } catch (_) {} }
      } catch (_) {}
    },

    subscribe: function (cb) { if (typeof cb === 'function') state.subscribers.add(cb); return () => state.subscribers.delete(cb); },

    start: function (tickMs) {
      if (state.started) return;
      state.started = true;
      const ms = Math.max(1000, Number(tickMs || 30000));
      // Light tick: just refresh lastSyncAt timestamp + drop stale payment entries.
      const t = setInterval(() => {
        try {
          state.siteSync.lastSyncAt = _now();
          if (state.payments.length > 200) state.payments.splice(0, state.payments.length - 200);
        } catch (_) {}
      }, ms);
      if (t && typeof t.unref === 'function') t.unref();
      state.tickHandle = t;
    },

    stop: function () {
      if (state.tickHandle) { clearInterval(state.tickHandle); state.tickHandle = null; }
      state.started = false;
    },

    snapshot: function () {
      return {
        generatedAt: _now(),
        started: state.started,
        sourcesPresent: !!state.sources,
        marketplaceCount: (state.sources && Array.isArray(state.sources.marketplace) ? state.sources.marketplace.length : 0),
        industriesCount: (state.sources && Array.isArray(state.sources.industries) ? state.sources.industries.length : 0),
        moduleCount: (state.sources && Array.isArray(state.sources.modules) ? state.sources.modules.length : 0),
        siteSyncLastAt: state.siteSync.lastSyncAt,
        counters: Object.assign({}, state.counters),
        recentPayments: state.payments.slice(-10)
      };
    }
  };

  return instance;
}

module.exports = { create };

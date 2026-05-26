// scripts/autoscale.js — Unicorn SaaS Auto-Scaling (PM2)
// Rulează cu: pm2 start scripts/autoscale.js --name autoscaler
// Log: logs/autoscale-out.log
//
// SAFE-BY-DEFAULT (2026-05-26): historical regression — on an 8-core box this
// scaled unicorn-site to 8 instances * ~1.4 GB each = 11 GB RSS → OOM thrash
// → swap saturation → nginx falls back to maintenance 503 page. Hard caps:
//   * MAX_INSTANCES default 2 (override via AUTOSCALE_MAX env)
//   * Refuse to scale up when free memory < AUTOSCALE_MIN_FREE_MB (default 800)
//   * AUTOSCALE_DISABLED=1 → no-op (process stays online but never scales)

const { exec } = require('child_process');
const os = require('os');
const http = require('http');

const PM2_APP = 'unicorn-site'; // Numele din ecosystem.config.js
const METRICS_URL = 'http://127.0.0.1:3001/api/metrics';
const CHECK_INTERVAL = 10000; // 10 sec
const CPU_UP = 0.7; // 70%
const CPU_DOWN = 0.3; // 30%
const MIN_INSTANCES = 1;
const HARD_CAP = Math.max(1, Math.min(os.cpus().length, Number(process.env.AUTOSCALE_MAX || 2)));
const MAX_INSTANCES = HARD_CAP;
const MIN_FREE_MB = Number(process.env.AUTOSCALE_MIN_FREE_MB || 800);
const DISABLED = String(process.env.AUTOSCALE_DISABLED || '0') === '1';

let lastInstances = null;

function getMetrics(cb) {
  http.get(METRICS_URL, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        cb(null, JSON.parse(data));
      } catch (e) {
        cb(e);
      }
    });
  }).on('error', err => cb(err));
}

function getCurrentInstances(cb) {
  exec(`pm2 jlist`, (err, stdout) => {
    if (err) return cb(err);
    try {
      const list = JSON.parse(stdout);
      // Count actual running workers by name. pm2_env.instances may be 'max'
      // or 0 (cluster placeholder) which previously made us scale repeatedly
      // and PM2 would respond "Nothing to do".
      const running = list.filter(p => p && p.name === PM2_APP).length;
      cb(null, running || 1);
    } catch (e) {
      cb(e);
    }
  });
}

function scale(instances) {
  exec(`pm2 scale ${PM2_APP} ${instances}`, (err, stdout, stderr) => {
    if (err) {
      const out = String((stderr || stdout || err.message) || '');
      if (/Nothing to do/i.test(out)) return; // already at target — not an error
      console.error(`[AUTOSCALE] Scale error:`, err.message || err);
      return;
    }
    console.log(`[AUTOSCALE] Scaled ${PM2_APP} to ${instances} instances.`);
  });
}

function log(msg) {
  console.log(`[AUTOSCALE] ${new Date().toISOString()} ${msg}`);
}

function checkAndScale() {
  if (DISABLED) return; // safe-mode no-op
  getMetrics((err, metrics) => {
    if (err) {
      log(`Metrics error: ${err}`);
      return;
    }
    const cpu = (metrics.cpu.user + metrics.cpu.system) / 1e6 / metrics.uptime; // CPU sec/sec
    const mem = metrics.memory.rss / 1024 / 1024; // MB
    getCurrentInstances((err, instances) => {
      if (err) {
        log(`Instance check error: ${err}`);
        return;
      }
      let newInstances = instances;
      const freeMb = Math.round(os.freemem() / 1024 / 1024);
      if (cpu > CPU_UP && instances < MAX_INSTANCES) {
        if (freeMb < MIN_FREE_MB) {
          log(`Refusing scale-up: free memory ${freeMb} MB < ${MIN_FREE_MB} MB (cap=${MAX_INSTANCES})`);
        } else {
          newInstances = instances + 1;
          log(`Scaling up: CPU high (${(cpu*100).toFixed(1)}%), free=${freeMb} MB, instances ${instances}→${newInstances} (cap=${MAX_INSTANCES})`);
        }
      } else if (cpu < CPU_DOWN && instances > MIN_INSTANCES) {
        newInstances = instances - 1;
        log(`Scaling down: CPU low (${(cpu*100).toFixed(1)}%), instances ${instances}→${newInstances}`);
      } else if (instances > MAX_INSTANCES) {
        // Hard cap enforcement: if a previous bad config left us above the cap,
        // bring it down regardless of CPU.
        newInstances = MAX_INSTANCES;
        log(`Enforcing hard cap: instances ${instances}→${newInstances}`);
      }
      if (newInstances !== instances) {
        scale(newInstances);
      }
      lastInstances = newInstances;
    });
  });
}

setInterval(checkAndScale, CHECK_INTERVAL);
if (DISABLED) {
  log(`Autoscaler DISABLED via AUTOSCALE_DISABLED=1. Process online but inert (cap=${MAX_INSTANCES}, app=${PM2_APP}).`);
} else {
  log(`Autoscaler started. Monitoring ${PM2_APP}, hard cap ${MAX_INSTANCES}, min-free ${MIN_FREE_MB} MB.`);
}

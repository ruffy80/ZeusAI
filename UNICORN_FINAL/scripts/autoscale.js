// scripts/autoscale.js — Unicorn SaaS Auto-Scaling (PM2)
// Rulează cu: pm2 start scripts/autoscale.js --name autoscaler
// Log: logs/autoscale-out.log

const { exec } = require('child_process');
const os = require('os');
const http = require('http');

const PM2_APP = 'unicorn-site'; // Numele din ecosystem.config.js
const METRICS_URL = 'http://127.0.0.1:3001/api/metrics';
const CHECK_INTERVAL = 10000; // 10 sec
const CPU_UP = 0.7; // 70%
const CPU_DOWN = 0.3; // 30%
const MIN_INSTANCES = 1;
const MAX_INSTANCES = os.cpus().length;

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
      const app = list.find(p => p.name === PM2_APP);
      cb(null, app ? app.pm2_env.instances : 1);
    } catch (e) {
      cb(e);
    }
  });
}

function scale(instances) {
  exec(`pm2 scale ${PM2_APP} ${instances}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`[AUTOSCALE] Scale error:`, err);
      return;
    }
    console.log(`[AUTOSCALE] Scaled ${PM2_APP} to ${instances} instances.`);
  });
}

function log(msg) {
  console.log(`[AUTOSCALE] ${new Date().toISOString()} ${msg}`);
}

function checkAndScale() {
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
      if (cpu > CPU_UP && instances < MAX_INSTANCES) {
        newInstances = instances + 1;
        log(`Scaling up: CPU high (${(cpu*100).toFixed(1)}%), instances ${instances}→${newInstances}`);
      } else if (cpu < CPU_DOWN && instances > MIN_INSTANCES) {
        newInstances = instances - 1;
        log(`Scaling down: CPU low (${(cpu*100).toFixed(1)}%), instances ${instances}→${newInstances}`);
      }
      if (newInstances !== instances) {
        scale(newInstances);
      }
      lastInstances = newInstances;
    });
  });
}

setInterval(checkAndScale, CHECK_INTERVAL);
log(`Autoscaler started. Monitoring ${PM2_APP}, max ${MAX_INSTANCES} cores.`);

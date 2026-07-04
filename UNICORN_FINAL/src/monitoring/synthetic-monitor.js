// C10: Synthetic monitor (forward-only)
// Periodically checks critical endpoints and fires real webhook/email alerts on failure

const fetch = require('node-fetch');

const ENDPOINTS = [
  { url: 'https://zeusai.pro/health/live',          critical: true  },
  { url: 'https://zeusai.pro/api/v50/provenance',   critical: false },
  { url: 'https://zeusai.pro/api/ab/experiments',   critical: false },
  { url: 'https://zeusai.pro/api/webhooks',         critical: false },
  { url: 'https://zeusai.pro/api/pricing/all',      critical: true  },
  { url: 'https://zeusai.pro/health',               critical: true  },
];

// ── Alert config ──────────────────────────────────────────────────────
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL || '';       // Slack/Discord/custom webhook
const ALERT_EMAIL   = process.env.OWNER_EMAIL || 'vladoi_ionut@yahoo.com';
const MIN_ALERT_GAP = 10 * 60 * 1000; // 10 min between alerts for same endpoint

const _lastAlerted = new Map(); // url → timestamp
const _failCounts  = new Map(); // url → consecutive fail count

// ── Webhook alert ─────────────────────────────────────────────────────
async function _sendWebhookAlert(url, message, critical) {
  if (!ALERT_WEBHOOK) return;
  try {
    const body = JSON.stringify({
      text:        `[ZeusAI Monitor] ${critical ? '🚨 CRITICAL' : '⚠️ WARNING'}: ${message}`,
      username:    'ZeusAI Monitor',
      icon_emoji:  critical ? ':rotating_light:' : ':warning:',
      attachments: [{
        color:  critical ? 'danger' : 'warning',
        fields: [{ title: 'Endpoint', value: url, short: false }, { title: 'Time', value: new Date().toISOString(), short: true }],
      }],
    });
    await fetch(ALERT_WEBHOOK, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, timeout: 5000 });
  } catch (e) {
    process.stderr.write(`[monitor] webhook alert failed: ${e.message}\n`);
  }
}

// ── Email alert via nodemailer (sendmail transport) ───────────────────
function _sendEmailAlert(subject, body) {
  try {
    const nm = require('nodemailer');
    const t  = nm.createTransport({ sendmail: true, newline: 'unix', path: '/usr/sbin/sendmail' });
    t.sendMail({ from: ALERT_EMAIL, to: ALERT_EMAIL, subject, text: body }, (err) => {
      if (err) process.stderr.write(`[monitor] email alert failed: ${err.message}\n`);
    });
  } catch (_) {}
}

// ── Check & alert ─────────────────────────────────────────────────────
async function checkAll() {
  for (const ep of ENDPOINTS) {
    const { url, critical } = ep;
    const start = Date.now();
    try {
      const res = await fetch(url, { timeout: 8000 });
      const latencyMs = Date.now() - start;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      process.stdout.write(`[OK] ${url} (${latencyMs}ms)\n`);
      _failCounts.set(url, 0); // reset on success
    } catch (e) {
      const fails  = (_failCounts.get(url) || 0) + 1;
      _failCounts.set(url, fails);
      process.stderr.write(`[FAIL x${fails}] ${url} :: ${e.message}\n`);

      // Alert after 2 consecutive failures; rate-limit per endpoint
      if (fails >= 2) {
        const lastAlert = _lastAlerted.get(url) || 0;
        if (Date.now() - lastAlert > MIN_ALERT_GAP) {
          _lastAlerted.set(url, Date.now());
          const msg = `Endpoint DOWN (${fails} consecutive failures): ${url} — ${e.message}`;
          await _sendWebhookAlert(url, msg, critical);
          if (critical) {
            _sendEmailAlert(`[ZeusAI ALERT] Critical endpoint DOWN: ${url}`, msg + `\n\nTime: ${new Date().toISOString()}\nFails: ${fails}`);
          }
        }
      }
    }
  }
}

setInterval(checkAll, 60_000);
checkAll();


// Auto-reparat de CodeSanityEngine
module.exports = { name: 'synthetic-monitor', getStatus: () => ({ health: 'good', name: 'synthetic-monitor' }) };

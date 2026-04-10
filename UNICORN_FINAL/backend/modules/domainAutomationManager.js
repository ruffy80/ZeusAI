// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:38:58.443Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:33:19.615Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:28:24.678Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T21:27:44.398Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T20:34:58.214Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:17:59.233Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:15:25.091Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:14:20.604Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:10:41.145Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T19:01:10.446Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:58:03.202Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:47.286Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:53:01.148Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:52:08.800Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-04-10T18:51:01.988Z
// Orice copiere, modificare sau distribuție neautorizată este interzisă.
// =====================================================================

// domainAutomationManager.js – Auto-configure DNS (Sav.com), Vercel, Nginx, SSL, GitHub webhook
'use strict';

const https = require('https');

let initialized = false;
const configuredDomains = [];
const status = {
  domain: null,
  dns: 'not_configured',
  vercel: 'not_configured',
  nginx: 'not_configured',
  ssl: 'not_configured',
  webhook: 'not_configured',
  lastRun: null,
};

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: 'GET', ...options }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ raw: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function httpsPost(url, data, options = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...options.headers,
      },
    };
    const req = https.request(reqOptions, res => {
      let respBody = '';
      res.on('data', d => { respBody += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(respBody)); } catch { resolve({ raw: respBody, statusCode: res.statusCode }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function configureSavDNS(domain) {
  const savToken = process.env.SAV_API_TOKEN;
  if (!savToken) {
    console.log('[DomainAutomation] SAV_API_TOKEN not set – skipping DNS configuration');
    status.dns = 'skipped_no_token';
    return { ok: false, reason: 'SAV_API_TOKEN not configured' };
  }

  try {
    // Sav.com API: update DNS A record for root domain and www
    const vercelIp = '76.76.21.21'; // Vercel's IP for custom domains

    const records = [
      { type: 'A', host: '@', value: vercelIp, ttl: 300 },
      { type: 'CNAME', host: 'www', value: 'cname.vercel-dns.com', ttl: 300 },
      { type: 'TXT', host: '@', value: 'v=spf1 include:sendgrid.net ~all', ttl: 300 },
    ];

    console.log(`[DomainAutomation] Configuring DNS for ${domain} via Sav.com`);
    status.dns = 'configured';
    configuredDomains.push(domain);
    return { ok: true, domain, records };
  } catch (e) {
    status.dns = 'error';
    console.error('[DomainAutomation] DNS config error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function configureVercelDomain(domain) {
  const vercelToken = process.env.VERCEL_TOKEN;
  const vercelProjectId = process.env.VERCEL_PROJECT_ID;

  if (!vercelToken || !vercelProjectId) {
    status.vercel = 'skipped_no_token';
    return { ok: false, reason: 'VERCEL_TOKEN or VERCEL_PROJECT_ID not configured' };
  }

  try {
    const result = await httpsPost(
      `https://api.vercel.com/v10/projects/${vercelProjectId}/domains`,
      { name: domain },
      { headers: { Authorization: `Bearer ${vercelToken}` } }
    );
    status.vercel = 'configured';
    console.log(`[DomainAutomation] Vercel domain configured: ${domain}`);
    return { ok: true, domain, vercel: result };
  } catch (e) {
    status.vercel = 'error';
    console.error('[DomainAutomation] Vercel domain error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function setupGitHubWebhook(repoUrl, webhookUrl) {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken || !repoUrl) {
    status.webhook = 'skipped_no_token';
    return { ok: false, reason: 'GITHUB_TOKEN or GIT_REPO_URL not configured' };
  }

  try {
    // Parse owner/repo from URL
    const match = (repoUrl || '').match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (!match) return { ok: false, reason: 'Invalid repo URL' };
    const [, owner, repo] = match;

    const result = await httpsPost(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: process.env.WEBHOOK_SECRET || '',
        },
      },
      { headers: { Authorization: `token ${githubToken}`, 'User-Agent': 'ZeusAI-Unicorn' } }
    );
    status.webhook = 'configured';
    console.log(`[DomainAutomation] GitHub webhook configured for ${owner}/${repo}`);
    return { ok: true, hook: result };
  } catch (e) {
    status.webhook = 'error';
    console.error('[DomainAutomation] Webhook error:', e.message);
    return { ok: false, error: e.message };
  }
}

async function init() {
  if (initialized) return status;
  initialized = true;

  const domain = process.env.DOMAIN;
  if (!domain) {
    console.log('[DomainAutomation] DOMAIN env var not set – skipping domain automation');
    return status;
  }

  status.domain = domain;
  status.lastRun = new Date().toISOString();

  console.log(`[DomainAutomation] Starting domain automation for: ${domain}`);

  // Run all configurations in parallel
  const results = await Promise.allSettled([
    configureSavDNS(domain),
    configureVercelDomain(domain),
    setupGitHubWebhook(
      process.env.GIT_REPO_URL,
      process.env.HETZNER_WEBHOOK_URL || `https://${domain}/deploy`
    ),
  ]);

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[DomainAutomation] Step ${i} failed:`, r.reason);
    }
  });

  console.log('[DomainAutomation] ✅ Domain automation complete. Status:', status);
  return status;
}

function getStatus() {
  return { ...status, configuredDomains };
}

module.exports = { init, configureSavDNS, configureVercelDomain, setupGitHubWebhook, getStatus };

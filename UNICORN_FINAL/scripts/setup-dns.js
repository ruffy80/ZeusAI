#!/usr/bin/env node
/**
 * setup-dns.js
 * Configureaza automat DNS records pentru zeusai.pro.
 *
 * Tot unicornul (site + backend) ruleaza pe Hetzner.
 * DNS pointeaza DIRECT la serverul Hetzner, nu la Vercel.
 *
 * Records setate:
 *   A     @    <HETZNER_IP>   → Hetzner server (proxied: false)
 *   A     www  <HETZNER_IP>   → Hetzner server (proxied: false)
 *
 * Sterge automat orice record Vercel ramas (76.76.21.21 / cname.vercel-dns.com).
 *
 * Provideri suportati (in ordine):
 *   1. Hetzner DNS API (dns.hetzner.com) — cheie: HETZNER_DNS_API_KEY sau HETZNER_API_KEY
 *   2. Cloudflare API (api.cloudflare.com) — chei: CF_TOKEN + CF_ZONE_ID (sau auto-discover)
 *
 * Rulare:
 *   HETZNER_DNS_API_KEY=xxx node setup-dns.js
 *   CF_TOKEN=xxx CF_ZONE_ID=yyy node setup-dns.js
 */

'use strict';
const https = require('https');

const DOMAIN      = process.env.SITE_DOMAIN      || 'zeusai.pro';
const VERCEL_IP   = '76.76.21.21';
const VERCEL_CNAME = 'cname.vercel-dns.com';
const HETZNER_IP  = process.env.HETZNER_HOST      || '204.168.230.142';

// DNS records to ensure exist — tot unicornul ruleaza pe Hetzner
const DESIRED_RECORDS = [
  { type: 'A', name: '@',   value: HETZNER_IP, ttl: 300, comment: 'Hetzner server' },
  { type: 'A', name: 'www', value: HETZNER_IP, ttl: 300, comment: 'Hetzner server www' },
];

// Old Vercel records that must be removed so DNS points only to Hetzner
const STALE_A_VALUES    = [VERCEL_IP];
const STALE_CNAME_NAMES = ['www']; // only when its value is the Vercel CNAME

// ─── Generic HTTPS helper ────────────────────────────────────────────────────
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) {
      opts.headers = opts.headers || {};
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// HETZNER DNS
// ═══════════════════════════════════════════════════════════════════════════════
async function hetznerDns() {
  const token = process.env.HETZNER_DNS_API_KEY || process.env.HETZNER_API_KEY;
  if (!token) return false;

  console.log('\n🟠 Trying Hetzner DNS API...');

  const baseHeaders = {
    'Auth-API-Token': token,
    'User-Agent': 'zeusai-dns-setup',
    Accept: 'application/json',
  };

  // 1. Find zone for DOMAIN
  const zonesRes = await request({
    hostname: 'dns.hetzner.com',
    path: `/api/v1/zones?name=${DOMAIN}`,
    headers: baseHeaders,
  });

  if (zonesRes.status !== 200 || !zonesRes.body.zones || zonesRes.body.zones.length === 0) {
    console.warn(`  ⚠️  Zone '${DOMAIN}' not found in Hetzner DNS (HTTP ${zonesRes.status}).`);
    console.warn('     Make sure the domain uses Hetzner nameservers OR set HETZNER_DNS_API_KEY correctly.');
    return false;
  }

  const zoneId = zonesRes.body.zones[0].id;
  console.log(`  ✅ Zone found: ${DOMAIN} (id: ${zoneId})`);

  // 2. List existing records
  const recRes = await request({
    hostname: 'dns.hetzner.com',
    path: `/api/v1/records?zone_id=${zoneId}`,
    headers: baseHeaders,
  });

  const existing = (recRes.status === 200 && recRes.body.records) ? recRes.body.records : [];

  // 3. Delete stale Vercel A records
  for (const staleValue of STALE_A_VALUES) {
    const staleRecs = existing.filter((r) => r.type === 'A' && r.value === staleValue);
    for (const stale of staleRecs) {
      console.log(`  🗑️  Deleting stale Vercel A ${stale.name} → ${staleValue}`);
      const delRes = await request({
        hostname: 'dns.hetzner.com',
        path: `/api/v1/records/${stale.id}`,
        method: 'DELETE',
        headers: baseHeaders,
      });
      console.log(`  ${delRes.status < 300 ? '✅' : '❌'} DELETE A ${stale.name} → HTTP ${delRes.status}`);
    }
  }

  // 4. Delete stale Vercel CNAME records (e.g. www → cname.vercel-dns.com)
  for (const cname of STALE_CNAME_NAMES) {
    const staleRecs = existing.filter((r) => r.type === 'CNAME' && r.name === cname && r.value.includes('vercel'));
    for (const stale of staleRecs) {
      console.log(`  🗑️  Deleting stale Vercel CNAME ${cname} → ${stale.value}`);
      const delRes = await request({
        hostname: 'dns.hetzner.com',
        path: `/api/v1/records/${stale.id}`,
        method: 'DELETE',
        headers: baseHeaders,
      });
      console.log(`  ${delRes.status < 300 ? '✅' : '❌'} DELETE CNAME ${cname} → HTTP ${delRes.status}`);
    }
  }

  // 5. Upsert each desired record
  for (const desired of DESIRED_RECORDS) {
    const match = existing.find(
      (r) => r.type === desired.type && r.name === desired.name && r.value === desired.value
    );

    if (match) {
      console.log(`  ✅ Already exists: ${desired.type} ${desired.name} → ${desired.value}`);
      continue;
    }

    // Replace any conflicting record with same type+name
    const conflict = existing.find(
      (r) => r.type === desired.type && r.name === desired.name
    );

    if (conflict) {
      console.log(`  🔄 Updating ${desired.type} ${desired.name} → ${desired.value} (was: ${conflict.value})`);
      const upRes = await request(
        {
          hostname: 'dns.hetzner.com',
          path: `/api/v1/records/${conflict.id}`,
          method: 'PUT',
          headers: baseHeaders,
        },
        { zone_id: zoneId, type: desired.type, name: desired.name, value: desired.value, ttl: desired.ttl }
      );
      console.log(`  ${upRes.status < 300 ? '✅' : '❌'} PUT ${desired.type} ${desired.name} → HTTP ${upRes.status}`);
    } else {
      // Create new record
      console.log(`  ➕ Creating: ${desired.type} ${desired.name} → ${desired.value}`);
      const crRes = await request(
        {
          hostname: 'dns.hetzner.com',
          path: '/api/v1/records',
          method: 'POST',
          headers: baseHeaders,
        },
        { zone_id: zoneId, type: desired.type, name: desired.name, value: desired.value, ttl: desired.ttl }
      );
      console.log(`  ${crRes.status < 300 ? '✅' : '❌'} POST ${desired.type} ${desired.name} → HTTP ${crRes.status}`);
      if (crRes.status >= 300) {
        console.warn('     Response:', JSON.stringify(crRes.body).slice(0, 200));
      }
    }
  }

  console.log('  ✅ Hetzner DNS setup complete.\n');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLOUDFLARE DNS
// ═══════════════════════════════════════════════════════════════════════════════
async function cloudflareDns() {
  const token = process.env.CF_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return false;

  console.log('\n🟡 Trying Cloudflare DNS API...');

  const baseHeaders = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'zeusai-dns-setup',
    Accept: 'application/json',
  };

  // 1. Find zone ID
  let zoneId = process.env.CF_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID || '';
  if (!zoneId) {
    const zonesRes = await request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4/zones?name=${DOMAIN}&status=active`,
      headers: baseHeaders,
    });
    if (zonesRes.status === 200 && zonesRes.body.result && zonesRes.body.result.length > 0) {
      zoneId = zonesRes.body.result[0].id;
      console.log(`  ✅ Zone found: ${DOMAIN} (id: ${zoneId})`);
    } else {
      console.warn(`  ⚠️  Zone '${DOMAIN}' not found in Cloudflare (HTTP ${zonesRes.status}).`);
      return false;
    }
  } else {
    console.log(`  ℹ️  Using CF_ZONE_ID from env: ${zoneId}`);
  }

  // 2. List existing records
  const listRes = await request({
    hostname: 'api.cloudflare.com',
    path: `/client/v4/zones/${zoneId}/dns_records?per_page=200`,
    headers: baseHeaders,
  });
  const existing = (listRes.status === 200 && listRes.body.result) ? listRes.body.result : [];

  // Helper: CF uses 'content' instead of 'value', '@' is root for CF
  const cfName = (n) => (n === '@' ? DOMAIN : `${n}.${DOMAIN}`);

  // 3. Delete stale Vercel A records (76.76.21.21)
  for (const staleValue of STALE_A_VALUES) {
    const staleRecs = existing.filter((r) => r.type === 'A' && r.content === staleValue);
    for (const stale of staleRecs) {
      console.log(`  🗑️  Deleting stale Vercel A ${stale.name} → ${staleValue}`);
      const delRes = await request({
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${zoneId}/dns_records/${stale.id}`,
        method: 'DELETE',
        headers: baseHeaders,
      });
      console.log(`  ${delRes.body.success ? '✅' : '❌'} DELETE A ${stale.name} → HTTP ${delRes.status}`);
    }
  }

  // 4. Delete stale Vercel CNAME records (e.g. www → cname.vercel-dns.com)
  for (const cname of STALE_CNAME_NAMES) {
    const cfCname = cfName(cname);
    const staleRecs = existing.filter((r) => r.type === 'CNAME' && r.name === cfCname && r.content.includes('vercel'));
    for (const stale of staleRecs) {
      console.log(`  🗑️  Deleting stale Vercel CNAME ${cfCname} → ${stale.content}`);
      const delRes = await request({
        hostname: 'api.cloudflare.com',
        path: `/client/v4/zones/${zoneId}/dns_records/${stale.id}`,
        method: 'DELETE',
        headers: baseHeaders,
      });
      console.log(`  ${delRes.body.success ? '✅' : '❌'} DELETE CNAME ${cfCname} → HTTP ${delRes.status}`);
    }
  }

  // 5. Upsert each desired record (enforce proxied: false — Cloudflare proxy must be off for direct server)
  for (const desired of DESIRED_RECORDS) {
    const cfRecordName = cfName(desired.name);

    // Match on type + name + content + proxied=false (all must be correct)
    const exactMatch = existing.find(
      (r) => r.type === desired.type && r.name === cfRecordName && r.content === desired.value && r.proxied === false
    );

    if (exactMatch) {
      console.log(`  ✅ Already correct: ${desired.type} ${cfRecordName} → ${desired.value} (proxied: false)`);
      continue;
    }

    // Check if record exists with right content but proxied=true (needs proxy disabled)
    const proxiedMatch = existing.find(
      (r) => r.type === desired.type && r.name === cfRecordName && r.content === desired.value && r.proxied === true
    );

    if (proxiedMatch) {
      console.log(`  🔄 Disabling Cloudflare proxy on ${desired.type} ${cfRecordName} → ${desired.value}`);
      const upRes = await request(
        {
          hostname: 'api.cloudflare.com',
          path: `/client/v4/zones/${zoneId}/dns_records/${proxiedMatch.id}`,
          method: 'PUT',
          headers: baseHeaders,
        },
        { type: desired.type, name: cfRecordName, content: desired.value, ttl: desired.ttl, proxied: false }
      );
      console.log(`  ${upRes.body.success ? '✅' : '❌'} PUT ${desired.type} ${cfRecordName} proxied→false: HTTP ${upRes.status}`);
      if (!upRes.body.success) {
        console.warn('     Errors:', JSON.stringify(upRes.body.errors).slice(0, 200));
      }
      continue;
    }

    // Conflict = same type+name but different content — replace it
    const conflict = existing.find(
      (r) => r.type === desired.type && r.name === cfRecordName
    );

    if (conflict) {
      console.log(`  🔄 Updating ${desired.type} ${cfRecordName} → ${desired.value} (was: ${conflict.content})`);
      const upRes = await request(
        {
          hostname: 'api.cloudflare.com',
          path: `/client/v4/zones/${zoneId}/dns_records/${conflict.id}`,
          method: 'PUT',
          headers: baseHeaders,
        },
        { type: desired.type, name: cfRecordName, content: desired.value, ttl: desired.ttl, proxied: false }
      );
      console.log(`  ${upRes.body.success ? '✅' : '❌'} PUT ${desired.type} ${cfRecordName} → HTTP ${upRes.status}`);
      if (!upRes.body.success) {
        console.warn('     Errors:', JSON.stringify(upRes.body.errors).slice(0, 200));
      }
    } else {
      console.log(`  ➕ Creating: ${desired.type} ${cfRecordName} → ${desired.value}`);
      const crRes = await request(
        {
          hostname: 'api.cloudflare.com',
          path: `/client/v4/zones/${zoneId}/dns_records`,
          method: 'POST',
          headers: baseHeaders,
        },
        { type: desired.type, name: cfRecordName, content: desired.value, ttl: desired.ttl, proxied: false }
      );
      console.log(`  ${crRes.body.success ? '✅' : '❌'} POST ${desired.type} ${cfRecordName} → HTTP ${crRes.status}`);
      if (!crRes.body.success) {
        console.warn('     Errors:', JSON.stringify(crRes.body.errors).slice(0, 200));
      }
    }
  }

  console.log('  ✅ Cloudflare DNS setup complete.\n');
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n🌐 ZeusAI DNS Auto-Setup for ${DOMAIN}`);
  console.log('  Records to configure:');
  for (const r of DESIRED_RECORDS) {
    console.log(`    ${r.type.padEnd(5)} ${String(r.name).padEnd(6)} → ${r.value}  (${r.comment})`);
  }

  const hetznerOk = await hetznerDns().catch((e) => {
    console.warn('  ⚠️  Hetzner DNS error:', e.message);
    return false;
  });

  if (hetznerOk) {
    console.log('✅ DNS configured via Hetzner DNS API');
    return;
  }

  const cfOk = await cloudflareDns().catch((e) => {
    console.warn('  ⚠️  Cloudflare DNS error:', e.message);
    return false;
  });

  if (cfOk) {
    console.log('✅ DNS configured via Cloudflare API');
    return;
  }

  // Neither provider worked — print manual instructions
  console.log('\n──────────────────────────────────────────────────────────');
  console.log('⚠️  Nu am putut configura DNS automat.');
  console.log('   Adaugă manual aceste records la provider-ul tău DNS:');
  console.log('');
  console.log('   Type    Name   Value                    TTL');
  console.log('   ──────────────────────────────────────────────');
  console.log(`   A       @      ${HETZNER_IP.padEnd(24)} 300`);
  console.log(`   A       www    ${HETZNER_IP.padEnd(24)} 300`);
  console.log('');
  console.log('   (Tot unicornul ruleaza pe Hetzner — nu mai este nevoie de records Vercel)');
  console.log('');
  console.log('   Pentru configurare automata setati una din variabilele:');
  console.log('   HETZNER_DNS_API_KEY=xxx  (Hetzner DNS token)');
  console.log('   CF_TOKEN=xxx CF_ZONE_ID=yyy  (Cloudflare token)');
  console.log('──────────────────────────────────────────────────────────\n');
  // Exit 0 so CI doesn't fail — DNS may already be set correctly
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ DNS setup error:', err.message);
  process.exit(0); // non-fatal in CI
});

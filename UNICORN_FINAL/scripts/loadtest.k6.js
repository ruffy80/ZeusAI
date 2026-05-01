// loadtest.k6.js — basic k6 load profile for ZeusAI public endpoints.
// Run with: k6 run scripts/loadtest.k6.js --env BASE=https://zeusai.pro
// RO+EN: profil minimal de încărcare; pentru CI se rulează săptămânal manual sau on-demand.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'https://zeusai.pro';

export const options = {
  stages: [
    { duration: '15s', target: 10 },
    { duration: '60s', target: 50 },
    { duration: '30s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.01']
  }
};

export default function () {
  const homeRes = http.get(`${BASE}/`);
  check(homeRes, { 'home 200': (r) => r.status === 200 });

  const healthRes = http.get(`${BASE}/health`);
  check(healthRes, { 'health 200': (r) => r.status === 200 });

  const servicesRes = http.get(`${BASE}/api/services/list`);
  check(servicesRes, {
    'services 200': (r) => r.status === 200,
    'services has list': (r) => /\"services\":\[/.test(r.body)
  });

  const btcRes = http.get(`${BASE}/api/btc/spot`);
  check(btcRes, { 'btc 200': (r) => r.status === 200 });

  const sitemapRes = http.get(`${BASE}/sitemap.xml`);
  check(sitemapRes, { 'sitemap 200': (r) => r.status === 200 });

  sleep(1);
}

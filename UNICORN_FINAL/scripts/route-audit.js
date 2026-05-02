'use strict';

const http = require('http');

const SITE_PORT = Number(process.env.SITE_PORT || 3001);
const SITE_HOST = process.env.SITE_HOST || '127.0.0.1';

const routes = [
  '/', '/services', '/pricing', '/checkout', '/dashboard', '/how', '/docs', '/about', '/legal', '/trust',
  '/security', '/responsible-ai', '/dpa', '/payment-terms', '/operator', '/observability', '/enterprise',
  '/store', '/innovations', '/account', '/admin/services', '/admin', '/admin/login', '/wizard', '/status',
  '/crypto-fiat-bridge', '/crypto-bridge', '/changelog', '/terms', '/privacy', '/refund', '/sla', '/pledge',
  '/cancel', '/gift', '/aura', '/api-explorer', '/transparency', '/frontier'
];

const placeholderMarkers = [
  'Waiting for input...',
  'Endpoint inventory will appear here.',
  'Bandit snapshot will appear here.',
  'Live metrics will appear here.',
  'Model registry will appear here.',
  'Incident timeline will appear here.',
  'Pledge summary will appear here.',
  'Signed promise will appear here.',
  'Frontier status will appear here.'
];

function request(pathname) {
  return new Promise((resolve) => {
    const req = http.request({ host: SITE_HOST, port: SITE_PORT, path: pathname, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const routeAttr = (body.match(/data-route="([^"]+)"/) || [])[1] || '';
        const title = (body.match(/<title>([^<]+)/i) || [])[1] || '';
        resolve({
          path: pathname,
          status: res.statusCode,
          location: res.headers.location || '',
          routeAttr,
          title,
          markers: placeholderMarkers.filter((marker) => body.includes(marker)),
        });
      });
    });
    req.on('error', (error) => resolve({ path: pathname, status: 0, location: '', routeAttr: '', title: '', markers: ['ERROR: ' + error.message] }));
    req.end();
  });
}

(async function run() {
  const results = [];
  for (const pathname of routes) results.push(await request(pathname));
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
})();

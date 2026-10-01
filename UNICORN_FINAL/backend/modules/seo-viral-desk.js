'use strict';

/**
 * SEO + viral desk — one honest JSON for every distribution organ.
 *
 * IndexNow, Search Console bridge, VUK, and gaze tokens already exist.
 * This desk does not start a second poster and does not invent visitors.
 * It names the exact secret or human tap that is still missing.
 */

const PROTOCOL = 'SVD/1.0';
const NAME = 'seo-viral-desk';

function desk() {
  let traffic = null;
  try {
    traffic = require('./traffic-engine').getStatus();
  } catch (_) { /* optional in unit isolation */ }

  let searchConsole = null;
  try {
    searchConsole = require('./search-console-bridge').getStatus();
  } catch (_) { /* optional */ }

  let activation = null;
  try {
    activation = require('../../src/commerce/world-index-os').activation();
  } catch (_) { /* optional */ }

  let visible = null;
  try {
    visible = require('./visible-social-os').getStatus();
  } catch (_) { /* optional */ }

  const engines = (traffic && traffic.lastSubmission && traffic.lastSubmission.engines) || [];
  const missing = (searchConsole && searchConsole.missingSecrets) || [];
  const bingOk = engines.some((e) => e && e.engine === 'bing' && e.ok);
  const yandexOk = engines.some((e) => e && e.engine === 'yandex' && e.ok);
  const gazeLit = (visible && visible.gazeLit) || (activation && activation.rows
    ? activation.rows.filter((r) => r.id && r.id.startsWith('gaze-') && r.armed).map((r) => r.id.slice(5))
    : []);

  const nextHumanAction = missing.length
    ? ('Add ' + missing.map((m) => m.secret).join(' and ') + ', then open /relay and send the $39 offer to one person.')
    : 'Open /relay and send the $39 offer to one person. Engines are already being notified; a ping is not a visitor.';

  return {
    ok: true,
    protocol: PROTOCOL,
    name: NAME,
    inventsVisitors: false,
    inventsUsers: false,
    inventsReach: false,
    inventsShares: false,
    inventsPosts: false,
    running: {
      indexNow: !!(traffic && traffic.running),
      searchConsoleBridge: !!(searchConsole && searchConsole.disabled === false),
      yandexLastOk: yandexOk,
      bingVerified: bingOk,
      googleNeedsSearchConsole: true,
    },
    missingSecrets: missing,
    gazeLit,
    gazeDark: ['facebook', 'x', 'instagram', 'tiktok', 'threads', 'linkedin'].filter((n) => !gazeLit.includes(n)),
    tokenless: { share: '/share', relay: '/relay', visibleWorld: '/visible-world' },
    pages: {
      seo: '/seo',
      activation: '/api/world-index/activation',
      traffic: '/api/traffic/status',
      worldIndex: '/.well-known/world-index.json',
      share: '/.well-known/share-surface.json',
      relay: '/.well-known/relay-graft.json',
      visible: '/.well-known/visible-social.json',
    },
    nextHumanAction,
    note: 'IndexNow notifies engines. Bing 403 means the host is not verified yet. Telegram/Discord are operator rails. Facebook/X/TikTok stay dark without their tokens. A module does not mint users.',
    searchConsole,
    traffic: traffic
      ? {
          running: traffic.running,
          host: traffic.host,
          indexNowKeyLocation: traffic.indexNowKeyLocation,
          urlInventory: traffic.urlInventory,
          lastSubmission: traffic.lastSubmission,
          outreach: traffic.outreach,
        }
      : null,
    activation,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { PROTOCOL, NAME, desk };

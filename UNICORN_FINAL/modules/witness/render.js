'use strict';

const { publicKeyBase64 } = require('./signer');

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function short(value) {
  const text = String(value || '');
  if (text.length <= 18) return text;
  return text.slice(0, 10) + '…' + text.slice(-6);
}

function page(title, body) {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
    + esc(title)
    + '</title><style>body{margin:0;background:#0b0f17;color:#eaf0ff;font:16px/1.5 ui-sans-serif,system-ui,sans-serif}main{max-width:820px;margin:0 auto;padding:32px 20px}a{color:#8eb6ff}code{font-family:ui-monospace,monospace;word-break:break-all}article{border:1px solid #243044;border-radius:12px;padding:16px;margin:16px 0}</style></head><body><main>'
    + body
    + '</main></body></html>';
}

function contractArticle(contract) {
  const payload = contract.payload || {};
  const offer = payload.offer_id
    ? '<a href="/offer/' + esc(payload.offer_id) + '">' + esc(payload.offer_id) + '</a>'
    : 'none';
  const file = payload.delivery_file_url
    ? '<a href="' + esc(payload.delivery_file_url) + '"><code>' + esc(short(payload.delivery_file_hash)) + '</code></a>'
    : (payload.delivery_file_hash ? '<code>' + esc(short(payload.delivery_file_hash)) + '</code>' : 'none');
  return '<article><h2>' + esc(payload.query_text) + '</h2>'
    + '<p>Clicks: ' + esc(payload.clicks) + '. Impressions: ' + esc(payload.impressions) + '.</p>'
    + '<p>Offer: ' + offer + '</p>'
    + '<p>Shelf price USD: ' + esc(payload.shelf_price_usd == null ? 'none' : payload.shelf_price_usd)
    + '. BTC: ' + esc(payload.shelf_price_btc == null ? 'none' : payload.shelf_price_btc)
    + '. Signed at: ' + esc(contract.signed_at) + '.</p>'
    + '<p>Delivery file: ' + file + '</p>'
    + '<p>Signature: <code>' + esc(short(contract.signature)) + '</code> <a href="/witness/' + esc(contract.id) + '.json">JSON</a></p>'
    + '</article>';
}

function renderHTML(contracts) {
  const pubkey = publicKeyBase64();
  const list = Array.isArray(contracts) ? contracts : [];
  if (!list.length) {
    return page('Witness Contracts — ZeusAI', [
      '<h1>Witness Contracts — ZeusAI</h1>',
      '<p>0 contracts signed. This page will populate only when Search Console returns real query rows. No data is fabricated.</p>',
      '<p>Public Ed25519 key:</p><p><code>' + esc(pubkey) + '</code></p>',
      '<p><a href="/witness.json">Machine-readable list</a></p>',
    ].join(''));
  }
  return page('Witness Contracts — ZeusAI', [
    '<h1>Witness Contracts — ZeusAI</h1>',
    '<p>' + list.length + ' contract' + (list.length === 1 ? '' : 's') + ' signed from Search Console rows.</p>',
    '<p>Public Ed25519 key:</p><p><code>' + esc(pubkey) + '</code></p>',
    list.map(contractArticle).join(''),
    '<p><a href="/witness.json">Machine-readable list</a></p>',
  ].join(''));
}

function renderOne(contract) {
  if (!contract) {
    return page('Witness not found', '<h1>Witness not found</h1><p>No contract is stored for that id.</p>');
  }
  return page(contract.payload.query_text + ' — Witness', contractArticle(contract) + '<p><a href="/witness">All contracts</a></p>');
}

module.exports = { renderHTML, renderOne };

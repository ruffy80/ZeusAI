'use strict';

const mesh = require('./index');
const { getReceipt } = require('./receipt');

function mount(app) {
  app.get('/api/snm/pubkey', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ pubkey: mesh.getPublicKey() });
  });

  app.get('/api/snm/receipt/:hash', (req, res) => {
    const row = getReceipt(req.params.hash);
    if (!row) return res.status(404).json({ ok: false, error: 'not_found' });
    const pub = row.signed ? Object.assign({}, row.signed) : null;
    if (pub && pub.payload) {
      pub.payload = Object.assign({}, pub.payload);
      delete pub.payload.email;
    }
    res.set('Cache-Control', 'no-store');
    res.json(Object.assign({}, row, { signed: pub }));
  });

  app.get('/api/snm/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(mesh.getStatus());
  });

  app.post('/api/snm/verify', (req, res) => {
    const body = req.body || {};
    const valid = mesh.verify({
      payload: body.payload,
      signature: body.signature,
      pubkey: body.pubkey,
      timestamp: body.timestamp,
      nonce: body.nonce,
    });
    res.set('Cache-Control', 'no-store');
    res.json({ valid: valid === true });
  });
}

module.exports = { mount };

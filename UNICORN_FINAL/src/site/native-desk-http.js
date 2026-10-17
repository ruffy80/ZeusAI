'use strict';

const desk = require('../../backend/modules/native-capability-desk');

function handle(req, urlPath, body) {
  if (urlPath === '/api/native-desk/status' && (!req.method || req.method === 'GET')) {
    return { status: 200, body: desk.status() };
  }
  if (urlPath === '/api/native-desk/assign' && req.method === 'POST') {
    const out = desk.assign(body || {});
    return { status: 200, body: out };
  }
  return { status: 404, body: { ok: false, error: 'native_desk_route_not_found' } };
}

module.exports = { handle };

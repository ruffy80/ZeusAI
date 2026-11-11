'use strict';

const clients = new Map();
let server = null;
let listening = false;

function port() {
  const n = Number(process.env.SNM_WS_PORT || 8081);
  return Number.isFinite(n) && n > 0 ? n : 8081;
}

function bindSocket(socket, userId) {
  const id = String(userId || '');
  if (!id) return;
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id).add(socket);
  socket.on('close', () => {
    const set = clients.get(id);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) clients.delete(id);
  });
}

function ensureServer() {
  if (server || listening) return;
  let WebSocketServer;
  try { WebSocketServer = require('ws').WebSocketServer; } catch (_) { return; }
  try {
    server = new WebSocketServer({ host: '127.0.0.1', port: port() });
  } catch (_) {
    server = null;
    return;
  }
  server.on('listening', () => { listening = true; });
  server.on('error', () => { listening = false; });
  server.on('connection', (socket) => {
    const timer = setTimeout(() => {
      try { socket.close(); } catch (_) { /* ignore */ }
    }, 2000);
    socket.once('message', (raw) => {
      clearTimeout(timer);
      let msg = null;
      try { msg = JSON.parse(String(raw)); } catch (_) { msg = null; }
      if (msg && msg.type === 'bind' && msg.userId) bindSocket(socket, msg.userId);
    });
  });
}

function send(signedNotification, userId) {
  ensureServer();
  const set = clients.get(String(userId || ''));
  if (!set || set.size === 0) return false;
  const body = JSON.stringify(signedNotification);
  let wrote = false;
  for (const socket of set) {
    if (socket.readyState !== 1) continue;
    try {
      socket.send(body);
      wrote = true;
    } catch (_) { /* that socket is gone */ }
  }
  return wrote;
}

function closeServer() {
  if (server) {
    try { server.close(); } catch (_) { /* ignore */ }
    server = null;
    listening = false;
  }
  clients.clear();
}

module.exports = { send, ensureServer, closeServer, port };

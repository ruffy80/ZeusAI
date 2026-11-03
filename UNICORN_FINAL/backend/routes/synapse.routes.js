// =====================================================================
// OWNERSHIP: Acest fișier este proprietatea exclusivă a lui Vladoi Ionut
// Email: vladoi_ionut@yahoo.com
// BTC Address: bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
// Data: 2026-11-03
// =====================================================================

'use strict';

let express = null;
try { express = require('express'); } catch (_) {}
const router = express && typeof express.Router === 'function' ? express.Router() : { get: () => {}, post: () => {}, use: () => {} };
const jsonParser = express && typeof express.json === 'function' ? express.json() : (req, res, next) => { if (next) next(); };

const { hyperMesh } = require('../modules/autonomousSynapticHyperMesh');

/**
 * Synaptic Hyper-Mesh API Router
 * Exposes live telemetry and autonomous corridor execution endpoints.
 */

// GET /api/synapse/status
router.get('/status', (req, res) => {
  res.json(hyperMesh.getStatus());
});

// GET /api/synapse/corridors
router.get('/corridors', (req, res) => {
  const status = hyperMesh.getStatus();
  res.json({
    ok: true,
    count: status.activeCorridorsCount,
    corridors: status.corridors,
  });
});

// GET /api/synapse/corridors/:id
router.get('/corridors/:id', (req, res) => {
  const corridor = hyperMesh.corridors.get(req.params.id);
  if (!corridor) return res.status(404).json({ ok: false, error: 'Corridor not found' });

  res.json({
    ok: true,
    corridor: {
      id: corridor.id,
      label: corridor.label,
      description: corridor.description,
      neurons: corridor.neurons,
    }
  });
});

// POST /api/synapse/run/:id
router.post('/run/:id', jsonParser, async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await hyperMesh.runCorridor(req.params.id, payload);
    res.json(result);
  } catch (err) {
    res.status(400).json({
      ok: false,
      corridor: req.params.id,
      error: err.message,
    });
  }
});

// GET /api/synapse/neurons
router.get('/neurons', (req, res) => {
  const q = req.query.q || '';
  const list = hyperMesh.getNeurons(q);
  res.json({
    ok: true,
    query: q,
    count: list.length,
    neurons: list.slice(0, 100), // bounded page
  });
});

// POST /api/synapse/pulse
router.post('/pulse', async (req, res) => {
  hyperMesh.pulseCount += 1;
  const status = hyperMesh.getStatus();
  res.json({
    ok: true,
    message: 'Synaptic pulse triggered manually',
    pulseCount: status.pulseCount,
    activeNeurons: status.totalNeurons,
  });
});

module.exports = router;

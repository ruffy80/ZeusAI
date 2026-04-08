import React, { useState } from 'react';
import axios from 'axios';

export default function AviationOps() {
  const [routeData, setRouteData] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [pricing, setPricing] = useState(null);

  const optimizeRoutes = async () => {
    const res = await axios.post('/api/aviation/optimize-routes', {
      airlineId: 'zeus-air',
      currentRoutes: [
        { routeId: 'OTP-DXB', origin: 'OTP', destination: 'DXB', frequency: 14, avgFare: 340, costPerFlight: 180 },
        { routeId: 'LHR-JFK', origin: 'LHR', destination: 'JFK', frequency: 21, avgFare: 620, costPerFlight: 310 }
      ],
      demandForecast: [{ demand: 0.78 }, { demand: 0.91 }],
      slotPressure: 0.68,
      fuelCostIndex: 1.12
    });
    setRouteData(res.data);
  };

  const runMaintenance = async () => {
    const res = await axios.post('/api/aviation/predictive-maintenance', {
      aircraft: [
        { id: 'A320-NEO-1', engineHealth: 0.74, cyclesSinceMaintenance: 640 },
        { id: 'B787-9-7', engineHealth: 0.58, cyclesSinceMaintenance: 920 }
      ]
    });
    setMaintenance(res.data);
  };

  const optimizePricing = async () => {
    const res = await axios.post('/api/aviation/ticket-pricing', {
      route: { routeId: 'OTP-DXB', monthlyPassengers: 125000, basePrice: 299 },
      demand: { current: 0.84 },
      competitors: [{ price: 289 }, { price: 315 }, { price: 305 }]
    });
    setPricing(res.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Aviation Ops</h1>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={optimizeRoutes} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#22d3ee', color: '#020617', fontWeight: 700 }}>Optimize Routes</button>
        <button onClick={runMaintenance} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Predict Maintenance</button>
        <button onClick={optimizePricing} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#22c55e', color: '#04130a', fontWeight: 700 }}>Optimize Ticket Pricing</button>
      </div>
      {[routeData, maintenance, pricing].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}

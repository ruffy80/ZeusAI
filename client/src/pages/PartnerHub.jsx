import React, { useState } from 'react';
import axios from 'axios';

export default function PartnerHub() {
  const [partner, setPartner] = useState(null);
  const [partnerRequest, setPartnerRequest] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [invoice, setInvoice] = useState(null);

  const bootstrapPartner = async () => {
    const registration = await axios.post('/api/enterprise/register', {
      partnerId: 'aws-enterprise',
      name: 'Amazon Web Services',
      template: 'aws'
    });

    const created = registration.data;
    setPartner(created);

    const headers = { 'x-api-key': created.apiKey };
    const [reqRes, dashRes, invoiceRes] = await Promise.all([
      axios.post('/api/partner/' + created.partnerId + '/aviation.optimize', { region: 'eu-central-1', aircraft: 28 }, { headers }),
      axios.get('/api/partner/' + created.partnerId + '/dashboard', { headers }),
      axios.get('/api/partner/' + created.partnerId + '/invoice/2026-03', { headers })
    ]);

    setPartnerRequest(reqRes.data);
    setDashboard(dashRes.data);
    setInvoice(invoiceRes.data);
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <h1 style={{ margin: 0 }}>Partner Console</h1>
      <button onClick={bootstrapPartner} style={{ width: 'fit-content', padding: '12px 18px', borderRadius: 14, border: 0, background: '#a855f7', color: '#fff', fontWeight: 700 }}>Register Demo Partner</button>
      {[partner, partnerRequest, dashboard, invoice].filter(Boolean).map((block, index) => (
        <pre key={index} style={{ margin: 0, padding: 20, borderRadius: 18, background: 'rgba(15,23,42,.7)', overflowX: 'auto', border: '1px solid rgba(148,163,184,.14)' }}>{JSON.stringify(block, null, 2)}</pre>
      ))}
    </div>
  );
}

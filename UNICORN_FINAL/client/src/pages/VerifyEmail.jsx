import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage('Token de verificare lipsă.'); return; }

    axios.get('/api/auth/verify-email?token=' + encodeURIComponent(token))
      .then(res => { setStatus('success'); setMessage(res.data.message || 'Email verificat cu succes!'); })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.error || 'Link invalid sau expirat.'); });
  }, [searchParams]);

  const card = { padding: 40, borderRadius: 24, background: 'rgba(15,23,42,.9)', border: '1px solid rgba(34,211,238,.25)', maxWidth: 440, margin: '100px auto', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,.5)' };

  return (
    <div style={card}>
      {status === 'loading' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h2 style={{ color: '#22d3ee' }}>Se verifică emailul...</h2>
        </>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#34d399', margin: '0 0 12px' }}>Email verificat!</h2>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>{message}</p>
          <Link to="/login" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, textDecoration: 'none' }}>
            Intră în cont
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 56, marginBottom: 16 }}>❌</div>
          <h2 style={{ color: '#f87171', margin: '0 0 12px' }}>Eroare verificare</h2>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>{message}</p>
          <Link to="/login" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 12, background: 'rgba(34,211,238,.15)', color: '#22d3ee', fontWeight: 700, textDecoration: 'none', border: '1px solid rgba(34,211,238,.3)' }}>
            Înapoi la Login
          </Link>
        </>
      )}
    </div>
  );
}

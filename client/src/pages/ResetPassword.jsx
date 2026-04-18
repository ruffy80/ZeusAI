import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';
  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) { toast.error('Parolele nu coincid!'); return; }
    if (newPassword.length < 8) { toast.error('Parola trebuie să aibă minim 8 caractere'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/reset-password', { token, newPassword });
      toast.success(res.data.message || 'Parola a fost resetată!');
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Eroare la resetare');
    } finally {
      setLoading(false);
    }
  };

  const card = { padding: 36, borderRadius: 24, background: 'rgba(15,23,42,.9)', border: '1px solid rgba(245,158,11,.25)', maxWidth: 420, margin: '80px auto', boxShadow: '0 8px 40px rgba(0,0,0,.5)' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.6)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginTop: 6 };
  const btn = { width: '100%', padding: '13px', borderRadius: 14, border: 0, background: 'linear-gradient(90deg,#f59e0b,#ef4444)', color: '#020617', fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8 };
  const label = { color: '#94a3b8', fontSize: 13, display: 'block', marginTop: 14 };

  if (done) {
    return (
      <div style={{ ...card, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: '#34d399' }}>Parolă resetată!</h2>
        <p style={{ color: '#94a3b8' }}>Ești redirecționat la login...</p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40 }}>🔐</div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 24, color: '#f59e0b' }}>Resetare Parolă</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Introdu noua ta parolă</p>
      </div>

      <form onSubmit={handleSubmit}>
        {!tokenFromUrl && (
          <>
            <label style={label}>Token de resetare</label>
            <input style={{ ...input, fontFamily: 'monospace', fontSize: 13 }} type="text" value={token} onChange={e => setToken(e.target.value)} placeholder="Token din email..." required />
          </>
        )}

        <label style={label}>Parolă nouă</label>
        <input style={input} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minim 8 caractere" required />

        <label style={label}>Confirmă parola nouă</label>
        <input style={input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetă parola" required />

        <button type="submit" style={btn} disabled={loading}>
          {loading ? 'Se resetează...' : '🔓 Confirmă parola nouă'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14 }}>
        <Link to="/login" style={{ color: '#64748b', textDecoration: 'none' }}>← Înapoi la login</Link>
      </div>
    </div>
  );
}

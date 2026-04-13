import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Autentificare reușită!');
      navigate('/dashboard-client');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credențiale invalide');
    } finally {
      setLoading(false);
    }
  };

  const card = { padding: 32, borderRadius: 24, background: 'rgba(15,23,42,.85)', border: '1px solid rgba(34,211,238,.25)', maxWidth: 420, margin: '80px auto', boxShadow: '0 8px 40px rgba(0,0,0,.5)' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.6)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginTop: 6 };
  const btn = { width: '100%', padding: '13px', borderRadius: 14, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8 };
  const label = { color: '#94a3b8', fontSize: 13, display: 'block', marginTop: 14 };

  return (
    <div style={card}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40 }}>✦</div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 26, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Zeus AI Login</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Intră în contul tău</p>
      </div>

      <form onSubmit={handleSubmit}>
        <label style={label}>Email</label>
        <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />

        <label style={label}>Parolă</label>
        <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />

        <button type="submit" style={btn} disabled={loading}>
          {loading ? 'Se autentifică...' : 'Autentificare'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, color: '#64748b', fontSize: 14 }}>
        Nu ai cont?{' '}
        <Link to="/register" style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: 600 }}>Înregistrează-te</Link>
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13 }}>
        <Link to="/admin/login" style={{ color: '#f59e0b', textDecoration: 'none' }}>🔐 Admin Login</Link>
      </div>
    </div>
  );
}

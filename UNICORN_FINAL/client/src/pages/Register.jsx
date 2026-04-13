import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { toast.error('Parolele nu coincid!'); return; }
    if (password.length < 8) { toast.error('Parola trebuie să aibă minim 8 caractere'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', { name, email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('Cont creat! Verifică emailul pentru confirmare.');
      navigate('/dashboard-client');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Eroare la înregistrare');
    } finally {
      setLoading(false);
    }
  };

  const card = { padding: 32, borderRadius: 24, background: 'rgba(15,23,42,.85)', border: '1px solid rgba(168,85,247,.25)', maxWidth: 420, margin: '60px auto', boxShadow: '0 8px 40px rgba(0,0,0,.5)' };
  const input = { width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.6)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box', outline: 'none', marginTop: 6 };
  const btn = { width: '100%', padding: '13px', borderRadius: 14, border: 0, background: 'linear-gradient(90deg,#a855f7,#22d3ee)', color: '#020617', fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 8 };
  const label = { color: '#94a3b8', fontSize: 13, display: 'block', marginTop: 14 };

  return (
    <div style={card}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 40 }}>🦄</div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 26, background: 'linear-gradient(90deg,#a855f7,#22d3ee)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Creează Cont Zeus AI</h1>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Alătură-te platformei autonome #1</p>
      </div>

      <form onSubmit={handleSubmit}>
        <label style={label}>Nume complet</label>
        <input style={input} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ion Popescu" required />

        <label style={label}>Email</label>
        <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />

        <label style={label}>Parolă</label>
        <input style={input} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minim 8 caractere" required />

        <label style={label}>Confirmă parola</label>
        <input style={input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repetă parola" required />

        <button type="submit" style={btn} disabled={loading}>
          {loading ? 'Se înregistrează...' : '🚀 Creează cont gratuit'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 20, color: '#64748b', fontSize: 14 }}>
        Ai deja cont?{' '}
        <Link to="/login" style={{ color: '#a855f7', textDecoration: 'none', fontWeight: 600 }}>Autentifică-te</Link>
      </div>
      <p style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
        Prin înregistrare, ești de acord cu Termenii și Condițiile Zeus AI.
      </p>
    </div>
  );
}

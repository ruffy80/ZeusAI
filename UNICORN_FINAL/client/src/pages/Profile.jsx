import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Profile() {
  const stored = JSON.parse(localStorage.getItem('user') || '{}');
  const [name, setName] = useState(stored.name || '');
  const [email, setEmail] = useState(stored.email || '');
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.put('/api/auth/profile', { name, email }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      localStorage.setItem('user', JSON.stringify(res.data.user));
      if (res.data.token) localStorage.setItem('token', res.data.token);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/forgot-password', { email: forgotEmail });
      toast.success(res.data.message);
      if (res.data.devToken) setResetToken(res.data.devToken);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Request failed');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/reset-password', { token: resetToken, newPassword });
      toast.success(res.data.message);
      setResetToken('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <section style={{ padding: 28, borderRadius: 28, background: 'rgba(15,23,42,.72)', border: '1px solid rgba(34,211,238,.18)' }}>
        <div style={{ color: '#22d3ee', textTransform: 'uppercase', letterSpacing: 2, fontSize: 13 }}>Account</div>
        <h1 style={{ margin: '8px 0 10px', fontSize: 42 }}>Profilul meu</h1>
        <p style={{ color: '#cbd5e1', maxWidth: 600 }}>Actualizează informațiile contului și gestionează securitatea accesului.</p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
          <h2 style={{ marginTop: 0 }}>Actualizare profil</h2>
          <form onSubmit={handleUpdate} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Nume</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading} style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Se actualizează...' : 'Actualizează'}
            </button>
          </form>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(148,163,184,.16)' }}>
            <h2 style={{ marginTop: 0 }}>Resetare parolă</h2>
            <form onSubmit={handleForgotPassword} style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Email cont</label>
                <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} type="email" placeholder="your@email.com" style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
              </div>
              <button type="submit" style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#f59e0b', color: '#020617', fontWeight: 700, cursor: 'pointer' }}>Trimite link reset</button>
            </form>
          </div>

          {resetToken && (
            <div style={{ padding: 22, borderRadius: 24, background: 'rgba(15,23,42,.55)', border: '1px solid rgba(248,113,113,.3)' }}>
              <h2 style={{ marginTop: 0 }}>Setează parola nouă</h2>
              <form onSubmit={handleResetPassword} style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Token reset</label>
                  <input value={resetToken} onChange={e => setResetToken(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', display: 'block', marginBottom: 6 }}>Parolă nouă</label>
                  <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" style={{ width: '100%', padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(2,6,23,.5)', color: '#f8fafc', fontSize: 15, boxSizing: 'border-box' }} />
                </div>
                <button type="submit" style={{ padding: '12px 18px', borderRadius: 14, border: 0, background: '#ef4444', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Confirmă parola nouă</button>
              </form>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

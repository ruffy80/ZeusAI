import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { password, twoFactorCode });
      if (res.data.success) {
        localStorage.setItem('adminToken', res.data.token);
        toast.success('Autentificare reușită!');
        navigate('/admin/dashboard');
      } else {
        toast.error(res.data.error || 'Autentificare eșuată');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Eroare la conectare');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/50 backdrop-blur p-8 rounded-2xl w-full max-w-md border border-cyan-500/30"
      >
        <h1 className="text-3xl font-bold text-center mb-6 neon-text">🔐 Admin Login</h1>
        <p className="text-center text-gray-400 mb-6">Autentificare proprietar – Vladoi Ionut</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-cyan-400 mb-2">Parolă Master</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Introdu parola ta"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-cyan-400 mb-2">Cod 2FA</label>
            <input
              type="text"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              className="w-full p-3 bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="Codul din Google Authenticator"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-black font-bold rounded-xl hover:opacity-90 transition"
          >
            {loading ? 'Se autentifică...' : 'Autentificare'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

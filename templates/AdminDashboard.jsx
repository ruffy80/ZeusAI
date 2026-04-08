import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function AdminDashboard() {
  const [status, setStatus] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [biometricSample, setBiometricSample] = useState('');
  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      navigate('/admin/login');
      return;
    }
    fetchStatus();
  }, [token, navigate]);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/auth/status', { headers: { 'x-auth-token': token } });
      setStatus(res.data);
    } catch (err) {
      localStorage.removeItem('adminToken');
      navigate('/admin/login');
    }
  };

  const handleLogout = async () => {
    await axios.post('/api/auth/logout', {}, { headers: { 'x-auth-token': token } });
    localStorage.removeItem('adminToken');
    toast.success('Delogare reușită');
    navigate('/admin/login');
  };

  const handleChangePassword = async () => {
    try {
      await axios.post('/api/auth/change-password', { oldPassword, newPassword }, { headers: { 'x-auth-token': token } });
      toast.success('Parolă schimbată cu succes');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Eroare');
    }
  };

  const handleEnrollBiometric = async () => {
    try {
      await axios.post('/api/auth/biometric/enroll', { sample: biometricSample }, { headers: { 'x-auth-token': token } });
      toast.success('Date biometrice înregistrate');
      setBiometricSample('');
      fetchStatus();
    } catch (err) {
      toast.error('Eroare la înregistrare');
    }
  };

  if (!status) return <div className="text-center p-12">Se încarcă...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold neon-text">👑 Admin Dashboard</h1>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-xl">Delogare</button>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 rounded-2xl p-6 mb-6 border border-cyan-500/30">
          <h2 className="text-2xl font-bold mb-4 text-cyan-400">👤 Proprietar</h2>
          <p><span className="text-gray-400">Nume:</span> {status.owner?.name}</p>
          <p><span className="text-gray-400">Email:</span> {status.owner?.email}</p>
          <p><span className="text-gray-400">Adresă BTC:</span> <code className="text-cyan-400">{status.owner?.btcAddress}</code></p>
          <p><span className="text-gray-400">Sesiuni active:</span> {status.activeSessions}</p>
          <p><span className="text-gray-400">Biometrie:</span> {status.biometricEnabled ? '✅ Activată' : '❌ Dezactivată'}</p>
        </motion.div>

        <div className="bg-gray-800/50 rounded-2xl p-6 mb-6 border border-cyan-500/30">
          <h2 className="text-2xl font-bold mb-4 text-cyan-400">🔐 Schimbare parolă</h2>
          <input type="password" placeholder="Parola veche" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full p-3 bg-gray-700 rounded-xl mb-3" />
          <input type="password" placeholder="Parola nouă" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full p-3 bg-gray-700 rounded-xl mb-3" />
          <button onClick={handleChangePassword} className="px-6 py-2 bg-cyan-500 text-black rounded-xl">Schimbă parola</button>
        </div>

        <div className="bg-gray-800/50 rounded-2xl p-6 mb-6 border border-cyan-500/30">
          <h2 className="text-2xl font-bold mb-4 text-cyan-400">🖐️ Înscriere biometrie (opțional)</h2>
          <p className="text-gray-400 text-sm mb-4">Poți înregistra o mostră biometrică pentru securitate suplimentară.</p>
          <input type="text" placeholder="Mostră biometrică" value={biometricSample} onChange={(e) => setBiometricSample(e.target.value)} className="w-full p-3 bg-gray-700 rounded-xl mb-3" />
          <button onClick={handleEnrollBiometric} className="px-6 py-2 bg-purple-500 text-white rounded-xl">Înregistrează biometrie</button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800/50 backdrop-blur rounded-2xl p-6 border border-yellow-500/30"
        >
          <h2 className="text-2xl font-bold mb-4 text-yellow-400">📧 Informații de contact</h2>
          <p className="text-gray-300">Toate notificările de securitate vor fi trimise la adresa:</p>
          <p className="text-xl font-mono text-yellow-400 mt-2">vladoi_ionut@yahoo.com</p>
          <p className="text-gray-400 text-sm mt-4">⚠️ Dacă nu primești notificări, verifică folderul SPAM sau configurează SMTP în .env.</p>
        </motion.div>
      </div>
    </div>
  );
}

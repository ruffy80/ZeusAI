
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/register', { name, email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success(t('register_success'));
      navigate('/dashboard-client');
    } catch (err) {
      toast.error(t('register_error'));
    } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 p-8 rounded-xl w-full max-w-md border border-cyan-500/30">
        <h2 className="text-3xl font-bold mb-6 text-center neon-text">{t('register')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4"><label className="block mb-2">{t('name')}</label><input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2 bg-gray-700 rounded" /></div>
          <div className="mb-4"><label className="block mb-2">{t('email')}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-2 bg-gray-700 rounded" /></div>
          <div className="mb-4"><label className="block mb-2">{t('password')}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-2 bg-gray-700 rounded" /></div>
          <div className="mb-6"><label className="block mb-2">{t('confirm_password')}</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full p-2 bg-gray-700 rounded" /></div>
          <button type="submit" disabled={loading} className="w-full py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400 transition">{loading ? t('loading') : t('register')}</button>
        </form>
        <p className="mt-4 text-center">{t('already_have_account')} <Link to="/login" className="text-cyan-400 hover:underline">{t('login')}</Link></p>
      </motion.div>
    </div>
  );
}

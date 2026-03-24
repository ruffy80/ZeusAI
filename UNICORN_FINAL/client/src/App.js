
import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeToggle from './components/ThemeToggle';
import Chatbot from './components/Chatbot';
import ParticlesBackground from './components/ParticlesBackground';
import Home from './pages/Home';
import Codex from './pages/Codex';
import Dashboard from './pages/Dashboard';
import Industries from './pages/Industries';
import Capabilities from './pages/Capabilities';
import Wealth from './pages/Wealth';
import AdminWealth from './pages/AdminWealth';
import AdminBD from './pages/AdminBD';
import Payment from './pages/Payment';
import LandingPageGenerator from './pages/LandingPageGenerator';
import ClientDashboard from './pages/ClientDashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import axios from 'axios';
import toast from 'react-hot-toast';

function App() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) setUser(JSON.parse(userData));
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out');
    navigate('/');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">{t('loading')}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 relative">
      <ParticlesBackground />
      <nav className="flex justify-between items-center p-6 border-b border-cyan-500/30 relative z-10">
        <div className="text-3xl font-bold neon-text">✦ ZEUS & AI ✦</div>
        <div className="flex items-center space-x-6">
          <Link to="/" className="hover:text-cyan-400">{t('nav_home')}</Link>
          <Link to="/codex" className="hover:text-cyan-400">{t('nav_codex')}</Link>
          <Link to="/dashboard" className="hover:text-cyan-400">{t('nav_dashboard')}</Link>
          <Link to="/industries" className="hover:text-cyan-400">{t('nav_industries')}</Link>
          <Link to="/capabilities" className="hover:text-cyan-400">{t('nav_capabilities')}</Link>
          <Link to="/wealth" className="hover:text-cyan-400">{t('nav_wealth')}</Link>
          <Link to="/payment" className="hover:text-cyan-400">Buy BTC</Link>
          <Link to="/generator" className="hover:text-cyan-400">{t('landing_page_generator')}</Link>
          {user && <Link to="/dashboard-client" className="hover:text-cyan-400">{t('client_dashboard')}</Link>}
          <Link to="/admin/wealth" className="text-yellow-400 hover:text-yellow-300">{t('nav_admin_wealth')}</Link>
          <Link to="/admin/bd" className="text-yellow-400 hover:text-yellow-300">{t('nav_admin_bd')}</Link>
          {user ? (
            <div className="flex items-center space-x-2">
              <span className="text-cyan-300">{user.name}</span>
              <button onClick={handleLogout} className="px-3 py-1 bg-red-500 text-white rounded text-sm">{t('logout')}</button>
            </div>
          ) : (
            <>
              <Link to="/login" className="hover:text-cyan-400">{t('login')}</Link>
              <Link to="/register" className="hover:text-cyan-400">{t('register')}</Link>
            </>
          )}
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/codex" element={<Codex />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/industries" element={<Industries />} />
        <Route path="/capabilities" element={<Capabilities />} />
        <Route path="/wealth" element={<Wealth />} />
        <Route path="/payment" element={<Payment />} />
        <Route path="/generator" element={<LandingPageGenerator />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard-client" element={user ? <ClientDashboard /> : <Navigate to="/login" />} />
        <Route path="/admin/wealth" element={<AdminWealth />} />
        <Route path="/admin/bd" element={<AdminBD />} />
      </Routes>
      <Chatbot />
    </div>
  );
}
export default App;

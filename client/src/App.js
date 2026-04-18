import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import ParticlesBackground3D from './components/ParticlesBackground3D';
import OrbitalNav from './components/OrbitalNav';
import QuantumLoader from './components/QuantumLoader';
import ScrollReveal from './components/ScrollReveal';
import NeonPulseButton from './components/NeonPulseButton';
import AnimatedDataStream from './components/AnimatedDataStream';
import LanguageSwitcher from './components/LanguageSwitcher';
import ThemeToggle from './components/ThemeToggle';
import Chatbot from './components/Chatbot';
import Home from './pages/Home';
import Codex from './pages/Codex';
import Dashboard from './pages/Dashboard';
import Industries from './pages/Industries';
import Capabilities from './pages/Capabilities';
import Wealth from './pages/Wealth';
import Marketplace from './pages/Marketplace';
import EnterpriseHub from './pages/EnterpriseHub';
import AviationOps from './pages/AviationOps';
import GovernmentOps from './pages/GovernmentOps';
import DefenseOps from './pages/DefenseOps';
import TelecomOps from './pages/TelecomOps';
import PartnerHub from './pages/PartnerHub';
import PaymentPage from './pages/PaymentPage';
import QuantumBlockchainPage from './pages/QuantumBlockchainPage';
import AIWorkforcePage from './pages/AIWorkforcePage';
import MAAdvisorPage from './pages/MAAdvisorPage';
import LegalContractsPage from './pages/LegalContractsPage';
import EnergyGridPage from './pages/EnergyGridPage';
import InnovationCommandCenter from './pages/InnovationCommandCenter';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';
import ClientDashboard from './pages/ClientDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ExecutiveDashboard from './pages/ExecutiveDashboard';
import UnicornLab from './pages/UnicornLab';
import LandingPageGenerator from './pages/LandingPageGenerator';
import AdminWealth from './pages/AdminWealth';
import AdminBD from './pages/AdminBD';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) setUser(JSON.parse(userData));
    setLoading(false);

    const interval = setInterval(() => {
      setHealthData(prev => [...prev.slice(-19), Math.random() * 100]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out');
    navigate('/');
  };

  if (loading) return <QuantumLoader loading={true} />;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#111827,#4c1d95,#0f172a)', position: 'relative', overflowX: 'hidden' }}>
      <ParticlesBackground3D />
      <QuantumLoader loading={false} />
      <Toaster position="top-right" />

      <header style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,.3)', borderBottom: '1px solid rgba(255,255,255,.1)' }}>
        <nav style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontSize: 28, fontWeight: 700, textDecoration: 'none', background: 'linear-gradient(90deg,#22d3ee,#a855f7)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            ✦ ZEUS & AI ✦
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {['/', '/codex', '/dashboard', '/industries', '/capabilities', '/wealth', '/marketplace', '/payments', '/enterprise', '/innovation', '/innovation/blockchain', '/innovation/workforce', '/innovation/ma', '/innovation/legal', '/innovation/energy'].map((path, i) => (
              <Link key={path} to={path} style={{ color: '#e2e8f0', textDecoration: 'none' }}>
                {['Home', 'Codex', 'Dashboard', 'Industries', 'Capabilities', 'Wealth', 'Marketplace', 'Payments', 'Enterprise', 'Innovation', 'Blockchain', 'Workforce', 'M&A', 'Legal', 'Energy'][i]}
              </Link>
            ))}
            <Link to="/admin/login" style={{ color: '#facc15', textDecoration: 'none' }}>🔐 Admin</Link>
            <Link to="/executive" style={{ color: '#22d3ee', textDecoration: 'none' }}>📊 Exec Dashboard</Link>
            <Link to="/unicorn-lab" style={{ color: '#a78bfa', textDecoration: 'none' }}>🦄 Lab</Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                <span style={{ color: '#67e8f9' }}>{user.name}</span>
                <NeonPulseButton onClick={() => navigate('/profile')} color="#22d3ee" className="!px-4 !py-1 !text-sm">Profile</NeonPulseButton>
                <NeonPulseButton onClick={handleLogout} color="#ff4444" className="!px-4 !py-1 !text-sm">Logout</NeonPulseButton>
              </>
            ) : (
              <>
                <NeonPulseButton onClick={() => navigate('/login')} className="!px-4 !py-1 !text-sm">Login</NeonPulseButton>
                <NeonPulseButton onClick={() => navigate('/register')} color="#ff44ff" className="!px-4 !py-1 !text-sm">Register</NeonPulseButton>
              </>
            )}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 24px' }}>
        <Routes>
          <Route path="/" element={<ScrollReveal><Home /></ScrollReveal>} />
          <Route path="/codex" element={<ScrollReveal delay={0.1}><Codex /></ScrollReveal>} />
          <Route path="/dashboard" element={<ScrollReveal delay={0.2}><Dashboard healthData={healthData} /></ScrollReveal>} />
          <Route path="/industries" element={<ScrollReveal delay={0.1}><Industries /></ScrollReveal>} />
          <Route path="/capabilities" element={<ScrollReveal delay={0.2}><Capabilities /></ScrollReveal>} />
          <Route path="/wealth" element={<ScrollReveal delay={0.1}><Wealth /></ScrollReveal>} />
          <Route path="/marketplace" element={<ScrollReveal delay={0.2}><Marketplace /></ScrollReveal>} />
          <Route path="/payments" element={<ScrollReveal delay={0.15}><PaymentPage /></ScrollReveal>} />
          <Route path="/enterprise" element={<ScrollReveal delay={0.1}><EnterpriseHub /></ScrollReveal>} />
          <Route path="/enterprise/aviation" element={<ScrollReveal delay={0.12}><AviationOps /></ScrollReveal>} />
          <Route path="/enterprise/government" element={<ScrollReveal delay={0.14}><GovernmentOps /></ScrollReveal>} />
          <Route path="/enterprise/defense" element={<ScrollReveal delay={0.16}><DefenseOps /></ScrollReveal>} />
          <Route path="/enterprise/telecom" element={<ScrollReveal delay={0.18}><TelecomOps /></ScrollReveal>} />
          <Route path="/enterprise/partners" element={<ScrollReveal delay={0.2}><PartnerHub /></ScrollReveal>} />
          <Route path="/innovation" element={<ScrollReveal delay={0.1}><InnovationCommandCenter /></ScrollReveal>} />
          <Route path="/innovation/blockchain" element={<ScrollReveal delay={0.12}><QuantumBlockchainPage /></ScrollReveal>} />
          <Route path="/innovation/workforce" element={<ScrollReveal delay={0.14}><AIWorkforcePage /></ScrollReveal>} />
          <Route path="/innovation/ma" element={<ScrollReveal delay={0.16}><MAAdvisorPage /></ScrollReveal>} />
          <Route path="/innovation/legal" element={<ScrollReveal delay={0.18}><LegalContractsPage /></ScrollReveal>} />
          <Route path="/innovation/energy" element={<ScrollReveal delay={0.2}><EnergyGridPage /></ScrollReveal>} />
          <Route path="/profile" element={user ? <ScrollReveal delay={0.1}><Profile /></ScrollReveal> : <Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard-client" element={user ? <ClientDashboard /> : <Navigate to="/login" />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/wealth" element={<AdminWealth />} />
          <Route path="/admin/bd" element={<AdminBD />} />
          <Route path="/executive" element={<ExecutiveDashboard />} />
          <Route path="/unicorn-lab" element={<UnicornLab />} />
          <Route path="/landing-generator" element={<LandingPageGenerator />} />
        </Routes>
      </main>

      <div style={{ position: 'fixed', left: 16, bottom: 16, width: 320, zIndex: 40 }}>
        <AnimatedDataStream data={healthData} title="Real-time Analytics" unit="%" />
      </div>

      <OrbitalNav />
      <Chatbot />
    </div>
  );
}

export default App;

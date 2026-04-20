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
import Services from './pages/Services';
import Pricing from './pages/Pricing';
import About from './pages/About';
import HowItWorks from './pages/HowItWorks';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import toast, { Toaster } from 'react-hot-toast';

function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const NAV_LINKS = [
    { to: '/', label: 'Home' },
    { to: '/services', label: 'Services' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/how-it-works', label: 'How It Works' },
    { to: '/about', label: 'About' },
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/dashboard', label: 'Dashboard' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', position: 'relative', overflowX: 'hidden' }}>
      <ParticlesBackground3D />
      <QuantumLoader loading={false} />
      <Toaster position="top-right" />

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(18px)',
        background: 'rgba(5,6,14,0.75)',
        borderBottom: '1px solid rgba(0,212,255,0.1)',
      }}>
        <nav style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '0 24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          height: 64,
        }}>
          {/* Logo */}
          <Link to="/" style={{
            fontSize: 22, fontWeight: 800, textDecoration: 'none',
            background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
            WebkitBackgroundClip: 'text', color: 'transparent',
            fontFamily: 'var(--font-heading)', letterSpacing: '0.06em',
            flexShrink: 0,
          }}>
            ✦ ZEUS & AI
          </Link>

          {/* Desktop nav links */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            '@media (max-width: 900px)': { display: 'none' },
          }} className="desktop-nav">
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} style={{
                color: '#94a3b8', textDecoration: 'none',
                fontSize: 13, fontFamily: 'var(--font-heading)',
                letterSpacing: '0.05em', padding: '6px 10px', borderRadius: 8,
                transition: 'color 0.2s, background 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#00d4ff'; e.currentTarget.style.background = 'rgba(0,212,255,0.07)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
              >
                {label}
              </Link>
            ))}
            <Link to="/admin/login" style={{ color: '#facc15', textDecoration: 'none', fontSize: 12, fontFamily: 'var(--font-heading)', padding: '6px 10px' }}>🔐 Admin</Link>
          </div>

          {/* Auth + utilities */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                <span style={{ color: '#67e8f9', fontSize: 13, fontFamily: 'var(--font-heading)' }}>{user.name}</span>
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
            {/* Hamburger */}
            <button
              onClick={() => setMobileNavOpen(o => !o)}
              style={{
                background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#94a3b8', cursor: 'pointer',
                padding: '6px 10px', fontSize: 18, lineHeight: 1,
                display: 'none',
              }}
              className="hamburger-btn"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? '✕' : '☰'}
            </button>
          </div>
        </nav>

        {/* Mobile nav dropdown */}
        {mobileNavOpen && (
          <div style={{
            background: 'rgba(5,6,14,0.97)',
            borderTop: '1px solid rgba(0,212,255,0.1)',
            padding: '1rem 24px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to} to={to}
                onClick={() => setMobileNavOpen(false)}
                style={{
                  color: '#94a3b8', textDecoration: 'none',
                  fontSize: 14, fontFamily: 'var(--font-heading)',
                  letterSpacing: '0.06em', padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ── MAIN ───────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px' }}>
        <Routes>
          <Route path="/" element={<ScrollReveal><Home /></ScrollReveal>} />
          <Route path="/services" element={<ScrollReveal delay={0.1}><Services /></ScrollReveal>} />
          <Route path="/pricing" element={<ScrollReveal delay={0.1}><Pricing /></ScrollReveal>} />
          <Route path="/about" element={<ScrollReveal delay={0.1}><About /></ScrollReveal>} />
          <Route path="/how-it-works" element={<ScrollReveal delay={0.1}><HowItWorks /></ScrollReveal>} />
          <Route path="/legal/terms" element={<ScrollReveal delay={0.1}><Terms /></ScrollReveal>} />
          <Route path="/legal/privacy" element={<ScrollReveal delay={0.1}><Privacy /></ScrollReveal>} />
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

      {/* ── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(0,212,255,0.08)',
        background: 'rgba(5,6,14,0.9)',
        backdropFilter: 'blur(12px)',
        padding: '3rem 24px 2rem',
        marginTop: '4rem',
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '2rem',
            marginBottom: '2.5rem',
          }}>
            {/* Brand */}
            <div>
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 20, fontWeight: 800,
                background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
                WebkitBackgroundClip: 'text', color: 'transparent',
                marginBottom: '0.75rem',
              }}>✦ ZEUS & AI</div>
              <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 0.75rem' }}>
                Autonomous AI platform for enterprise operations.
              </p>
              <div style={{ fontSize: 12, color: '#334155', fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>
                ₿ bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e
              </div>
            </div>

            {/* Platform */}
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: '#00d4ff', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>PLATFORM</div>
              {[
                { to: '/services', label: 'Services' },
                { to: '/pricing', label: 'Pricing' },
                { to: '/how-it-works', label: 'How It Works' },
                { to: '/marketplace', label: 'Marketplace' },
                { to: '/capabilities', label: 'Capabilities' },
              ].map(({ to, label }) => (
                <Link key={to} to={to} style={{ display: 'block', color: '#475569', textDecoration: 'none', fontSize: 13, marginBottom: 6, transition: 'color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
                >{label}</Link>
              ))}
            </div>

            {/* Company */}
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: '#c084fc', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>COMPANY</div>
              {[
                { to: '/about', label: 'About' },
                { to: '/codex', label: 'Codex' },
                { to: '/innovation', label: 'Innovation' },
                { to: '/enterprise', label: 'Enterprise' },
              ].map(({ to, label }) => (
                <Link key={to} to={to} style={{ display: 'block', color: '#475569', textDecoration: 'none', fontSize: 13, marginBottom: 6, transition: 'color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
                >{label}</Link>
              ))}
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, color: '#00ffa3', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>LEGAL</div>
              {[
                { to: '/legal/terms', label: 'Terms of Service' },
                { to: '/legal/privacy', label: 'Privacy Policy & GDPR' },
              ].map(({ to, label }) => (
                <Link key={to} to={to} style={{ display: 'block', color: '#475569', textDecoration: 'none', fontSize: 13, marginBottom: 6, transition: 'color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#475569'; }}
                >{label}</Link>
              ))}
            </div>
          </div>

          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.05)',
            paddingTop: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}>
            <div style={{ fontSize: 12, color: '#334155' }}>
              © {new Date().getFullYear()} ZEUS & AI · Vladoi Ionut · All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { to: '/legal/terms', label: 'Terms' },
                { to: '/legal/privacy', label: 'Privacy' },
              ].map(({ to, label }) => (
                <Link key={to} to={to} style={{ fontSize: 12, color: '#334155', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#64748b'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#334155'; }}
                >{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <div style={{ position: 'fixed', left: 16, bottom: 16, width: 320, zIndex: 40 }}>
        <AnimatedDataStream data={healthData} title="Real-time Analytics" unit="%" />
      </div>

      <OrbitalNav />
      <Chatbot />
    </div>
  );
}

export default App;

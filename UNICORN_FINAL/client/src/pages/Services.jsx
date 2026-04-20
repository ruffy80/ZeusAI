import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import SEOMeta from '../components/SEOMeta';
import PaymentModal from '../components/PaymentModal';

const CATEGORY_COLORS = {
  Revenue: '#00ffa3',
  Security: '#00d4ff',
  Enterprise: '#c084fc',
  Analytics: '#f59e0b',
  Compliance: '#34d399',
  Operations: '#60a5fa',
};

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [svcRes, catRes] = await Promise.all([
          axios.get('/api/marketplace/services').catch(() => ({ data: [] })),
          axios.get('/api/marketplace/categories').catch(() => ({ data: [] })),
        ]);
        const svcData = Array.isArray(svcRes.data) ? svcRes.data : (svcRes.data?.services || []);
        const catData = Array.isArray(catRes.data) ? catRes.data : (catRes.data?.categories || []);
        setServices(svcData.length ? svcData : FALLBACK_SERVICES);
        setCategories(catData.length ? catData : FALLBACK_CATEGORIES);
      } catch (err) {
        setError('Failed to load services. Showing default catalogue.');
        setServices(FALLBACK_SERVICES);
        setCategories(FALLBACK_CATEGORIES);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = activeCategory === 'All'
    ? services
    : services.filter(s => s.category === activeCategory);

  return (
    <>
      <SEOMeta
        title="AI Services Marketplace"
        description="Browse and activate 150+ enterprise AI services — revenue optimisation, compliance, security, analytics, and more."
        canonicalPath="/services"
      />

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ textAlign: 'center', padding: '4rem 0 3rem' }}
      >
        <div style={{
          display: 'inline-block',
          background: 'rgba(0,212,255,0.1)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 20,
          padding: '4px 16px',
          fontSize: 12,
          color: '#00d4ff',
          fontFamily: 'var(--font-heading)',
          letterSpacing: '0.12em',
          marginBottom: '1.25rem',
        }}>
          ✦ AI SERVICES MARKETPLACE
        </div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.8rem, 4vw, 3rem)',
          fontWeight: 900,
          color: '#f0f4ff',
          margin: '0 0 1rem',
        }}>
          150+ Enterprise{' '}
          <span style={{
            background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>AI Services</span>
        </h1>
        <p style={{ fontSize: 17, color: '#94a3b8', maxWidth: 560, margin: '0 auto' }}>
          Plug-and-play modules that activate in seconds. No infrastructure required.
        </p>
      </motion.section>

      {/* Category filter tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: '2rem',
        justifyContent: 'center',
      }}>
        {['All', ...categories].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              padding: '6px 18px',
              borderRadius: 20,
              border: '1px solid',
              borderColor: activeCategory === cat ? '#00d4ff' : 'rgba(255,255,255,0.1)',
              background: activeCategory === cat ? 'rgba(0,212,255,0.15)' : 'transparent',
              color: activeCategory === cat ? '#00d4ff' : '#94a3b8',
              fontSize: 13,
              fontFamily: 'var(--font-heading)',
              cursor: 'pointer',
              letterSpacing: '0.06em',
              transition: 'all 0.2s ease',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10,
          padding: '10px 16px',
          color: '#f59e0b',
          fontSize: 13,
          marginBottom: '1.5rem',
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '4rem' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          Loading services…
        </div>
      )}

      {/* Services grid */}
      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.25rem',
        }}>
          {filtered.map((svc, i) => {
            const catColor = CATEGORY_COLORS[svc.category] || '#00d4ff';
            return (
              <motion.div
                key={svc.id || i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                whileHover={{ y: -4 }}
                className="card-glow"
                style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span style={{
                    background: `${catColor}18`,
                    border: `1px solid ${catColor}40`,
                    borderRadius: 10,
                    padding: '2px 10px',
                    fontSize: 11,
                    color: catColor,
                    fontFamily: 'var(--font-heading)',
                    letterSpacing: '0.08em',
                  }}>
                    {svc.category || 'AI'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-heading)',
                    color: '#00ffa3',
                    fontSize: 15,
                    fontWeight: 700,
                  }}>
                    {svc.price ? `$${svc.price}/mo` : 'Free'}
                  </span>
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#e2e8f0',
                  margin: '0 0 0.6rem',
                }}>
                  {svc.name}
                </h3>
                <p style={{
                  fontSize: 14,
                  color: '#64748b',
                  lineHeight: 1.6,
                  flex: 1,
                  margin: '0 0 1.25rem',
                }}>
                  {svc.description}
                </p>
                <button
                  onClick={() => { setSelectedService(svc); setShowPayment(true); }}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Buy Now
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {showPayment && selectedService && (
        <PaymentModal
          service={selectedService}
          onClose={() => { setShowPayment(false); setSelectedService(null); }}
        />
      )}
    </>
  );
}

const FALLBACK_CATEGORIES = ['Revenue', 'Security', 'Enterprise', 'Analytics', 'Compliance', 'Operations'];

const FALLBACK_SERVICES = [
  { id: 1, name: 'AI Revenue Optimizer', description: 'ML-driven pricing, upsell timing, and churn prevention.', category: 'Revenue', price: 299 },
  { id: 2, name: 'Compliance Sentinel', description: 'Automated GDPR, SOC2, ISO 27001 compliance monitoring.', category: 'Compliance', price: 199 },
  { id: 3, name: 'Quantum Deal Analyzer', description: 'AI-powered M&A and deal analysis with risk scoring.', category: 'Enterprise', price: 499 },
  { id: 4, name: 'Real-time Analytics Engine', description: 'Live dashboards and anomaly detection across 200+ sources.', category: 'Analytics', price: 149 },
  { id: 5, name: 'QuantumVault Security', description: 'End-to-end encryption, threat detection, and zero-trust access.', category: 'Security', price: 249 },
  { id: 6, name: 'Autonomous Invoice AI', description: 'Fully automated accounts-receivable with zero human touch.', category: 'Operations', price: 99 },
  { id: 7, name: 'Multi-Tenant Orchestrator', description: 'Spin up isolated tenant environments with one API call.', category: 'Enterprise', price: 399 },
  { id: 8, name: 'Carbon Credit Engine', description: 'Track, offset, and report your enterprise carbon footprint.', category: 'Compliance', price: 179 },
  { id: 9, name: 'AI Workforce Planner', description: 'Intelligent headcount, skills-gap, and capacity forecasting.', category: 'Operations', price: 149 },
];

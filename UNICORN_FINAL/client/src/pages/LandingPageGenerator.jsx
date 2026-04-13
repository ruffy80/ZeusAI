import React, { useState } from 'react';
import NeonPulseButton from '../components/NeonPulseButton';

const TEMPLATES = [
  { id: 'saas', name: 'SaaS Product', icon: '🚀', desc: 'Landing page modernă pentru un produs SaaS cu pricing, features și CTA.' },
  { id: 'agency', name: 'Agenție AI', icon: '🤖', desc: 'Landing page premium pentru agenții de consultanță AI.' },
  { id: 'ecommerce', name: 'eCommerce', icon: '🛒', desc: 'Pagină de vânzare cu galerie produse, recenzii și checkout.' },
  { id: 'personal', name: 'Brand Personal', icon: '👤', desc: 'Portofoliu personal / thought leader cu testimoniale.' },
  { id: 'crypto', name: 'Crypto / Web3', icon: '₿', desc: 'Landing page pentru proiect crypto cu roadmap și tokenomics.' },
  { id: 'enterprise', name: 'Enterprise B2B', icon: '🏢', desc: 'Pagină corporativă cu cazuri de succes și formulare de contact.' },
];

const INITIAL_FORM = {
  templateId: '',
  companyName: '',
  tagline: '',
  primaryColor: '#7c3aed',
  accentColor: '#fbbf24',
  ctaText: 'Începe acum',
  features: '',
  pricing: '',
  language: 'ro',
};

const LandingPageGenerator = () => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState('');
  const [copied, setCopied] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const generate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1800));
    const t = TEMPLATES.find(t => t.id === form.templateId) || TEMPLATES[0];
    const html = buildHTML(form, t);
    setPreview(html);
    setStep(3);
    setGenerating(false);
  };

  const buildHTML = (f, t) => `<!DOCTYPE html>
<html lang="${f.language}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${f.companyName || 'Landing Page'} – ${f.tagline || t.name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', sans-serif; background: #050010; color: #e2e8f0; min-height: 100vh; }
    .hero { background: radial-gradient(ellipse at 50% 0%, ${f.primaryColor}33, transparent 60%);
      text-align:center; padding: 100px 20px 80px; }
    .hero h1 { font-size: clamp(2rem, 6vw, 4rem); font-weight: 900;
      background: linear-gradient(135deg, ${f.accentColor}, ${f.primaryColor});
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 20px; }
    .hero p { font-size: 1.2rem; color: #94a3b8; max-width: 600px; margin: 0 auto 40px; }
    .btn { display: inline-block; background: linear-gradient(135deg, ${f.primaryColor}, ${f.accentColor});
      color: white; padding: 14px 36px; border-radius: 50px; font-size: 1rem; font-weight: 700;
      text-decoration: none; cursor: pointer; border: none;
      box-shadow: 0 0 30px ${f.primaryColor}88; transition: transform 0.2s; }
    .btn:hover { transform: scale(1.05); }
    .features { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;
      padding: 80px 20px; max-width: 1100px; margin: 0 auto; }
    .feature-card { background: rgba(255,255,255,0.04); border: 1px solid ${f.primaryColor}44;
      border-radius: 16px; padding: 28px; max-width: 300px; flex: 1 1 260px; }
    .feature-card h3 { color: ${f.accentColor}; margin-bottom: 10px; }
    footer { text-align:center; padding: 40px 20px; color: #475569; font-size: 0.85rem;
      border-top: 1px solid ${f.primaryColor}22; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>${f.companyName || 'ZEUS AI'}</h1>
    <p>${f.tagline || t.desc}</p>
    <a href="#contact" class="btn">${f.ctaText}</a>
  </section>
  <section class="features">
    ${(f.features || 'Inovație,Autonomie,Scalabilitate').split(',').map(feat => `
    <div class="feature-card">
      <h3>✦ ${feat.trim()}</h3>
      <p style="color:#94a3b8;font-size:0.9rem">Sistem avansat de ${feat.trim().toLowerCase()} alimentat de inteligență artificială.</p>
    </div>`).join('')}
  </section>
  ${f.pricing ? `<section style="text-align:center;padding:60px 20px">
    <h2 style="color:${f.accentColor};margin-bottom:30px">Prețuri</h2>
    <p style="color:#94a3b8">${f.pricing}</p>
  </section>` : ''}
  <footer>
    <p>© ${new Date().getFullYear()} ${f.companyName || 'ZEUS AI'} – Powered by Unicorn AI Platform</p>
  </footer>
</body>
</html>`;

  const copyCode = () => {
    navigator.clipboard.writeText(preview).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const download = () => {
    const blob = new Blob([preview], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${form.companyName || 'landing'}-page.html`;
    a.click();
  };

  return (
    <div style={{ minHeight: '100vh', padding: '80px 20px 40px', background: 'radial-gradient(ellipse at 20% 0%, #1a0a3a, #050010)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', fontSize: 32, fontWeight: 800, marginBottom: 8,
          background: 'linear-gradient(135deg, #fbbf24, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🚀 Landing Page Generator
        </h1>
        <p style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 40 }}>
          Generează o pagină de destinație completă în câteva secunde, alimentată de AI.
        </p>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 40 }}>
          {['Template', 'Configurare', 'Preview'].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step > i + 1 ? '#22c55e' : step === i + 1 ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                color: 'white', fontSize: 12, fontWeight: 700,
              }}>{step > i + 1 ? '✓' : i + 1}</div>
              <span style={{ color: step === i + 1 ? '#a78bfa' : '#475569', fontSize: 13 }}>{s}</span>
              {i < 2 && <div style={{ width: 30, height: 1, background: '#7c3aed44' }} />}
            </div>
          ))}
        </div>

        {/* Step 1: Template Selection */}
        {step === 1 && (
          <div>
            <h2 style={{ color: '#e2e8f0', marginBottom: 20, textAlign: 'center' }}>Alege un template</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
              {TEMPLATES.map(t => (
                <div key={t.id}
                  onClick={() => { update('templateId', t.id); setStep(2); }}
                  style={{
                    background: form.templateId === t.id ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${form.templateId === t.id ? '#7c3aed' : 'rgba(124,58,237,0.2)'}`,
                    borderRadius: 14, padding: '20px 18px', cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{t.icon}</div>
                  <div style={{ color: '#e2e8f0', fontWeight: 700, marginBottom: 6 }}>{t.name}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 2 && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #7c3aed44', borderRadius: 16, padding: 32 }}>
            <h2 style={{ color: '#e2e8f0', marginBottom: 24 }}>Configurează pagina</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {[
                { label: 'Nume companie', key: 'companyName', placeholder: 'ZEUS AI' },
                { label: 'Tagline / Subtitlu', key: 'tagline', placeholder: 'Transformă viitorul cu AI' },
                { label: 'Text CTA', key: 'ctaText', placeholder: 'Începe acum' },
                { label: 'Limbă', key: 'language', type: 'select', options: ['ro', 'en', 'fr', 'de', 'es'] },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>{field.label}</label>
                  {field.type === 'select' ? (
                    <select value={form[field.key]} onChange={e => update(field.key, e.target.value)}
                      style={{ width: '100%', background: '#0f0a1f', border: '1px solid #7c3aed44', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }}>
                      {field.options.map(o => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                    </select>
                  ) : (
                    <input value={form[field.key]} onChange={e => update(field.key, e.target.value)} placeholder={field.placeholder}
                      style={{ width: '100%', background: '#0f0a1f', border: '1px solid #7c3aed44', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }} />
                  )}
                </div>
              ))}
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>Culoare primară</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="color" value={form.primaryColor} onChange={e => update('primaryColor', e.target.value)}
                    style={{ width: 44, height: 44, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                  <span style={{ color: '#e2e8f0', alignSelf: 'center', fontSize: 13 }}>{form.primaryColor}</span>
                </div>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>Culoare accent</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="color" value={form.accentColor} onChange={e => update('accentColor', e.target.value)}
                    style={{ width: 44, height: 44, border: 'none', borderRadius: 8, cursor: 'pointer' }} />
                  <span style={{ color: '#e2e8f0', alignSelf: 'center', fontSize: 13 }}>{form.accentColor}</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>Features (separate prin virgulă)</label>
              <input value={form.features} onChange={e => update('features', e.target.value)}
                placeholder="Automatizare, Scalabilitate, Securitate, ROI garantat"
                style={{ width: '100%', background: '#0f0a1f', border: '1px solid #7c3aed44', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14 }} />
            </div>
            <div style={{ marginTop: 20 }}>
              <label style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginBottom: 6 }}>Informații prețuri (opțional)</label>
              <textarea value={form.pricing} onChange={e => update('pricing', e.target.value)}
                placeholder="Plan Starter: $29/lună | Plan Pro: $99/lună | Enterprise: Contact"
                rows={3}
                style={{ width: '100%', background: '#0f0a1f', border: '1px solid #7c3aed44', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 14, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button onClick={() => setStep(1)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #7c3aed44', color: '#94a3b8', borderRadius: 10, padding: '10px 24px', cursor: 'pointer' }}>
                ← Înapoi
              </button>
              <NeonPulseButton onClick={generate} disabled={generating}>
                {generating ? '⚙️ Generez...' : '✨ Generează Pagina'}
              </NeonPulseButton>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(1)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #7c3aed44', color: '#94a3b8', borderRadius: 10, padding: '8px 20px', cursor: 'pointer' }}>
                🔄 Nou
              </button>
              <button onClick={copyCode}
                style={{ background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(124,58,237,0.2)', border: `1px solid ${copied ? '#22c55e44' : '#7c3aed44'}`, color: copied ? '#22c55e' : '#a78bfa', borderRadius: 10, padding: '8px 20px', cursor: 'pointer' }}>
                {copied ? '✓ Copiat!' : '📋 Copiază HTML'}
              </button>
              <button onClick={download}
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid #fbbf2444', color: '#fbbf24', borderRadius: 10, padding: '8px 20px', cursor: 'pointer' }}>
                ⬇️ Descarcă
              </button>
            </div>
            <div style={{ border: '2px solid #7c3aed44', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: '#1a0a3a', padding: '8px 16px', display: 'flex', gap: 6 }}>
                {['#ef4444', '#fbbf24', '#22c55e'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                <span style={{ color: '#475569', fontSize: 12, marginLeft: 8 }}>Preview – {form.companyName || 'Landing Page'}</span>
              </div>
              <iframe
                srcDoc={preview}
                style={{ width: '100%', height: 600, border: 'none', display: 'block' }}
                title="Landing Page Preview"
                sandbox="allow-scripts"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPageGenerator;

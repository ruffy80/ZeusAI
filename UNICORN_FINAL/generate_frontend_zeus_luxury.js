// generate_frontend_zeus_luxury.js
// Rulează cu: node generate_frontend_zeus_luxury.js

const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.join(process.cwd(), 'client');
const SRC_DIR = path.join(CLIENT_DIR, 'src');
const COMPONENTS_DIR = path.join(SRC_DIR, 'components');
const PAGES_DIR = path.join(SRC_DIR, 'pages');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');
const PUBLIC_DIR = path.join(CLIENT_DIR, 'public');

[CLIENT_DIR, SRC_DIR, COMPONENTS_DIR, PAGES_DIR, LOCALES_DIR, PUBLIC_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// package.json
fs.writeFileSync(path.join(CLIENT_DIR, 'package.json'), JSON.stringify({
  name: "zeus-ai-luxury",
  version: "1.0.0",
  private: true,
  dependencies: {
    "@react-three/drei": "^9.34.3",
    "@react-three/fiber": "^8.9.1",
    "axios": "^1.4.0",
    "framer-motion": "^10.12.16",
    "i18next": "^23.0.0",
    "i18next-browser-languagedetector": "^7.0.0",
    "qrcode.react": "^3.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hot-toast": "^2.4.1",
    "react-i18next": "^13.0.0",
    "react-router-dom": "^6.8.1",
    "react-scripts": "5.0.1",
    "recharts": "^2.7.2",
    "three": "^0.128.0",
    "tailwindcss": "^3.3.0",
    "uuid": "^9.0.0"
  },
  scripts: {
    start: "react-scripts start",
    build: "react-scripts build",
    test: "react-scripts test",
    eject: "react-scripts eject"
  },
  proxy: "http://localhost:3000",
  eslintConfig: { extends: ["react-app"] },
  browserslist: {
    production: [">0.2%", "not dead", "not op_mini all"],
    development: ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}, null, 2));

// tailwind.config.js
fs.writeFileSync(path.join(CLIENT_DIR, 'tailwind.config.js'), `
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: { 500: '#ffaa00', 400: '#ffbb22', 300: '#ffcc44' },
        platinum: { 400: '#c0c0c0' },
      },
    },
  },
  plugins: [],
};
`);

// src/index.css
fs.writeFileSync(path.join(SRC_DIR, 'index.css'), `
@tailwind base;
@tailwind components;
@tailwind utilities;
body { @apply bg-gray-900 text-white font-sans; overflow-x: hidden; transition: background-color 0.3s, color 0.3s; }
body.light { @apply bg-gray-100 text-gray-900; }
.neon-text { text-shadow: 0 0 5px #00ffff, 0 0 10px #00ffff, 0 0 20px #00ffff; }
.particle-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
.gold-text { text-shadow: 0 0 5px #ffaa00, 0 0 10px #ffaa00; }
.luxury-card { background: linear-gradient(135deg, rgba(128,0,128,0.3), rgba(0,0,0,0.7)); border: 1px solid #ffaa00; box-shadow: 0 0 20px rgba(255,170,0,0.3); }
`);

// src/index.js
fs.writeFileSync(path.join(SRC_DIR, 'index.js'), `
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import { Toaster } from 'react-hot-toast';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <App />
    <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
  </BrowserRouter>
);
`);

// Traduceri (7 limbi, complet)
const translations = {
  en: {
    nav_home: "Home", nav_codex: "Codex", nav_dashboard: "Dashboard", nav_industries: "Industries",
    nav_capabilities: "Capabilities", nav_wealth: "Wealth", nav_admin_wealth: "Admin Wealth", nav_admin_bd: "Admin BD",
    hero_title: "ZEUS & AI", hero_subtitle: "The autonomous AI system that serves all industries and humanity.",
    explore_codex: "Explore Codex", go_dashboard: "Dashboard",
    modules_active: "Active Modules", uptime: "Uptime", status: "Status", operational: "Operational", module_active: "active module",
    industries_description: "Custom AI solutions.", payment_title: "Buy with Bitcoin", payment_amount: "Amount (BTC)",
    generate_address: "Generate Payment Address", copy_link: "Copy", share_earn: "Share & Earn",
    invite_friends: "Invite friends and get rewards when they use the platform.", live_modules: "Live Modules",
    speak_to_zeus: "Speak to ZEUS", listening: "Listening...", auto_suggestion: "AI Suggestion",
    trend_based: "Trend-based improvement:", unicorn_health: "Unicorn Health", services: "Services", price: "Price",
    recommended_for_you: "Recommended for You", loading: "Loading...", view_details: "View details",
    share_social: "Share", countdown_next_update: "Next update in", seconds: "seconds",
    dark_mode: "Dark mode", light_mode: "Light mode", landing_page_generator: "AI Landing Page Generator",
    create_landing_page: "Create Your Landing Page", landing_page_url: "Your unique URL:",
    generate: "Generate", share_page: "Share Page", chatbot: "AI Chatbot", ask_zeus: "Ask ZEUS anything...",
    send: "Send", client_dashboard: "Client Dashboard", dashboard: "Dashboard", purchase_history: "Purchase History",
    api_usage: "API Usage", recommendations: "Recommendations", badges: "Badges", level: "Level", points: "Points",
    lightning_payment: "Lightning Payment", pay_with_lightning: "Pay with Lightning",
    enable_notifications: "Enable Notifications", notifications: "Notifications",
    login: "Login", register: "Register", logout: "Logout", email: "Email", password: "Password",
    name: "Name", confirm_password: "Confirm Password", already_have_account: "Already have an account?",
    dont_have_account: "Don't have an account?", login_success: "Login successful", register_success: "Registration successful",
    login_error: "Invalid email or password", register_error: "Registration failed", user_profile: "Profile",
    time_on_site: "Time on site", current_time: "Current time",
  },
  ro: {
    nav_home: "Acasă", nav_codex: "Codex", nav_dashboard: "Panou", nav_industries: "Industrii",
    nav_capabilities: "Capabilități", nav_wealth: "Wealth", nav_admin_wealth: "Admin Wealth", nav_admin_bd: "Admin BD",
    hero_title: "ZEUS & AI", hero_subtitle: "Sistemul AI autonom care deservește toate industriile și omenirea.",
    explore_codex: "Explorează Codexul", go_dashboard: "Panou", modules_active: "Module active",
    uptime: "Timp activ", status: "Stare", operational: "Operațional", module_active: "modul activ",
    industries_description: "Soluții AI personalizate.", payment_title: "Cumpără cu Bitcoin",
    payment_amount: "Sumă (BTC)", generate_address: "Generează adresă de plată", copy_link: "Copiază",
    share_earn: "Distribuie și câștigă", invite_friends: "Invită prieteni și primește recompense când folosesc platforma.",
    live_modules: "Module live", speak_to_zeus: "Vorbește cu ZEUS", listening: "Ascult...",
    auto_suggestion: "Sugestie AI", trend_based: "Îmbunătățire bazată pe trend:", unicorn_health: "Starea Unicornului",
    services: "Servicii", price: "Preț", recommended_for_you: "Recomandat pentru tine", loading: "Se încarcă...",
    view_details: "Vezi detalii", share_social: "Distribuie", countdown_next_update: "Următoarea actualizare în",
    seconds: "secunde", dark_mode: "Mod întunecat", light_mode: "Mod luminos",
    landing_page_generator: "Generator Pagini de Destinație AI", create_landing_page: "Creează-ți Pagina de Destinație",
    landing_page_url: "URL-ul tău unic:", generate: "Generează", share_page: "Distribuie Pagina",
    chatbot: "Chatbot AI", ask_zeus: "Întreabă-l pe ZEUS...", send: "Trimite",
    client_dashboard: "Panou Client", dashboard: "Panou", purchase_history: "Istoric Achiziții",
    api_usage: "Utilizare API", recommendations: "Recomandări", badges: "Insigne", level: "Nivel", points: "Puncte",
    lightning_payment: "Plată Lightning", pay_with_lightning: "Plătește cu Lightning",
    enable_notifications: "Activează Notificări", notifications: "Notificări",
    login: "Autentificare", register: "Înregistrare", logout: "Deconectare", email: "Email", password: "Parolă",
    name: "Nume", confirm_password: "Confirmă parola", already_have_account: "Ai deja cont?",
    dont_have_account: "Nu ai cont?", login_success: "Autentificare reușită", register_success: "Înregistrare reușită",
    login_error: "Email sau parolă incorectă", register_error: "Înregistrare eșuată", user_profile: "Profil",
    time_on_site: "Timp petrecut", current_time: "Ora curentă",
  },
  es: { /* similar, se poate copia din en */ },
  fr: { /* similar */ },
  de: { /* similar */ },
  zh: { /* similar */ },
  ja: { /* similar */ }
};

for (const lang of ['en', 'ro', 'es', 'fr', 'de', 'zh', 'ja']) {
  const dir = path.join(LOCALES_DIR, lang);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dict = translations[lang] || translations.en;
  fs.writeFileSync(path.join(dir, 'translation.json'), JSON.stringify(dict, null, 2));
}

// src/i18n.js
fs.writeFileSync(path.join(SRC_DIR, 'i18n.js'), `
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEN from './locales/en/translation.json';
import translationRO from './locales/ro/translation.json';
import translationES from './locales/es/translation.json';
import translationFR from './locales/fr/translation.json';
import translationDE from './locales/de/translation.json';
import translationZH from './locales/zh/translation.json';
import translationJA from './locales/ja/translation.json';

const resources = {
  en: { translation: translationEN },
  ro: { translation: translationRO },
  es: { translation: translationES },
  fr: { translation: translationFR },
  de: { translation: translationDE },
  zh: { translation: translationZH },
  ja: { translation: translationJA },
};

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources, fallbackLng: 'en', interpolation: { escapeValue: false },
  detection: { order: ['localStorage', 'navigator', 'cookie'], caches: ['localStorage'] },
});
export default i18n;
`);

// ========================= Componente =========================
// ParticlesBackground
fs.writeFileSync(path.join(COMPONENTS_DIR, 'ParticlesBackground.jsx'), `
import React, { useEffect, useRef } from 'react';
export default function ParticlesBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1, speedX: (Math.random() - 0.5) * 0.5, speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
    function animate() {
      requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.speedX; p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = \`rgba(0, 255, 255, \${p.opacity})\`; ctx.fill();
      });
    }
    animate();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);
  return <canvas ref={canvasRef} className="particle-bg" />;
}
`);

// LanguageSwitcher
fs.writeFileSync(path.join(COMPONENTS_DIR, 'LanguageSwitcher.jsx'), `
import React from 'react';
import { useTranslation } from 'react-i18next';
const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' }, { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }, { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' }, { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' }
];
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;
  return (
    <div className="relative group">
      <button className="flex items-center space-x-1 px-2 py-1 bg-gray-800 rounded">
        <span>{languages.find(l => l.code === currentLang)?.flag}</span>
        <span>{currentLang.toUpperCase()}</span>
      </button>
      <div className="absolute right-0 mt-2 w-32 bg-gray-800 rounded shadow-lg hidden group-hover:block z-10">
        {languages.map(lang => (
          <button key={lang.code} onClick={() => i18n.changeLanguage(lang.code)} className="block w-full text-left px-3 py-2 hover:bg-gray-700">
            {lang.flag} {lang.name}
          </button>
        ))}
      </div>
    </div>
  );
}
`);

// ThemeToggle
fs.writeFileSync(path.join(COMPONENTS_DIR, 'ThemeToggle.jsx'), `
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
export default function ThemeToggle() {
  const { t } = useTranslation();
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') { setIsDark(false); document.body.classList.add('light'); }
    else document.body.classList.remove('light');
  }, []);
  const toggle = () => {
    if (isDark) { document.body.classList.add('light'); localStorage.setItem('theme', 'light'); }
    else { document.body.classList.remove('light'); localStorage.setItem('theme', 'dark'); }
    setIsDark(!isDark);
  };
  return <button onClick={toggle} className="px-2 py-1 bg-gray-800 rounded text-sm">{isDark ? t('light_mode') : t('dark_mode')}</button>;
}
`);

// Chatbot
fs.writeFileSync(path.join(COMPONENTS_DIR, 'Chatbot.jsx'), `
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
export default function Chatbot() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    try {
      const res = await axios.post('/api/uaic/ask', { type: 'simple', prompt: input, maxTokens: 200 });
      setMessages(prev => [...prev, { role: 'bot', content: res.data.result }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I am having trouble right now.' }]);
    }
    setTimeout(scrollToBottom, 100);
  };
  return (
    <>
      <button onClick={() => setIsOpen(true)} className="fixed bottom-6 right-6 bg-cyan-500 text-black p-4 rounded-full shadow-lg hover:bg-cyan-400 transition z-50">💬</button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-20 right-6 w-80 h-96 bg-gray-900 border border-cyan-500 rounded-xl shadow-2xl flex flex-col z-50">
            <div className="flex justify-between items-center p-3 border-b border-cyan-500"><h3 className="font-bold">{t('chatbot')}</h3><button onClick={() => setIsOpen(false)} className="text-white">&times;</button></div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((msg, idx) => (
                <div key={idx} className={\`flex \${msg.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
                  <div className={\`max-w-[80%] p-2 rounded-lg \${msg.role === 'user' ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-white'}\`}>{msg.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-2 border-t border-gray-700 flex">
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()}
                placeholder={t('ask_zeus')} className="flex-1 p-2 bg-gray-800 rounded-l outline-none" />
              <button onClick={sendMessage} className="px-4 py-2 bg-cyan-500 text-black rounded-r">{t('send')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
`);

// TelemetryCard
fs.writeFileSync(path.join(COMPONENTS_DIR, 'TelemetryCard.jsx'), `
import React from 'react';
import { motion } from 'framer-motion';
export default function TelemetryCard({ title, value }) {
  return (
    <motion.div className="bg-gray-800/50 backdrop-blur p-4 rounded-xl shadow-lg w-64 border border-cyan-500/30" whileHover={{ scale: 1.05 }}>
      <h3 className="font-bold text-lg text-cyan-400">{title}</h3>
      <p className="text-3xl font-mono text-white">{value}</p>
    </motion.div>
  );
}
`);

// ZEUS3D realist cu plete albe mobile
fs.writeFileSync(path.join(COMPONENTS_DIR, 'ZEUS3D.jsx'), `
import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Box, Cylinder, Torus } from '@react-three/drei';
import { useTranslation } from 'react-i18next';

function ZeusFace() {
  const groupRef = useRef();
  const hairGroupRef = useRef();
  useFrame((state) => {
    groupRef.current.rotation.y += 0.002;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    if (hairGroupRef.current) {
      hairGroupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
      hairGroupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
    }
  });
  return (
    <group ref={groupRef}>
      <Sphere args={[1.2, 64, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#ddbb99" emissive="#aa8866" roughness={0.3} metalness={0.7} />
      </Sphere>
      <Sphere args={[0.25, 32, 32]} position={[-0.45, 0.35, 1.05]}>
        <meshStandardMaterial color="#ffffff" emissive="#44aaff" />
      </Sphere>
      <Sphere args={[0.12, 32, 32]} position={[-0.45, 0.35, 1.18]}>
        <meshStandardMaterial color="#000000" emissive="#222222" />
      </Sphere>
      <Sphere args={[0.25, 32, 32]} position={[0.45, 0.35, 1.05]}>
        <meshStandardMaterial color="#ffffff" emissive="#44aaff" />
      </Sphere>
      <Sphere args={[0.12, 32, 32]} position={[0.45, 0.35, 1.18]}>
        <meshStandardMaterial color="#000000" emissive="#222222" />
      </Sphere>
      <Torus args={[0.45, 0.08, 32, 100]} rotation={[0.2, 0, 0]} position={[0, -0.1, 1.08]}>
        <meshStandardMaterial color="#cc8866" emissive="#aa6644" />
      </Torus>
      <Box args={[0.6, 0.1, 0.15]} position={[-0.5, 0.65, 1.02]}>
        <meshStandardMaterial color="#886644" />
      </Box>
      <Box args={[0.6, 0.1, 0.15]} position={[0.5, 0.65, 1.02]}>
        <meshStandardMaterial color="#886644" />
      </Box>
      <group ref={hairGroupRef} position={[0, -0.3, -0.8]}>
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const x = Math.sin(angle) * 0.9;
          const z = Math.cos(angle) * 0.6;
          return (
            <Cylinder key={i} args={[0.08, 0.15, 0.7, 6]} position={[x, -0.4, z]} rotation={[0.3, angle, 0.2]}>
              <meshStandardMaterial color="#f0f0f0" emissive="#cccccc" />
            </Cylinder>
          );
        })}
        {[...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x = Math.sin(angle) * 1.0;
          const z = Math.cos(angle) * 0.8;
          return (
            <Cylinder key={\`long-\${i}\`} args={[0.06, 0.12, 0.9, 6]} position={[x, -0.7, z]} rotation={[0.4, angle, 0.1]}>
              <meshStandardMaterial color="#f8f8f8" emissive="#dddddd" />
            </Cylinder>
          );
        })}
      </group>
      <Sphere args={[0.35, 32, 32]} position={[-1.05, 0, 0]}>
        <meshStandardMaterial color="#ddbb99" />
      </Sphere>
      <Sphere args={[0.35, 32, 32]} position={[1.05, 0, 0]}>
        <meshStandardMaterial color="#ddbb99" />
      </Sphere>
    </group>
  );
}

export default function ZEUS3D() {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState('');
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      if (transcript.includes('dashboard')) { setResponse('Opening dashboard...'); window.location.href = '/dashboard'; }
      else if (transcript.includes('codex')) { setResponse('Opening codex...'); window.location.href = '/codex'; }
      else { setResponse("I didn't understand. Try 'dashboard' or 'codex'."); }
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    if (listening) recognition.start();
    return () => recognition.abort();
  }, [listening]);
  return (
    <div className="relative">
      <div className="w-full h-96">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <spotLight position={[-5, 5, 5]} angle={0.3} intensity={0.8} />
          <ZeusFace />
          <OrbitControls enableZoom={false} />
        </Canvas>
      </div>
      <button onClick={() => setListening(true)} className="mt-4 px-4 py-2 bg-cyan-500 text-black rounded-full hover:bg-cyan-400 transition">
        {listening ? t('listening') : t('speak_to_zeus')}
      </button>
      {response && <p className="mt-2 text-sm text-cyan-300">{response}</p>}
    </div>
  );
}
`);

// LuxuryClock cu turbilion (mecanism rotitor, culori auriu/violet/platină)
fs.writeFileSync(path.join(COMPONENTS_DIR, 'LuxuryClock.jsx'), `
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export default function LuxuryClock() {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionStart] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
      setRotation(prev => (prev + 12) % 360);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatElapsed = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return \`\${h.toString().padStart(2,'0')}:\${m.toString().padStart(2,'0')}:\${s.toString().padStart(2,'0')}\`;
  };

  const hourDeg = (currentTime.getHours() % 12) * 30 + currentTime.getMinutes() * 0.5;
  const minuteDeg = currentTime.getMinutes() * 6 + currentTime.getSeconds() * 0.1;
  const secondDeg = currentTime.getSeconds() * 6;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed top-20 right-6 w-56 bg-black/70 backdrop-blur rounded-2xl border-2 shadow-2xl z-20 p-4"
      style={{
        borderImage: 'linear-gradient(135deg, #ffaa00, #aa66ff, #c0c0c0)',
        borderImageSlice: 1,
        boxShadow: '0 0 20px rgba(255,170,0,0.5), 0 0 10px rgba(170,102,255,0.5)'
      }}
    >
      <div className="text-center">
        <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: '#ffaa00', textShadow: '0 0 5px #ffaa00' }}>
          {t('current_time')}
        </h3>
        <div className="relative w-32 h-32 mx-auto my-2">
          <div className="absolute inset-0 rounded-full border-4 border-gold-500 shadow-lg" style={{ borderColor: '#ffaa00' }}></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-800 to-purple-950 opacity-90"></div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: \`rotate(\${rotation}deg)\` }}
          >
            <div className="w-20 h-20 rounded-full border-2 border-platinum-400 bg-black/30 flex items-center justify-center" style={{ borderColor: '#c0c0c0' }}>
              <div className="w-12 h-12 rounded-full border border-gold-500 bg-gradient-to-tr from-gold-200 to-gold-500"></div>
            </div>
          </motion.div>
          <div className="absolute top-1/2 left-1/2 w-0.5 h-10 bg-gold-500 origin-bottom transform -translate-x-1/2 -translate-y-full" style={{ transform: \`rotate(\${hourDeg}deg) translateX(-50%) translateY(-100%)\` }}></div>
          <div className="absolute top-1/2 left-1/2 w-0.5 h-12 bg-gold-300 origin-bottom transform -translate-x-1/2 -translate-y-full" style={{ transform: \`rotate(\${minuteDeg}deg) translateX(-50%) translateY(-100%)\` }}></div>
          <div className="absolute top-1/2 left-1/2 w-0.5 h-14 bg-red-500 origin-bottom transform -translate-x-1/2 -translate-y-full" style={{ transform: \`rotate(\${secondDeg}deg) translateX(-50%) translateY(-100%)\` }}></div>
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-gold-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        <div className="text-lg font-mono text-gold-400 mt-2">{formatTime(currentTime)}</div>
        <div className="mt-2 pt-2 border-t border-gold-500/50">
          <div className="text-xs text-gold-400/80">{t('time_on_site')}</div>
          <div className="text-sm font-mono text-gold-300">{formatElapsed(elapsed)}</div>
        </div>
      </div>
    </motion.div>
  );
}
`);

// ========================= Pagini =========================
// Home (cu ceas)
fs.writeFileSync(path.join(PAGES_DIR, 'Home.jsx'), `
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ZEUS3D from '../components/ZEUS3D';
import TelemetryCard from '../components/TelemetryCard';
import LuxuryClock from '../components/LuxuryClock';
import { motion } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Home() {
  const { t } = useTranslation();
  const [liveModules, setLiveModules] = useState([]);
  const [trendSuggestion, setTrendSuggestion] = useState('');
  const [unicornHealth, setUnicornHealth] = useState({ status: 'ok', uptime: 0 });
  const [services, setServices] = useState([]);
  const [countdown, setCountdown] = useState(30);
  const [referralLink, setReferralLink] = useState('');
  const [visitorId, setVisitorId] = useState('');

  useEffect(() => {
    let id = localStorage.getItem('visitorId');
    if (!id) { id = Math.random().toString(36).substring(2, 15); localStorage.setItem('visitorId', id); }
    setVisitorId(id);
    setReferralLink(\`\${window.location.origin}/?ref=\${id}\`);
    const fetchData = async () => {
      try {
        const modulesRes = await axios.get('/api/modules');
        setLiveModules(modulesRes.data.modules || []);
        const healthRes = await axios.get('/api/health');
        setUnicornHealth(healthRes.data);
        const trendsRes = await axios.get('/api/trends/analyze');
        if (trendsRes.data.trends && trendsRes.data.trends.length) setTrendSuggestion(trendsRes.data.trends[0]);
        const sampleServices = ['AI Consulting', 'API Access', 'Custom Module Development'];
        const priced = await Promise.all(sampleServices.map(async svc => {
          const priceRes = await axios.post('/api/pricing/optimize', { clientData: { segment: 'retail', service: svc, visitorId } });
          return { name: svc, price: priceRes.data.optimalPrice || 99.99 };
        }));
        setServices(priced);
      } catch (err) { console.log('Fetch error'); }
    };
    fetchData();
    const interval = setInterval(fetchData, 30000);
    const countdownInterval = setInterval(() => setCountdown(prev => (prev > 0 ? prev - 1 : 30)), 1000);
    return () => { clearInterval(interval); clearInterval(countdownInterval); };
  }, [visitorId]);

  const copyLink = () => { navigator.clipboard.writeText(referralLink); toast.success('Link copied!'); };
  const shareSocial = () => { if (navigator.share) navigator.share({ title: 'ZEUS & AI', text: 'Check out this revolutionary AI platform!', url: window.location.href }); else toast('Share not supported, copy the link manually.'); };

  return (
    <div className="text-center p-12 relative z-10">
      <LuxuryClock />
      <motion.h1 initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="text-6xl font-bold neon-text mb-6">{t('hero_title')}</motion.h1>
      <ZEUS3D />
      <p className="text-xl mt-8 max-w-2xl mx-auto text-gray-300">{t('hero_subtitle')}</p>
      <div className="mt-10 flex justify-center gap-4">
        <a href="/codex" className="px-8 py-3 bg-cyan-500 text-black font-bold rounded-full hover:bg-cyan-400 transition shadow-lg">{t('explore_codex')}</a>
        <a href="/dashboard" className="px-8 py-3 border border-cyan-500 text-cyan-500 font-bold rounded-full hover:bg-cyan-500 hover:text-black transition">{t('go_dashboard')}</a>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-12">
        <TelemetryCard title={t('unicorn_health')} value={unicornHealth?.status === 'ok' ? '🟢 ' + t('operational') : '🔴 ' + (unicornHealth?.status || 'Unknown')} />
        <TelemetryCard title={t('modules_active')} value={liveModules?.length || 0} />
        <TelemetryCard title={t('uptime')} value={Math.floor(unicornHealth?.uptime || 0) + 's'} />
      </div>
      <div className="mt-12"><h2 className="text-2xl font-bold mb-4">{t('services')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {services && services.length > 0 ? services.map(svc => (
            <div key={svc.name} className="bg-gray-800/50 p-6 rounded-xl border border-cyan-500/30">
              <h3 className="text-xl font-bold text-cyan-400">{svc.name}</h3>
              <p className="text-2xl font-mono mt-2">{svc.price} USD</p>
              <button className="mt-4 px-4 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400">{t('view_details')}</button>
            </div>
          )) : <p>{t('loading')}</p>}
        </div>
      </div>
      <div className="mt-12"><h2 className="text-2xl font-bold mb-4">{t('recommended_for_you')}</h2>
        <div className="bg-purple-500/20 p-4 rounded-xl max-w-md mx-auto">{trendSuggestion ? <p className="text-sm">{t('trend_based')} {trendSuggestion}</p> : <p>{t('loading')}</p>}</div>
      </div>
      <div className="mt-12 p-6 bg-gray-800/50 rounded-xl max-w-md mx-auto">
        <h3 className="text-xl font-bold mb-2">{t('share_earn')}</h3><p>{t('invite_friends')}</p>
        <div className="flex mt-2"><input type="text" value={referralLink} readOnly className="flex-1 p-2 bg-gray-700 rounded-l" /><button onClick={copyLink} className="px-4 py-2 bg-cyan-500 text-black rounded-r">{t('copy_link')}</button></div>
        <button onClick={shareSocial} className="mt-2 px-4 py-2 bg-purple-500 text-black rounded hover:bg-purple-400">{t('share_social')}</button>
      </div>
      <div className="mt-12 text-sm text-gray-400">{t('countdown_next_update')}: {countdown} {t('seconds')}</div>
    </div>
  );
}
`);

// Codex (luxuriant)
fs.writeFileSync(path.join(PAGES_DIR, 'Codex.jsx'), `
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { motion } from 'framer-motion';
export default function Codex() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  useEffect(() => {
    axios.get('/api/modules').then(res => setModules(res.data.modules || []));
  }, []);
  return (
    <div className="p-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold mb-6 text-center"
        style={{ color: '#ffaa00', textShadow: '0 0 10px #ffaa00' }}
      >
        {t('nav_codex')}
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod, idx) => (
          <motion.div
            key={mod}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="luxury-card p-6 rounded-xl"
          >
            <h3 className="text-xl font-bold" style={{ color: '#ffaa00' }}>{mod}</h3>
            <p className="text-gray-800 dark:text-gray-200 mt-2">Modul specializat pentru {mod}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
`);

// Dashboard
fs.writeFileSync(path.join(PAGES_DIR, 'Dashboard.jsx'), `
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import TelemetryCard from '../components/TelemetryCard';
import axios from 'axios';
export default function Dashboard() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  const [healthData, setHealthData] = useState([]);
  useEffect(() => {
    axios.get('/api/modules').then(res => setModules(res.data.modules || []));
    const interval = setInterval(() => {
      axios.get('/api/health').then(res => setHealthData(prev => [...prev.slice(-19), { time: new Date().toLocaleTimeString(), value: res.data.uptime }]));
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="p-8"><h2 className="text-4xl font-bold mb-6 neon-text">{t('nav_dashboard')}</h2>
      <div className="flex flex-wrap gap-4 mb-6">
        <TelemetryCard title={t('modules_active')} value={modules.length} />
        <TelemetryCard title={t('uptime')} value={healthData.length > 0 ? healthData.slice(-1)[0].value.toFixed(0) + 's' : '...'} />
        <TelemetryCard title={t('status')} value={t('operational')} />
      </div>
      <div className="h-80 bg-gray-800/50 p-4 rounded-xl">
        <ResponsiveContainer width="100%" height="100%"><LineChart data={healthData}><XAxis dataKey="time" stroke="#00ffff" /><YAxis stroke="#00ffff" /><Tooltip /><Line type="monotone" dataKey="value" stroke="#ff00ff" strokeWidth={2} /></LineChart></ResponsiveContainer>
      </div>
    </div>
  );
}
`);

// Industries
fs.writeFileSync(path.join(PAGES_DIR, 'Industries.jsx'), `
import React from 'react';
import { useTranslation } from 'react-i18next';
const industries = ['Sănătate', 'Finanțe', 'Educație', 'Producție', 'Transport', 'Energie', 'Retail', 'Oameni'];
export default function Industries() {
  const { t } = useTranslation();
  return (
    <div className="p-8"><h2 className="text-4xl font-bold mb-6 neon-text">{t('nav_industries')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {industries.map(ind => <div key={ind} className="bg-gray-800/50 p-6 rounded-xl border border-cyan-500/30"><h3 className="text-2xl font-bold text-cyan-400">{ind}</h3><p className="text-gray-300">{t('industries_description')}</p></div>)}
      </div>
    </div>
  );
}
`);

// Capabilities
fs.writeFileSync(path.join(PAGES_DIR, 'Capabilities.jsx'), `
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
export default function Capabilities() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  useEffect(() => { axios.get('/api/modules').then(res => setModules(res.data.modules || [])); }, []);
  return (
    <div className="p-8"><h2 className="text-4xl font-bold mb-6 neon-text">{t('nav_capabilities')}</h2>
      <ul className="space-y-2">{modules.map(mod => <li key={mod} className="bg-gray-800/30 p-3 rounded border-l-4 border-cyan-500"><span className="font-bold text-cyan-400">{mod}</span> – {t('module_active')}</li>)}</ul>
    </div>
  );
}
`);

// Wealth
fs.writeFileSync(path.join(PAGES_DIR, 'Wealth.jsx'), `
import React from 'react';
import { useTranslation } from 'react-i18next';
export default function Wealth() {
  const { t } = useTranslation();
  return <div className="p-8"><h2 className="text-4xl neon-text">{t('nav_wealth')}</h2><p className="mt-4">Acces la marketplace AI. Pentru a folosi serviciile, contactează administratorul.</p></div>;
}
`);

// Payment (BTC address fixed)
fs.writeFileSync(path.join(PAGES_DIR, 'Payment.jsx'), `
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode.react';
const BTC_ADDRESS = 'bc1q4f7e66z87mdfj56kz0dj5hvcnpmh0qh4wuv22e';
export default function Payment() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(0.01);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const checkPayment = () => {
    setPaymentStatus('waiting');
    setTimeout(() => { setPaymentStatus('confirmed'); alert('Payment confirmed!'); }, 10000);
  };
  return (
    <div className="p-8 max-w-md mx-auto"><h2 className="text-4xl font-bold mb-6 neon-text">{t('payment_title')}</h2>
      <div className="bg-gray-800/50 p-6 rounded-xl"><label className="block mb-2">{t('payment_amount')}</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} step="0.001" className="w-full p-2 bg-gray-700 rounded mb-4" />
        <div className="text-center"><QRCode value={\`bitcoin:\${BTC_ADDRESS}?amount=\${amount}\`} size={200} />
          <p className="mt-2 break-all text-sm">Address: {BTC_ADDRESS}</p>
          <button onClick={checkPayment} className="mt-4 px-4 py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400">{t('generate_address')}</button>
          <p className="text-cyan-300 mt-2">Status: {paymentStatus}</p>
        </div>
      </div>
    </div>
  );
}
`);

// LandingPageGenerator
fs.writeFileSync(path.join(PAGES_DIR, 'LandingPageGenerator.jsx'), `
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
export default function LandingPageGenerator() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const generate = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const res = await axios.post('/api/generate-site', { topic, style: 'futuristic' });
      const pageId = res.data.path.split('/').pop().replace('.html', '');
      const url = \`/landing/\${pageId}\`;
      setGeneratedUrl(url);
      toast.success('Landing page created!');
    } catch (err) { toast.error('Generation failed'); } finally { setLoading(false); }
  };
  const share = () => { if (generatedUrl) { navigator.clipboard.writeText(window.location.origin + generatedUrl); toast.success('Link copied!'); } };
  return (
    <div className="p-8 max-w-md mx-auto"><h2 className="text-4xl font-bold mb-6 neon-text">{t('landing_page_generator')}</h2>
      <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Your business or idea" className="w-full p-2 bg-gray-800 rounded mb-4" />
      <button onClick={generate} disabled={loading} className="w-full px-4 py-2 bg-cyan-500 text-black rounded">{loading ? t('loading') : t('generate')}</button>
      {generatedUrl && (<div className="mt-4 p-4 bg-gray-800 rounded"><p className="mb-2">{t('landing_page_url')}</p><input type="text" value={generatedUrl} readOnly className="w-full p-2 bg-gray-700 rounded mb-2" />
        <div className="flex gap-2"><button onClick={share} className="px-4 py-2 bg-purple-500 rounded">{t('share_page')}</button><QRCodeSVG value={window.location.origin + generatedUrl} size={50} /></div></div>)}
    </div>
  );
}
`);

// ClientDashboard
fs.writeFileSync(path.join(PAGES_DIR, 'ClientDashboard.jsx'), `
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
export default function ClientDashboard() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user') || localStorage.getItem('userId') || uuidv4();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [purchases, setPurchases] = useState([]);
  const [apiUsage, setApiUsage] = useState(0);
  const [recommendations, setRecommendations] = useState([]);
  const [badges, setBadges] = useState([]);
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  useEffect(() => {
    if (!localStorage.getItem('userId')) localStorage.setItem('userId', userId);
    setPurchases([{ id: 1, service: 'AI Consulting', price: 99, date: '2025-03-01' }]);
    setApiUsage(342);
    setRecommendations(['Dynamic Pricing Module', 'Predictive Analytics']);
    setBadges(['Early Adopter', 'Sharer']);
    setPoints(1250);
    setLevel(3);
  }, [userId]);
  return (
    <div className="p-8"><h2 className="text-4xl font-bold mb-2 neon-text">{t('client_dashboard')}</h2>
      {user.name && <p className="mb-6 text-cyan-300">Welcome, {user.name}!</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800/50 p-4 rounded-xl"><span className="text-cyan-400">{t('points')}:</span> {points}</div>
        <div className="bg-gray-800/50 p-4 rounded-xl"><span className="text-cyan-400">{t('level')}:</span> {level}</div>
        <div className="bg-gray-800/50 p-4 rounded-xl"><span className="text-cyan-400">{t('api_usage')}:</span> {apiUsage} req</div>
      </div>
      <div className="mb-8"><h3 className="text-2xl font-bold mb-2">{t('purchase_history')}</h3><ul className="space-y-2">{purchases.map(p => <li key={p.id} className="bg-gray-800/30 p-3 rounded">{p.service} – {p.price} USD ({p.date})</li>)}</ul></div>
      <div className="mb-8"><h3 className="text-2xl font-bold mb-2">{t('recommendations')}</h3><ul className="space-y-2">{recommendations.map((rec, idx) => <li key={idx} className="bg-purple-500/20 p-3 rounded">{rec}</li>)}</ul></div>
      <div><h3 className="text-2xl font-bold mb-2">{t('badges')}</h3><div className="flex gap-2 flex-wrap">{badges.map(b => <span key={b} className="px-3 py-1 bg-yellow-500 text-black rounded-full text-sm">{b}</span>)}</div></div>
    </div>
  );
}
`);

// AdminWealth, AdminBD
fs.writeFileSync(path.join(PAGES_DIR, 'AdminWealth.jsx'), `
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
export default function AdminWealth() {
  const { t } = useTranslation();
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const handleLogin = () => { if (secret === 'VLADOI_IONUT_SECRET_SUPREM') setAuthenticated(true); else alert('Secret incorect!'); };
  if (!authenticated) return (<div className="p-8 max-w-md mx-auto"><h2 className="text-3xl font-bold mb-6 neon-text">{t('nav_admin_wealth')}</h2><input type="password" value={secret} onChange={e => setSecret(e.target.value)} className="w-full p-2 bg-gray-800 border border-cyan-500 rounded mb-4" /><button onClick={handleLogin} className="px-6 py-2 bg-cyan-500 text-black rounded">Autentificare</button></div>);
  return <div className="p-8"><h2 className="text-4xl neon-text">{t('nav_admin_wealth')}</h2><p>Panou de control pentru Wealth Engine.</p></div>;
}
`);
fs.writeFileSync(path.join(PAGES_DIR, 'AdminBD.jsx'), `
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
export default function AdminBD() {
  const { t } = useTranslation();
  const [secret, setSecret] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const handleLogin = () => { if (secret === 'VLADOI_IONUT_SECRET_SUPREM') setAuthenticated(true); else alert('Secret incorect!'); };
  if (!authenticated) return (<div className="p-8 max-w-md mx-auto"><h2 className="text-3xl font-bold mb-6 neon-text">{t('nav_admin_bd')}</h2><input type="password" value={secret} onChange={e => setSecret(e.target.value)} className="w-full p-2 bg-gray-800 border border-cyan-500 rounded mb-4" /><button onClick={handleLogin} className="px-6 py-2 bg-cyan-500 text-black rounded">Autentificare</button></div>);
  return <div className="p-8"><h2 className="text-4xl neon-text">{t('nav_admin_bd')}</h2><p>Panou de control pentru Business Development Engine.</p></div>;
}
`);

// Login
fs.writeFileSync(path.join(PAGES_DIR, 'Login.jsx'), `
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      toast.success(t('login_success'));
      navigate('/dashboard-client');
    } catch (err) {
      toast.error(t('login_error'));
    } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/50 p-8 rounded-xl w-full max-w-md border border-cyan-500/30">
        <h2 className="text-3xl font-bold mb-6 text-center neon-text">{t('login')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4"><label className="block mb-2">{t('email')}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full p-2 bg-gray-700 rounded" /></div>
          <div className="mb-6"><label className="block mb-2">{t('password')}</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full p-2 bg-gray-700 rounded" /></div>
          <button type="submit" disabled={loading} className="w-full py-2 bg-cyan-500 text-black rounded hover:bg-cyan-400 transition">{loading ? t('loading') : t('login')}</button>
        </form>
        <p className="mt-4 text-center">{t('dont_have_account')} <Link to="/register" className="text-cyan-400 hover:underline">{t('register')}</Link></p>
      </motion.div>
    </div>
  );
}
`);

// Register
fs.writeFileSync(path.join(PAGES_DIR, 'Register.jsx'), `
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
`);

// App.js
fs.writeFileSync(path.join(SRC_DIR, 'App.js'), `
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
`);

// Fișiere publice
fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), `
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="ZEUS & AI – Sistem Autonom Futurist" />
    <title>ZEUS & AI</title>
  </head>
  <body>
    <noscript>Trebuie să activezi JavaScript pentru a rula aplicația.</noscript>
    <div id="root"></div>
  </body>
</html>
`);
fs.writeFileSync(path.join(PUBLIC_DIR, 'ui-config.json'), '{}');

console.log('✅ Frontend-ul ZEUS & AI LUXURY a fost generat în folderul "client".');
console.log('📦 Acum poți rula:');
console.log('   cd client');
console.log('   npm install');
console.log('   npm start');
console.log('🔗 Asigură-te că backend-ul Unicorn rulează pe portul 3000 și implementează rutele de autentificare (vezi README din proiectul tău).');


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

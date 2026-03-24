
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

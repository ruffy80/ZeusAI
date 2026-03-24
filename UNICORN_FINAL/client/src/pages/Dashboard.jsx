
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

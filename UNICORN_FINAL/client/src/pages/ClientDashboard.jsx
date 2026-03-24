
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


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
    setReferralLink(`${window.location.origin}/?ref=${id}`);
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

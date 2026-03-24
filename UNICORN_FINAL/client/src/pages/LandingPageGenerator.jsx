
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
      const url = `/landing/${pageId}`;
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

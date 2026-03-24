
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


import React from 'react';
import { useTranslation } from 'react-i18next';
export default function Wealth() {
  const { t } = useTranslation();
  return <div className="p-8"><h2 className="text-4xl neon-text">{t('nav_wealth')}</h2><p className="mt-4">Acces la marketplace AI. Pentru a folosi serviciile, contactează administratorul.</p></div>;
}

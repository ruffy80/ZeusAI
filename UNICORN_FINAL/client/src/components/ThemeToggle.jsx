
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


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

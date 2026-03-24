
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { motion } from 'framer-motion';
export default function Codex() {
  const { t } = useTranslation();
  const [modules, setModules] = useState([]);
  useEffect(() => {
    axios.get('/api/modules').then(res => setModules(res.data.modules || []));
  }, []);
  return (
    <div className="p-8">
      <motion.h2
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-5xl font-bold mb-6 text-center"
        style={{ color: '#ffaa00', textShadow: '0 0 10px #ffaa00' }}
      >
        {t('nav_codex')}
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((mod, idx) => (
          <motion.div
            key={mod}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            className="luxury-card p-6 rounded-xl"
          >
            <h3 className="text-xl font-bold" style={{ color: '#ffaa00' }}>{mod}</h3>
            <p className="text-gray-800 dark:text-gray-200 mt-2">Modul specializat pentru {mod}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

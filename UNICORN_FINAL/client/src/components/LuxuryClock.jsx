
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export default function LuxuryClock() {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [sessionStart] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
      setRotation(prev => (prev + 12) % 360);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatElapsed = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const hourDeg = (currentTime.getHours() % 12) * 30 + currentTime.getMinutes() * 0.5;
  const minuteDeg = currentTime.getMinutes() * 6 + currentTime.getSeconds() * 0.1;
  const secondDeg = currentTime.getSeconds() * 6;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed top-20 right-6 w-56 bg-black/70 backdrop-blur rounded-2xl border-2 shadow-2xl z-20 p-4"
      style={{
        borderImage: 'linear-gradient(135deg, #ffaa00, #aa66ff, #c0c0c0)',
        borderImageSlice: 1,
        boxShadow: '0 0 20px rgba(255,170,0,0.5), 0 0 10px rgba(170,102,255,0.5)'
      }}
    >
      <div className="text-center">
        <h3 className="text-xs uppercase tracking-wider mb-2" style={{ color: '#ffaa00', textShadow: '0 0 5px #ffaa00' }}>
          {t('current_time')}
        </h3>
        <div className="relative w-32 h-32 mx-auto my-2">
          <div className="absolute inset-0 rounded-full border-4 border-gold-500 shadow-lg" style={{ borderColor: '#ffaa00' }}></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-800 to-purple-950 opacity-90"></div>
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <div className="w-20 h-20 rounded-full border-2 border-platinum-400 bg-black/30 flex items-center justify-center" style={{ borderColor: '#c0c0c0' }}>
              <div className="w-12 h-12 rounded-full border border-gold-500 bg-gradient-to-tr from-gold-200 to-gold-500"></div>
            </div>
          </motion.div>
          <div className="absolute top-1/2 left-1/2 w-0.5 h-10 bg-gold-500 origin-bottom transform -translate-x-1/2 -translate-y-full" style={{ transform: `rotate(${hourDeg}deg) translateX(-50%) translateY(-100%)` }}></div>
          <div className="absolute top-1/2 left-1/2 w-0.5 h-12 bg-gold-300 origin-bottom transform -translate-x-1/2 -translate-y-full" style={{ transform: `rotate(${minuteDeg}deg) translateX(-50%) translateY(-100%)` }}></div>
          <div className="absolute top-1/2 left-1/2 w-0.5 h-14 bg-red-500 origin-bottom transform -translate-x-1/2 -translate-y-full" style={{ transform: `rotate(${secondDeg}deg) translateX(-50%) translateY(-100%)` }}></div>
          <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-gold-500 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
        </div>
        <div className="text-lg font-mono text-gold-400 mt-2">{formatTime(currentTime)}</div>
        <div className="mt-2 pt-2 border-t border-gold-500/50">
          <div className="text-xs text-gold-400/80">{t('time_on_site')}</div>
          <div className="text-sm font-mono text-gold-300">{formatElapsed(elapsed)}</div>
        </div>
      </div>
    </motion.div>
  );
}

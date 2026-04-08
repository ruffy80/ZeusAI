import React from 'react';
import { motion } from 'framer-motion';

export default function HolographicCard({ children, className = '', glowColor = '#00ffff', onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={'relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white/5 border border-white/20 shadow-2xl ' + className}
      style={{ boxShadow: '0 0 20px ' + glowColor + '40, 0 0 5px ' + glowColor + '80' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: 'shimmer 2s infinite' }} />
      </div>
      <div className="relative p-6">{children}</div>
    </motion.div>
  );
}

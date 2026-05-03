import React from 'react';
import { motion } from 'framer-motion';

export default function NeonPulseButton({ children, onClick, className = '', color = '#00ffff' }) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={'relative px-8 py-3 font-bold text-lg rounded-full overflow-hidden group ' + className}
      style={{
        background: 'linear-gradient(135deg, ' + color + '20, transparent)',
        border: '1px solid ' + color,
        boxShadow: '0 0 10px ' + color + ', 0 0 5px ' + color,
        color,
        textShadow: '0 0 5px ' + color
      }}
    >
      <motion.span className="absolute inset-0 bg-white/10" initial={{ scale: 0, opacity: 0 }} whileHover={{ scale: 1.5, opacity: 0.3 }} transition={{ duration: 0.5 }} />
      <span className="relative z-10">{children}</span>
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{ boxShadow: ['0 0 5px rgba(0,255,255,0.5)', '0 0 20px rgba(0,255,255,0.8)', '0 0 5px rgba(0,255,255,0.5)'] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
    </motion.button>
  );
}

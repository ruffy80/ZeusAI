import React from 'react';
import { motion } from 'framer-motion';

export default function QuantumLoader() {
  return (
    <motion.div
      className="quantum-loader"
      animate={{ scale: [1, 1.2, 1], rotate: [0, 360, 0], opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      <div className="quantum-particles">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="quantum-particle"
            style={{ transform: `rotate(${i * 30}deg) translateY(-20px)`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

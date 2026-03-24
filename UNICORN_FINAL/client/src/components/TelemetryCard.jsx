
import React from 'react';
import { motion } from 'framer-motion';
export default function TelemetryCard({ title, value }) {
  return (
    <motion.div className="bg-gray-800/50 backdrop-blur p-4 rounded-xl shadow-lg w-64 border border-cyan-500/30" whileHover={{ scale: 1.05 }}>
      <h3 className="font-bold text-lg text-cyan-400">{title}</h3>
      <p className="text-3xl font-mono text-white">{value}</p>
    </motion.div>
  );
}

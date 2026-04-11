import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function QuantumEncryptionVisualizer() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    console.log('✨ Quantum Encryption Visualizer activ – pregătit pentru viitor');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.9 }}
      className="future-component"
      data-year={2028}
    >
      <div className="holographic-effect">
        <h3>Quantum Encryption Visualizer</h3>
        <p>Vizualizare criptare cuantică în timp real</p>
        <div className="future-badge">✨ Disponibil din 2028</div>
      </div>
    </motion.div>
  );
}

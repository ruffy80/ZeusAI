import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function NeuralNavigation() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    console.log('✨ Neural Navigation activ – pregătit pentru viitor');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.9 }}
      className="future-component"
      data-year={2031}
    >
      <div className="holographic-effect">
        <h3>Neural Navigation</h3>
        <p>Navigare prin gândire (interfață creier-calculator)</p>
        <div className="future-badge">✨ Disponibil din 2031</div>
      </div>
    </motion.div>
  );
}

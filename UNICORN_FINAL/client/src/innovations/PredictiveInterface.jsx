import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function PredictiveInterface() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    console.log('✨ Predictive Interface activ – pregătit pentru viitor');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.9 }}
      className="future-component"
      data-year={2027}
    >
      <div className="holographic-effect">
        <h3>Predictive Interface</h3>
        <p>Interfață care prezice acțiunile utilizatorului</p>
        <div className="future-badge">✨ Disponibil din 2027</div>
      </div>
    </motion.div>
  );
}

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function HolographicUILayer() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    console.log('✨ Holographic UI Layer activ – pregătit pentru viitor');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.9 }}
      className="future-component"
      data-year={2029}
    >
      <div className="holographic-effect">
        <h3>Holographic UI Layer</h3>
        <p>Interfață holografică 3D fără ochelari</p>
        <div className="future-badge">✨ Disponibil din 2029</div>
      </div>
    </motion.div>
  );
}

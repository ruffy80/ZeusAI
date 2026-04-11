import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export default function TemporalCacheLayer() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    console.log('✨ Temporal Cache Layer activ – pregătit pentru viitor');
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.9 }}
      className="future-component"
      data-year={2034}
    >
      <div className="holographic-effect">
        <h3>Temporal Cache Layer</h3>
        <p>Cache care știe ce vei accesa în viitor</p>
        <div className="future-badge">✨ Disponibil din 2034</div>
      </div>
    </motion.div>
  );
}

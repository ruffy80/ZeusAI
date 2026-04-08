import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { name: 'Home', icon: '🏠', path: '/' },
  { name: 'Codex', icon: '📘', path: '/codex' },
  { name: 'Dashboard', icon: '📊', path: '/dashboard' },
  { name: 'Industries', icon: '🏭', path: '/industries' },
  { name: 'Capabilities', icon: '⚡', path: '/capabilities' },
  { name: 'Wealth', icon: '💰', path: '/wealth' },
  { name: 'Marketplace', icon: '🛒', path: '/marketplace' }
];

export default function OrbitalNav() {
  const [activeIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const radius = 120;

  return (
    <div style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
      <button onClick={() => setIsOpen(!isOpen)} style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#06b6d4,#7c3aed)', color: '#fff', border: 0, fontSize: 24, cursor: 'pointer' }}>
        {isOpen ? '✕' : '✦'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)' }}>
            {navItems.map((item, idx) => {
              const angle = (idx / navItems.length) * Math.PI * 2;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const isActive = activeIndex === idx;
              return (
                <motion.a
                  key={item.name}
                  href={item.path}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: 1, x, y }}
                  exit={{ scale: 0, x: 0, y: 0 }}
                  transition={{ delay: idx * 0.05, type: 'spring' }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    position: 'absolute',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    background: isActive ? '#06b6d4' : 'rgba(31,41,55,0.85)',
                    color: '#fff',
                    transform: 'translate(-50%, -50%)',
                    left: 'calc(50% + ' + x + 'px)',
                    top: 'calc(50% + ' + y + 'px)'
                  }}
                >
                  <span style={{ position: 'relative' }}>
                    {item.icon}
                    {hoveredIndex === idx && (
                      <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: 10, background: 'rgba(0,0,0,0.75)', padding: '2px 6px', borderRadius: 6 }}>
                        {item.name}
                      </motion.span>
                    )}
                  </span>
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

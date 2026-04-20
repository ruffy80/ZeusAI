import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

function AnimatedCount({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const numericTarget = parseFloat(String(target).replace(/[^0-9.]/g, ''));
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * numericTarget));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else setCount(numericTarget);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [inView, target, duration]);

  const displayValue = String(target).replace(/[0-9.]+/, count);

  return (
    <span ref={ref} style={{ fontFamily: 'var(--font-heading)' }}>
      {displayValue}{suffix}
    </span>
  );
}

export default function StatsBar({ stats = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
        gap: 1,
        background: 'rgba(0,212,255,0.08)',
        borderRadius: 16,
        border: '1px solid rgba(0,212,255,0.15)',
        overflow: 'hidden',
      }}
    >
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.5 }}
          style={{
            padding: '2rem 1.5rem',
            textAlign: 'center',
            background: 'rgba(13,15,30,0.8)',
            backdropFilter: 'blur(12px)',
            borderRight: i < stats.length - 1 ? '1px solid rgba(0,212,255,0.1)' : 'none',
          }}
        >
          <div style={{
            fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
            fontWeight: 900,
            background: 'linear-gradient(90deg,#00d4ff,#c084fc)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '0.4rem',
            lineHeight: 1.1,
          }}>
            <AnimatedCount target={stat.value} suffix={stat.suffix || ''} />
          </div>
          <div style={{
            fontSize: 13,
            color: '#94a3b8',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.04em',
            fontWeight: 500,
          }}>
            {stat.label}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

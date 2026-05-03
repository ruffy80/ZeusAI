import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function AnimatedDataStream({ data, title, unit = '' }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1,
          speedX: (Math.random() - 0.5) * 2,
          speedY: Math.random() * 3 + 1,
          alpha: Math.random() * 0.5 + 0.3
        });
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data && data.length > 0) {
        const maxVal = Math.max(...data, 1);
        const barWidth = canvas.width / data.length;
        data.forEach((value, idx) => {
          const height = (value / maxVal) * canvas.height * 0.6;
          const gradient = ctx.createLinearGradient(idx * barWidth, canvas.height, idx * barWidth, canvas.height - height);
          gradient.addColorStop(0, '#00ffff');
          gradient.addColorStop(1, '#ff00ff');
          ctx.fillStyle = gradient;
          ctx.fillRect(idx * barWidth, canvas.height - height, Math.max(barWidth - 2, 1), height);
        });
      }

      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 255, ' + p.alpha + ')';
        ctx.fill();
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y > canvas.height) { p.y = 0; p.x = Math.random() * canvas.width; }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    resizeCanvas();
    initParticles();
    animate();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [data]);

  const currentValue = data && data.length > 0 ? data[data.length - 1] : 0;
  return (
    <div style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ color: '#22d3ee', margin: 0 }}>{title}</h3>
        <motion.div key={currentValue} initial={{ scale: 1.2, color: '#00ffff' }} animate={{ scale: 1, color: '#ffffff' }} style={{ fontSize: 24, fontFamily: 'monospace' }}>
          {currentValue.toFixed(2)}{unit}
        </motion.div>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 192, borderRadius: 10 }} />
    </div>
  );
}

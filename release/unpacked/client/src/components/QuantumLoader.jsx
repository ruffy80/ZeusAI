import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function QuantumLoader({ loading = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!loading) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let frame;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 50; i++) {
        particles.push({
          radius: Math.random() * 3 + 1,
          angle: Math.random() * Math.PI * 2,
          speed: 0.02 + Math.random() * 0.03,
          color: 'hsl(' + (200 + Math.random() * 100) + ', 100%, 60%)'
        });
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.angle += p.speed;
        const x = canvas.width / 2 + Math.cos(p.angle) * (canvas.width / 4);
        const y = canvas.height / 2 + Math.sin(p.angle) * (canvas.height / 4);
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      frame = requestAnimationFrame(animate);
    };

    resizeCanvas();
    initParticles();
    animate();
    window.addEventListener('resize', resizeCanvas);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [loading]);

  if (!loading) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ textAlign: 'center' }}>
        <canvas ref={canvasRef} style={{ width: 256, height: 256 }} />
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} style={{ marginTop: 16, color: '#22d3ee', fontSize: 22 }}>
          Quantum Entanglement...
        </motion.div>
      </div>
    </div>
  );
}

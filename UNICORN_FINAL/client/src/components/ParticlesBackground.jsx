
import React, { useEffect, useRef } from 'react';
export default function ParticlesBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1, speedX: (Math.random() - 0.5) * 0.5, speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
    function animate() {
      requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.speedX; p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 255, ${p.opacity})`; ctx.fill();
      });
    }
    animate();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);
  return <canvas ref={canvasRef} className="particle-bg" />;
}

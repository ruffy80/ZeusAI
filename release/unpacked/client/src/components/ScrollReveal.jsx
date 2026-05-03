import React from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

export default function ScrollReveal({ children, delay = 0, direction = 'up' }) {
  const ref = useScrollReveal();
  const directions = {
    up: { y: 50, x: 0 },
    down: { y: -50, x: 0 },
    left: { y: 0, x: 50 },
    right: { y: 0, x: -50 }
  };

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translate(' + directions[direction].x + 'px, ' + directions[direction].y + 'px)',
        filter: 'blur(5px)',
        transition: 'all 0.6s cubic-bezier(0.2, 0.9, 0.4, 1.1) ' + delay + 's'
      }}
    >
      {children}
    </div>
  );
}

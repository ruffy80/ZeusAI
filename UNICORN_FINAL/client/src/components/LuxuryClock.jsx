import React, { useEffect, useRef, useState } from 'react';

// LuxuryClock – tourbillon-style luxury clock
// Rotating mechanism, gold/violet/platinum colors, timer for time spent on site

const LuxuryClock = ({ showTimer = true }) => {
  const [time, setTime] = useState(new Date());
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const tourbillonRef = useRef(0);
  const [tbAngle, setTbAngle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
      setTbAngle(a => (a + 6) % 360); // 6 deg/sec = full rotation in 60s
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const sec = time.getSeconds();
  const min = time.getMinutes();
  const hr = time.getHours() % 12;

  const secAngle = sec * 6;
  const minAngle = min * 6 + sec * 0.1;
  const hrAngle = hr * 30 + min * 0.5;

  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  const toRad = deg => (deg * Math.PI) / 180;
  const handEnd = (angle, length) => ({
    x: 120 + length * Math.sin(toRad(angle)),
    y: 120 - length * Math.cos(toRad(angle)),
  });

  const hrEnd = handEnd(hrAngle, 55);
  const minEnd = handEnd(minAngle, 75);
  const secEnd = handEnd(secAngle, 85);

  const colors = {
    gold: '#fbbf24',
    goldDark: '#d97706',
    platinum: '#e2e8f0',
    violet: '#7c3aed',
    violetLight: '#a78bfa',
    bg: '#0f0a1f',
    face: '#1a1035',
    accent: '#f59e0b',
  };

  // Generate tick marks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = toRad(i * 6);
    const isHour = i % 5 === 0;
    const r1 = isHour ? 95 : 100;
    const r2 = 108;
    return {
      x1: 120 + r1 * Math.sin(a),
      y1: 120 - r1 * Math.cos(a),
      x2: 120 + r2 * Math.sin(a),
      y2: 120 - r2 * Math.cos(a),
      isHour,
    };
  });

  // Tourbillon cage points
  const cagePoints = Array.from({ length: 6 }, (_, i) => {
    const a = toRad(tbAngle + i * 60);
    return { x: 120 + 22 * Math.sin(a), y: 120 + 50 - 22 * Math.cos(a) };
  });
  const cageD = cagePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg
        width="240"
        height="240"
        viewBox="0 0 240 240"
        style={{
          filter: `drop-shadow(0 0 20px ${colors.violetLight}88)`,
          borderRadius: '50%',
        }}
        aria-label="Luxury Tourbillon Clock"
      >
        <defs>
          <radialGradient id="clockFace" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor="#2a1a50" />
            <stop offset="100%" stopColor="#0a0520" />
          </radialGradient>
          <radialGradient id="goldRing" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="transparent" />
            <stop offset="85%" stopColor={colors.goldDark} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colors.gold} stopOpacity="0.9" />
          </radialGradient>
          <filter id="clockGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="handGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.gold} />
            <stop offset="100%" stopColor={colors.accent} />
          </linearGradient>
        </defs>

        {/* Outer bezel */}
        <circle cx="120" cy="120" r="118" fill={colors.gold} opacity="0.15" />
        <circle cx="120" cy="120" r="115" fill={colors.bg} />
        <circle cx="120" cy="120" r="114" fill="none" stroke={colors.gold} strokeWidth="2" />
        <circle cx="120" cy="120" r="110" fill="none" stroke={colors.goldDark} strokeWidth="0.5" />

        {/* Clock face */}
        <circle cx="120" cy="120" r="108" fill="url(#clockFace)" />

        {/* Gold ring gradient */}
        <circle cx="120" cy="120" r="108" fill="url(#goldRing)" />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isHour ? colors.gold : colors.violetLight}
            strokeWidth={t.isHour ? 2 : 0.8}
            opacity={t.isHour ? 1 : 0.5}
          />
        ))}

        {/* Hour numerals (Roman) */}
        {['XII', 'III', 'VI', 'IX'].map((n, i) => {
          const a = toRad(i * 90);
          return (
            <text
              key={n}
              x={120 + 82 * Math.sin(a)}
              y={120 - 82 * Math.cos(a) + 4}
              textAnchor="middle"
              fill={colors.platinum}
              fontSize="9"
              fontFamily="serif"
              fontWeight="bold"
              opacity="0.8"
            >
              {n}
            </text>
          );
        })}

        {/* Inner decorative ring */}
        <circle cx="120" cy="120" r="65" fill="none" stroke={colors.violet} strokeWidth="0.5" opacity="0.4" />
        <circle cx="120" cy="120" r="40" fill="none" stroke={colors.gold} strokeWidth="0.5" opacity="0.3" />

        {/* Tourbillon cage at 6 o'clock position */}
        <g style={{ transformOrigin: '120px 170px' }}>
          <circle cx="120" cy="170" r="24" fill="none" stroke={colors.gold} strokeWidth="1" opacity="0.4" />
          <circle cx="120" cy="170" r="16" fill={colors.bg} stroke={colors.goldDark} strokeWidth="0.8" />
          <path
            d={cageD}
            fill="none"
            stroke={colors.gold}
            strokeWidth="1.2"
            opacity="0.7"
            filter="url(#clockGlow)"
          />
          {/* Tourbillon balance wheel */}
          <circle cx="120" cy="170" r="8" fill="none" stroke={colors.accent} strokeWidth="1" opacity="0.9" />
          <line
            x1={120 + 8 * Math.sin(toRad(tbAngle))}
            y1={170 - 8 * Math.cos(toRad(tbAngle))}
            x2={120 - 8 * Math.sin(toRad(tbAngle))}
            y2={170 + 8 * Math.cos(toRad(tbAngle))}
            stroke={colors.gold}
            strokeWidth="1.5"
          />
          <circle cx="120" cy="170" r="2" fill={colors.gold} />
        </g>

        {/* Hour hand */}
        <line
          x1="120" y1="120"
          x2={hrEnd.x} y2={hrEnd.y}
          stroke={colors.gold}
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#clockGlow)"
        />

        {/* Minute hand */}
        <line
          x1="120" y1="120"
          x2={minEnd.x} y2={minEnd.y}
          stroke={colors.platinum}
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#clockGlow)"
        />

        {/* Second hand */}
        <line
          x1="120" y1="120"
          x2={secEnd.x} y2={secEnd.y}
          stroke="#ef4444"
          strokeWidth="1.2"
          strokeLinecap="round"
          filter="url(#clockGlow)"
        />
        {/* Counter-weight */}
        <line
          x1="120" y1="120"
          x2={120 - 20 * Math.sin(toRad(secAngle))}
          y2={120 + 20 * Math.cos(toRad(secAngle))}
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Center jewel */}
        <circle cx="120" cy="120" r="5" fill={colors.gold} />
        <circle cx="120" cy="120" r="3" fill={colors.accent} />
        <circle cx="120" cy="120" r="1.5" fill="white" />

        {/* Brand text */}
        <text x="120" y="95" textAnchor="middle" fill={colors.violetLight} fontSize="7" fontFamily="serif" letterSpacing="2" opacity="0.7">
          ZEUS AI
        </text>
        <text x="120" y="106" textAnchor="middle" fill={colors.goldDark} fontSize="5" fontFamily="serif" letterSpacing="1" opacity="0.5">
          TOURBILLON
        </text>
      </svg>

      {/* Digital readout + session timer */}
      {showTimer && (
        <div style={{
          background: 'rgba(124,58,237,0.1)',
          border: '1px solid #7c3aed44',
          borderRadius: 8,
          padding: '6px 20px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#fbbf24', fontSize: 18, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 }}>
            {String(time.getHours()).padStart(2, '0')}:
            {String(time.getMinutes()).padStart(2, '0')}:
            {String(time.getSeconds()).padStart(2, '0')}
          </div>
          <div style={{ color: '#a78bfa', fontSize: 11, marginTop: 2 }}>
            Timp pe site: {elapsedMin > 0 ? `${elapsedMin}m ` : ''}{elapsedSec}s
          </div>
        </div>
      )}
    </div>
  );
};

export default LuxuryClock;

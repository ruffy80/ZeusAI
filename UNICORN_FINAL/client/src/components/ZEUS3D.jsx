import React, { useRef, useEffect, useState } from 'react';

// ZEUS 3D Avatar - futuristic holographic avatar with voice commands
// Uses CSS 3D transforms and canvas for effects (no heavy WebGL dependency)

const ZEUS3D = ({ onCommand, speaking = false, listening = false }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [blinkState, setBlinkState] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(0);
  const [eyebrowRaise, setEyebrowRaise] = useState(0);
  const [hairFlow, setHairFlow] = useState(0);
  const [voiceInput, setVoiceInput] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const recognitionRef = useRef(null);

  // Blink animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlinkState(true);
      setTimeout(() => setBlinkState(false), 150);
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(blinkInterval);
  }, []);

  // Mouth movement when speaking
  useEffect(() => {
    if (!speaking) { setMouthOpen(0); return; }
    const mouthInterval = setInterval(() => {
      setMouthOpen(Math.random() * 8 + 2);
    }, 100);
    return () => clearInterval(mouthInterval);
  }, [speaking]);

  // Eyebrow and hair animation
  useEffect(() => {
    const id = setInterval(() => {
      setEyebrowRaise(Math.sin(Date.now() / 1200) * 2);
      setHairFlow(Math.sin(Date.now() / 800) * 3);
    }, 50);
    return () => clearInterval(id);
  }, []);

  // Canvas particle effect for dynamic lighting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    const particles = Array.from({ length: 40 }, () => ({
      x: Math.random() * 300,
      y: Math.random() * 400,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -Math.random() * 0.6 - 0.2,
      life: Math.random(),
      color: Math.random() > 0.5 ? '#a78bfa' : '#fbbf24',
    }));

    const draw = () => {
      ctx.clearRect(0, 0, 300, 400);
      frame++;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.003;
        if (p.life <= 0 || p.y < 0) {
          p.x = Math.random() * 300;
          p.y = 400;
          p.life = 0.8 + Math.random() * 0.2;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.floor(p.life * 200).toString(16).padStart(2, '0');
        ctx.fill();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Voice recognition
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = 'ro-RO';
    rec.onstart = () => setRecognizing(true);
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setVoiceInput(text);
      if (onCommand) onCommand(text);
    };
    rec.onend = () => setRecognizing(false);
    rec.onerror = (e) => { setRecognizing(false); setVoiceInput('Eroare recunoaștere: ' + (e.error || 'necunoscută')); };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      setVoiceInput('Nu s-a putut porni recunoașterea vocală: ' + e.message);
      setRecognizing(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setRecognizing(false);
  };

  return (
    <div style={{ position: 'relative', width: 300, margin: '0 auto', userSelect: 'none' }}>
      {/* Particle canvas behind avatar */}
      <canvas
        ref={canvasRef}
        width={300}
        height={400}
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Avatar SVG */}
      <svg
        width="300"
        height="400"
        viewBox="0 0 300 400"
        style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 0 18px #a78bfa)' }}
        aria-label="ZEUS 3D Avatar"
      >
        {/* Glow halo */}
        <defs>
          <radialGradient id="halo" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.15" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="skinGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#fde8c8" />
            <stop offset="100%" stopColor="#e8b88a" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Halo background */}
        <ellipse cx="150" cy="160" rx="140" ry="160" fill="url(#halo)" />

        {/* White flowing hair - back layer */}
        <path
          d={`M80,${90 + hairFlow} Q60,${70 + hairFlow * 0.5} 65,${140 + hairFlow} Q70,${200 + hairFlow * 0.3} 85,${220}`}
          stroke="#f0f0f0" strokeWidth="22" fill="none" strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d={`M220,${90 + hairFlow * 0.8} Q240,${70 + hairFlow * 0.5} 235,${140 + hairFlow * 0.7} Q230,${200 + hairFlow * 0.3} 215,${220}`}
          stroke="#e8e8e8" strokeWidth="22" fill="none" strokeLinecap="round"
          opacity="0.9"
        />

        {/* Head/face */}
        <ellipse cx="150" cy="160" rx="80" ry="90" fill="url(#skinGrad)" />

        {/* White hair - top */}
        <path
          d={`M70,${130 + hairFlow * 0.5} Q80,${60 + hairFlow} 150,${55 + hairFlow * 0.8} Q220,${60 + hairFlow} 230,${130 + hairFlow * 0.5}`}
          fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1"
        />

        {/* Eyebrows */}
        <path
          d={`M105,${125 - eyebrowRaise} Q120,${118 - eyebrowRaise} 135,${123 - eyebrowRaise}`}
          stroke="#8B7355" strokeWidth="3" fill="none" strokeLinecap="round"
        />
        <path
          d={`M165,${123 - eyebrowRaise} Q180,${118 - eyebrowRaise} 195,${125 - eyebrowRaise}`}
          stroke="#8B7355" strokeWidth="3" fill="none" strokeLinecap="round"
        />

        {/* Eyes */}
        {!blinkState ? (
          <>
            {/* Left eye */}
            <ellipse cx="120" cy="148" rx="14" ry="14" fill="white" />
            <circle cx="122" cy="149" r="9" fill="#4a3580" />
            <circle cx="122" cy="149" r="5" fill="#2a1560" />
            <circle cx="125" cy="146" r="2" fill="white" />
            {/* Right eye */}
            <ellipse cx="180" cy="148" rx="14" ry="14" fill="white" />
            <circle cx="182" cy="149" r="9" fill="#4a3580" />
            <circle cx="182" cy="149" r="5" fill="#2a1560" />
            <circle cx="185" cy="146" r="2" fill="white" />
          </>
        ) : (
          <>
            <line x1="106" y1="148" x2="134" y2="148" stroke="#8B7355" strokeWidth="3" strokeLinecap="round" />
            <line x1="166" y1="148" x2="194" y2="148" stroke="#8B7355" strokeWidth="3" strokeLinecap="round" />
          </>
        )}

        {/* Nose */}
        <path d="M148,160 Q145,175 140,178 Q150,182 160,178 Q155,175 152,160" fill="#e0a070" opacity="0.5" />

        {/* Mouth */}
        <path
          d={`M125,${195 + mouthOpen * 0.2} Q150,${200 + mouthOpen} 175,${195 + mouthOpen * 0.2}`}
          stroke="#c0706a" strokeWidth="2.5" fill={mouthOpen > 2 ? '#8B1A1A' : 'none'}
          strokeLinecap="round"
        />
        {mouthOpen > 2 && (
          <ellipse cx="150" cy={198 + mouthOpen * 0.3} rx="18" ry={mouthOpen * 0.6 + 2} fill="#7a1010" />
        )}

        {/* Neck */}
        <rect x="130" y="245" width="40" height="50" fill="url(#skinGrad)" rx="5" />

        {/* Shoulders / robe */}
        <path d="M50,340 Q90,280 130,270 L170,270 Q210,280 250,340 L270,400 L30,400 Z" fill="#1a0a3a" />
        <path d="M50,340 Q90,280 130,270" stroke="#a78bfa" strokeWidth="2" fill="none" />
        <path d="M170,270 Q210,280 250,340" stroke="#a78bfa" strokeWidth="2" fill="none" />

        {/* Robe accent lines */}
        <path d="M140,270 L135,400" stroke="#fbbf24" strokeWidth="1.5" opacity="0.5" />
        <path d="M160,270 L165,400" stroke="#fbbf24" strokeWidth="1.5" opacity="0.5" />

        {/* Dynamic light effect when listening/speaking */}
        {(listening || recognizing) && (
          <ellipse cx="150" cy="160" rx="85" ry="95" fill="none"
            stroke="#22d3ee" strokeWidth="3" opacity="0.6"
            style={{ animation: 'none' }}
          >
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite" />
          </ellipse>
        )}
        {speaking && (
          <ellipse cx="150" cy="160" rx="85" ry="95" fill="none"
            stroke="#a78bfa" strokeWidth="3" opacity="0.6">
            <animate attributeName="opacity" values="0.6;0.1;0.6" dur="0.5s" repeatCount="indefinite" />
          </ellipse>
        )}
      </svg>

      {/* Voice command button */}
      <div style={{ textAlign: 'center', marginTop: 12, zIndex: 2, position: 'relative' }}>
        <button
          onClick={recognizing ? stopListening : startListening}
          style={{
            background: recognizing
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            color: 'white',
            border: 'none',
            borderRadius: 24,
            padding: '8px 24px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 1,
            boxShadow: recognizing
              ? '0 0 20px #ef4444aa'
              : '0 0 16px #7c3aedaa',
          }}
        >
          {recognizing ? '⏹ Stop' : '🎤 Comandă vocală'}
        </button>
        {voiceInput && (
          <div style={{
            marginTop: 8, color: '#a78bfa', fontSize: 12,
            background: 'rgba(167,139,250,0.1)', borderRadius: 8,
            padding: '4px 12px', border: '1px solid #a78bfa44',
          }}>
            "{voiceInput}"
          </div>
        )}
      </div>
    </div>
  );
};

export default ZEUS3D;

import React, { useState, useEffect, useRef } from 'react';

// HolographicVoice – holographic voice assistant with particles and speech recognition
const HolographicVoice = ({ onResult, placeholder = 'Spune ceva...' }) => {
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [amplitude, setAmplitude] = useState(0);
  const [particles, setParticles] = useState([]);
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const recRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Initialize particles
  useEffect(() => {
    setParticles(Array.from({ length: 60 }, (_, i) => ({
      id: i,
      angle: (i / 60) * Math.PI * 2,
      radius: 50 + Math.random() * 30,
      speed: 0.005 + Math.random() * 0.01,
      size: 1 + Math.random() * 2.5,
      opacity: 0.3 + Math.random() * 0.7,
    })));
  }, []);

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;

    const localParticles = Array.from({ length: 60 }, (_, i) => ({
      angle: (i / 60) * Math.PI * 2,
      radius: 50 + Math.random() * 30,
      speed: 0.005 + Math.random() * 0.01,
      size: 1 + Math.random() * 2.5,
    }));

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, 240, 240);
      const cx = 120, cy = 120;

      // Holographic rings
      const rings = active ? [35, 50, 70, 90] : [40, 60, 85];
      rings.forEach((r, i) => {
        const amp = active ? amplitude : 0;
        ctx.beginPath();
        ctx.arc(cx, cy, r + Math.sin(frame * 0.05 + i) * (2 + amp * 10), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167,139,250,${0.4 - i * 0.08})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Waveform when active
      if (active) {
        ctx.beginPath();
        for (let x = 0; x < 240; x++) {
          const y = cy + Math.sin((x / 240) * Math.PI * 4 + frame * 0.1) * (10 + amplitude * 25)
            + Math.sin((x / 240) * Math.PI * 8 + frame * 0.07) * (5 + amplitude * 12);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(251,191,36,0.7)`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Particles orbit
      localParticles.forEach(p => {
        p.angle += p.speed * (active ? 1.5 : 0.8);
        const r = p.radius + (active ? amplitude * 20 : 0);
        const px = cx + r * Math.cos(p.angle);
        const py = cy + r * Math.sin(p.angle);
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = active
          ? `rgba(251,191,36,${0.5 + amplitude * 0.5})`
          : `rgba(167,139,250,0.5)`;
        ctx.fill();
      });

      // Center orb
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28 + amplitude * 10);
      grad.addColorStop(0, active ? 'rgba(251,191,36,0.9)' : 'rgba(167,139,250,0.8)');
      grad.addColorStop(0.5, active ? 'rgba(124,58,237,0.5)' : 'rgba(99,102,241,0.4)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, 28 + amplitude * 10, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Mic icon when idle
      if (!active) {
        ctx.fillStyle = 'rgba(167,139,250,0.8)';
        ctx.font = '20px serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎤', cx, cy + 7);
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [active, amplitude]);

  const startRecognition = async () => {
    setActive(true);
    setTranscript('');

    // Web Audio API for amplitude
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const updateAmp = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAmplitude(avg / 128);
        if (analyserRef.current) requestAnimationFrame(updateAmp);
      };
      updateAmp();
    } catch {
      // Microphone not available, continue without amplitude
    }

    // Speech Recognition
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setTranscript('Speech Recognition nu este disponibil în acest browser.');
      setActive(false);
      return;
    }
    const rec = new SR();
    rec.lang = 'ro-RO';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setTranscript(t);
      if (e.results[e.results.length - 1].isFinal) {
        if (onResult) onResult(t);
      }
    };
    rec.onerror = () => stopAll();
    rec.onend = () => stopAll();
    recRef.current = rec;
    rec.start();
  };

  const stopAll = () => {
    setActive(false);
    setAmplitude(0);
    analyserRef.current = null;
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    if (recRef.current) { try { recRef.current.stop(); } catch {} recRef.current = null; }
  };

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          position: 'relative',
          width: 240,
          height: 240,
          cursor: 'pointer',
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 50% 50%, #1a0a3a, #050010)',
          boxShadow: active
            ? '0 0 40px rgba(251,191,36,0.4), 0 0 80px rgba(124,58,237,0.2)'
            : '0 0 25px rgba(167,139,250,0.3)',
        }}
        onClick={active ? stopAll : startRecognition}
        title={active ? 'Oprește' : 'Activează asistentul vocal'}
      >
        <canvas ref={canvasRef} width={240} height={240} style={{ display: 'block' }} />
        <div style={{
          position: 'absolute', bottom: 16, left: 0, right: 0,
          textAlign: 'center', color: active ? '#fbbf24' : '#a78bfa',
          fontSize: 11, fontWeight: 600, letterSpacing: 1,
        }}>
          {active ? 'ASCULT...' : 'ZEUS VOICE'}
        </div>
      </div>

      <div style={{
        width: 240, minHeight: 40,
        background: 'rgba(124,58,237,0.08)',
        border: `1px solid ${active ? '#fbbf2444' : '#7c3aed33'}`,
        borderRadius: 10, padding: '8px 14px',
        color: transcript ? '#e2e8f0' : '#64748b',
        fontSize: 13, lineHeight: 1.5,
        transition: 'border-color 0.3s',
      }}>
        {transcript || placeholder}
      </div>
    </div>
  );
};

export default HolographicVoice;

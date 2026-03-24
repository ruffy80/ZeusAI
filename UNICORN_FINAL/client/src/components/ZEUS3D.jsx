
import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, Box, Cylinder, Torus } from '@react-three/drei';
import { useTranslation } from 'react-i18next';

function ZeusFace() {
  const groupRef = useRef();
  const hairGroupRef = useRef();
  useFrame((state) => {
    groupRef.current.rotation.y += 0.002;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
    if (hairGroupRef.current) {
      hairGroupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.8) * 0.1;
      hairGroupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
    }
  });
  return (
    <group ref={groupRef}>
      <Sphere args={[1.2, 64, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#ddbb99" emissive="#aa8866" roughness={0.3} metalness={0.7} />
      </Sphere>
      <Sphere args={[0.25, 32, 32]} position={[-0.45, 0.35, 1.05]}>
        <meshStandardMaterial color="#ffffff" emissive="#44aaff" />
      </Sphere>
      <Sphere args={[0.12, 32, 32]} position={[-0.45, 0.35, 1.18]}>
        <meshStandardMaterial color="#000000" emissive="#222222" />
      </Sphere>
      <Sphere args={[0.25, 32, 32]} position={[0.45, 0.35, 1.05]}>
        <meshStandardMaterial color="#ffffff" emissive="#44aaff" />
      </Sphere>
      <Sphere args={[0.12, 32, 32]} position={[0.45, 0.35, 1.18]}>
        <meshStandardMaterial color="#000000" emissive="#222222" />
      </Sphere>
      <Torus args={[0.45, 0.08, 32, 100]} rotation={[0.2, 0, 0]} position={[0, -0.1, 1.08]}>
        <meshStandardMaterial color="#cc8866" emissive="#aa6644" />
      </Torus>
      <Box args={[0.6, 0.1, 0.15]} position={[-0.5, 0.65, 1.02]}>
        <meshStandardMaterial color="#886644" />
      </Box>
      <Box args={[0.6, 0.1, 0.15]} position={[0.5, 0.65, 1.02]}>
        <meshStandardMaterial color="#886644" />
      </Box>
      <group ref={hairGroupRef} position={[0, -0.3, -0.8]}>
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const x = Math.sin(angle) * 0.9;
          const z = Math.cos(angle) * 0.6;
          return (
            <Cylinder key={i} args={[0.08, 0.15, 0.7, 6]} position={[x, -0.4, z]} rotation={[0.3, angle, 0.2]}>
              <meshStandardMaterial color="#f0f0f0" emissive="#cccccc" />
            </Cylinder>
          );
        })}
        {[...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const x = Math.sin(angle) * 1.0;
          const z = Math.cos(angle) * 0.8;
          return (
            <Cylinder key={`long-${i}`} args={[0.06, 0.12, 0.9, 6]} position={[x, -0.7, z]} rotation={[0.4, angle, 0.1]}>
              <meshStandardMaterial color="#f8f8f8" emissive="#dddddd" />
            </Cylinder>
          );
        })}
      </group>
      <Sphere args={[0.35, 32, 32]} position={[-1.05, 0, 0]}>
        <meshStandardMaterial color="#ddbb99" />
      </Sphere>
      <Sphere args={[0.35, 32, 32]} position={[1.05, 0, 0]}>
        <meshStandardMaterial color="#ddbb99" />
      </Sphere>
    </group>
  );
}

export default function ZEUS3D() {
  const { t } = useTranslation();
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState('');
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      if (transcript.includes('dashboard')) { setResponse('Opening dashboard...'); window.location.href = '/dashboard'; }
      else if (transcript.includes('codex')) { setResponse('Opening codex...'); window.location.href = '/codex'; }
      else { setResponse("I didn't understand. Try 'dashboard' or 'codex'."); }
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    if (listening) recognition.start();
    return () => recognition.abort();
  }, [listening]);
  return (
    <div className="relative">
      <div className="w-full h-96">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <spotLight position={[-5, 5, 5]} angle={0.3} intensity={0.8} />
          <ZeusFace />
          <OrbitControls enableZoom={false} />
        </Canvas>
      </div>
      <button onClick={() => setListening(true)} className="mt-4 px-4 py-2 bg-cyan-500 text-black rounded-full hover:bg-cyan-400 transition">
        {listening ? t('listening') : t('speak_to_zeus')}
      </button>
      {response && <p className="mt-2 text-sm text-cyan-300">{response}</p>}
    </div>
  );
}

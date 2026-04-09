import React, { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// ─── Color palette (dark cosmic marble Zeus matching the concept art) ────────
const C = {
  skin:       '#243550',
  skinLight:  '#2e4a6a',
  hair:       '#0e1020',
  hairMid:    '#181830',
  robe:       '#080814',
  robeMid:    '#0d0d22',
  gold:       '#c8920a',
  goldLight:  '#e8b030',
  goldEmit:   '#7a4c00',
  eye:        '#00d8ff',
  eyeEmit:    '#00aaff',
  lightning:  '#b8d8ff',
  lightnEmit: '#6699ff',
  halo:       '#d4a800',
  haloEmit:   '#aa7a00',
};

// ─── Shared material creators (new each mount; memoised per component) ───────
const mkMat = (color, roughness = 0.35, metalness = 0.1, emissive, emissiveIntensity = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness,
    emissive: emissive || '#000000', emissiveIntensity });

// ─── Hair strand (a tapered cylinder) ───────────────────────────────────────
function HairStrand({ pos, rot, scale }) {
  return (
    <mesh position={pos} rotation={rot} scale={scale}>
      <cylinderGeometry args={[0.04, 0.01, 1, 8]} />
      <meshStandardMaterial color={C.hair} roughness={0.8} />
    </mesh>
  );
}

// ─── Zeus flowing dark hair ──────────────────────────────────────────────────
function ZeusHair({ hairRef }) {
  const strands = [
    // Back-left curtain
    { pos: [-0.28, 0.1, -0.3], rot: [0.3, -0.3, 0.2], scale: [1, 1.4, 1] },
    { pos: [-0.35, -0.05, -0.25], rot: [0.5, -0.2, 0.3], scale: [0.9, 1.6, 0.9] },
    { pos: [-0.42, -0.15, -0.1], rot: [0.6, -0.15, 0.4], scale: [0.8, 1.5, 0.8] },
    { pos: [-0.38, -0.3, 0.0], rot: [0.8, -0.1, 0.35], scale: [0.7, 1.3, 0.7] },
    // Back-right curtain
    { pos: [0.28, 0.1, -0.3], rot: [0.3, 0.3, -0.2], scale: [1, 1.4, 1] },
    { pos: [0.35, -0.05, -0.25], rot: [0.5, 0.2, -0.3], scale: [0.9, 1.6, 0.9] },
    { pos: [0.42, -0.15, -0.1], rot: [0.6, 0.15, -0.4], scale: [0.8, 1.5, 0.8] },
    { pos: [0.38, -0.3, 0.0], rot: [0.8, 0.1, -0.35], scale: [0.7, 1.3, 0.7] },
    // Top of head volume
    { pos: [-0.15, 0.45, -0.05], rot: [0.1, -0.3, 0.1], scale: [0.7, 0.8, 0.7] },
    { pos: [0.0, 0.47, -0.1], rot: [0.15, 0, 0], scale: [0.8, 0.9, 0.8] },
    { pos: [0.15, 0.45, -0.05], rot: [0.1, 0.3, -0.1], scale: [0.7, 0.8, 0.7] },
    // Long back strands reaching down (behind body)
    { pos: [-0.22, -0.2, -0.38], rot: [0.2, -0.2, 0.15], scale: [0.9, 2.0, 0.9] },
    { pos: [0.22, -0.2, -0.38], rot: [0.2, 0.2, -0.15], scale: [0.9, 2.0, 0.9] },
    { pos: [0.0, -0.1, -0.42], rot: [0.1, 0, 0], scale: [1.0, 2.2, 1.0] },
  ];

  return (
    <group ref={hairRef}>
      {/* Hair cap on top of head */}
      <mesh position={[0, 0.35, -0.05]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[0.47, 24, 12, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
        <meshStandardMaterial color={C.hair} roughness={0.75} />
      </mesh>
      {strands.map((s, i) => (
        <HairStrand key={i} pos={s.pos} rot={s.rot} scale={s.scale} />
      ))}
    </group>
  );
}

// ─── Zeus beard ──────────────────────────────────────────────────────────────
function ZeusBeard() {
  const strands = [
    { pos: [0, -0.35, 0.35], rot: [0.6, 0, 0], scale: [1.2, 1, 1.2] },
    { pos: [-0.12, -0.3, 0.38], rot: [0.5, -0.15, 0.05], scale: [1, 1, 1] },
    { pos: [0.12, -0.3, 0.38], rot: [0.5, 0.15, -0.05], scale: [1, 1, 1] },
    { pos: [-0.22, -0.25, 0.32], rot: [0.4, -0.3, 0.1], scale: [0.8, 0.9, 0.8] },
    { pos: [0.22, -0.25, 0.32], rot: [0.4, 0.3, -0.1], scale: [0.8, 0.9, 0.8] },
    { pos: [0, -0.45, 0.3], rot: [0.8, 0, 0], scale: [1, 1.2, 1] },
    { pos: [-0.1, -0.5, 0.28], rot: [0.9, -0.1, 0.05], scale: [0.7, 1.1, 0.7] },
    { pos: [0.1, -0.5, 0.28], rot: [0.9, 0.1, -0.05], scale: [0.7, 1.1, 0.7] },
    // Moustache area
    { pos: [-0.1, -0.19, 0.44], rot: [0.1, -0.2, 0.1], scale: [0.5, 0.4, 0.5] },
    { pos: [0.1, -0.19, 0.44], rot: [0.1, 0.2, -0.1], scale: [0.5, 0.4, 0.5] },
  ];
  return (
    <group>
      {strands.map((s, i) => (
        <HairStrand key={i} pos={s.pos} rot={s.rot} scale={s.scale} />
      ))}
    </group>
  );
}

// ─── Golden laurel crown ──────────────────────────────────────────────────────
function ZeusCrown() {
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const angle = (i / 9) * Math.PI - Math.PI / 2;
    const r = 0.44;
    return {
      pos: [Math.cos(angle) * r, 0.38 + Math.abs(Math.sin(angle)) * 0.05, Math.sin(angle) * 0.18 + 0.08],
      rot: [0, -angle * 0.5, angle * 0.3],
    };
  });
  return (
    <group>
      {/* Crown band */}
      <mesh position={[0, 0.32, 0.02]} rotation={[0.1, 0, 0]}>
        <torusGeometry args={[0.44, 0.025, 8, 48, Math.PI]} />
        <meshStandardMaterial color={C.gold} emissive={C.goldEmit} emissiveIntensity={0.6}
          metalness={0.9} roughness={0.15} />
      </mesh>
      {/* Leaf spikes */}
      {leaves.map((l, i) => (
        <mesh key={i} position={l.pos} rotation={l.rot} scale={[0.07, 0.15, 0.04]}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshStandardMaterial color={C.goldLight} emissive={C.goldEmit} emissiveIntensity={0.5}
            metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Shoulder pauldron (golden) ──────────────────────────────────────────────
function ZeusPauldron({ side }) {
  const x = side === 'left' ? -0.75 : 0.75;
  const signX = side === 'left' ? -1 : 1;
  return (
    <group position={[x, 1.15, 0]}>
      {/* Main dome */}
      <mesh scale={[1.1, 0.7, 0.9]}>
        <sphereGeometry args={[0.26, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
        <meshStandardMaterial color={C.gold} emissive={C.goldEmit} emissiveIntensity={0.4}
          metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Rim ring */}
      <mesh position={[0, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.25, 0.028, 8, 32]} />
        <meshStandardMaterial color={C.goldLight} emissive={C.goldEmit} emissiveIntensity={0.5}
          metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Decorative ridge */}
      <mesh position={[signX * 0.0, -0.04, 0.12]} rotation={[0, 0, signX * 0.3]}
        scale={[0.04, 0.22, 0.04]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial color={C.goldLight} emissive={C.goldEmit} emissiveIntensity={0.5}
          metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

// ─── Golden diagonal sash ────────────────────────────────────────────────────
function ZeusSash() {
  const sashPoints = [
    new THREE.Vector3(-0.45, 0.9, 0.38),
    new THREE.Vector3(-0.1, 0.6, 0.46),
    new THREE.Vector3(0.25, 0.2, 0.44),
    new THREE.Vector3(0.48, -0.15, 0.32),
  ];
  const curve = new THREE.CatmullRomCurve3(sashPoints);
  const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.04, 8, false);
  return (
    <>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial color={C.gold} emissive={C.goldEmit} emissiveIntensity={0.5}
          metalness={0.85} roughness={0.18} />
      </mesh>
      {/* Decorative studs along sash */}
      {[0.1, 0.35, 0.6, 0.85].map((t, i) => {
        const pt = curve.getPoint(t);
        return (
          <mesh key={i} position={[pt.x, pt.y, pt.z + 0.03]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color={C.goldLight} emissive={C.goldEmit} emissiveIntensity={0.6}
              metalness={0.9} roughness={0.1} />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Lightning bolt (crackles in right hand) ─────────────────────────────────
function LightningBolt({ lightningRef }) {
  return (
    <group ref={lightningRef} position={[0.12, -1.35, 0.1]}>
      {/* Main bolt body */}
      <mesh rotation={[0, 0, -0.4]}>
        <cylinderGeometry args={[0.015, 0.04, 0.7, 6]} />
        <meshStandardMaterial color={C.lightning} emissive={C.lightnEmit} emissiveIntensity={3}
          roughness={0} metalness={0} />
      </mesh>
      {/* Branch 1 */}
      <mesh position={[0.08, -0.15, 0.04]} rotation={[0.2, 0, -0.9]}>
        <cylinderGeometry args={[0.008, 0.022, 0.35, 5]} />
        <meshStandardMaterial color={C.lightning} emissive={C.lightnEmit} emissiveIntensity={3}
          roughness={0} />
      </mesh>
      {/* Branch 2 */}
      <mesh position={[-0.04, -0.28, 0.0]} rotation={[-0.1, 0, 0.7]}>
        <cylinderGeometry args={[0.008, 0.018, 0.28, 5]} />
        <meshStandardMaterial color={C.lightning} emissive={C.lightnEmit} emissiveIntensity={3}
          roughness={0} />
      </mesh>
      {/* Glow sphere at tip */}
      <mesh position={[0, -0.38, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color={C.lightning} emissive={C.lightnEmit} emissiveIntensity={4}
          transparent opacity={0.7} roughness={0} />
      </mesh>
    </group>
  );
}

// ─── Robe lower body ─────────────────────────────────────────────────────────
function ZeusRobe({ robeRef }) {
  return (
    <group ref={robeRef} position={[0, -0.15, 0]}>
      {/* Main robe volume */}
      <mesh position={[0, -0.6, -0.05]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.52, 0.72, 1.5, 24]} />
        <meshStandardMaterial color={C.robe} roughness={0.85} />
      </mesh>
      {/* Robe front drape fold */}
      <mesh position={[0.15, -0.5, 0.35]} scale={[0.6, 1.4, 0.3]}>
        <sphereGeometry args={[0.38, 12, 16]} />
        <meshStandardMaterial color={C.robeMid} roughness={0.9} />
      </mesh>
      {/* Golden hem at bottom */}
      <mesh position={[0, -1.38, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.65, 0.018, 8, 40]} />
        <meshStandardMaterial color={C.gold} emissive={C.goldEmit} emissiveIntensity={0.35}
          metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ─── Full Zeus figure with all animations ────────────────────────────────────
function ZeusAvatar({ speaking, listening }) {
  const groupRef = useRef();
  const headRef = useRef();
  const hairRef = useRef();
  const leftArmRef = useRef();
  const rightArmRef = useRef();
  const robeRef = useRef();
  const haloRef = useRef();
  const lightningRef = useRef();
  const torsoRef = useRef();
  const eyeLRef = useRef();
  const eyeRRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // ── Idle breathing (torso subtle scale) ──────────────────────────────────
    if (torsoRef.current) {
      const breathe = 1 + Math.sin(t * 1.15) * 0.012;
      torsoRef.current.scale.set(breathe, 1 + Math.sin(t * 1.15) * 0.008, breathe);
    }

    // ── Head – human-like gaze wander ────────────────────────────────────────
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.28) * 0.28 + Math.sin(t * 0.11) * 0.12;
      headRef.current.rotation.x = Math.sin(t * 0.19) * 0.09 + 0.06; // slight upward gaze
      headRef.current.rotation.z = Math.sin(t * 0.23) * 0.045;       // slight tilt
    }

    // ── Hair gentle flow (wind) ──────────────────────────────────────────────
    if (hairRef.current) {
      hairRef.current.rotation.z = Math.sin(t * 0.65) * 0.04;
      hairRef.current.rotation.x = Math.sin(t * 0.5) * 0.025;
    }

    // ── Whole body weight shift + hover float ────────────────────────────────
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 0.55) * 0.04;
      groupRef.current.rotation.y = Math.sin(t * 0.14) * 0.08 + 0.18; // slow revolve
    }

    // ── Robe gentle sway ────────────────────────────────────────────────────
    if (robeRef.current) {
      robeRef.current.rotation.z = Math.sin(t * 0.6) * 0.02;
      robeRef.current.rotation.x = Math.sin(t * 0.45) * 0.015;
    }

    // ── Left arm idle sway ──────────────────────────────────────────────────
    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = Math.sin(t * 1.1) * 0.025 + 0.12;
      leftArmRef.current.rotation.x = Math.sin(t * 0.75) * 0.03;
    }

    // ── Right arm commanding gesture ────────────────────────────────────────
    if (rightArmRef.current) {
      const power = speaking ? 1.4 : 1;
      rightArmRef.current.rotation.z = -0.38 + Math.sin(t * 0.6) * 0.08 * power;
      rightArmRef.current.rotation.x = Math.sin(t * 0.8) * 0.04 * power - 0.15;
    }

    // ── Halo slow rotation + pulse ──────────────────────────────────────────
    if (haloRef.current) {
      haloRef.current.rotation.z = t * 0.09;
      haloRef.current.rotation.x = Math.sin(t * 0.3) * 0.05;
      const pulse = 1 + Math.sin(t * 2.2) * 0.06;
      haloRef.current.scale.set(pulse, pulse, pulse);
    }

    // ── Lightning crackle ──────────────────────────────────────────────────
    if (lightningRef.current) {
      const flicker = 2 + Math.sin(t * 18) * 1 + Math.random() * 1.5;
      lightningRef.current.children.forEach(child => {
        if (child.material) child.material.emissiveIntensity = flicker;
      });
      lightningRef.current.rotation.z = Math.sin(t * 12) * 0.06;
    }

    // ── Eye glow pulse (when listening) ────────────────────────────────────
    if (eyeLRef.current && eyeRRef.current) {
      const eyePulse = listening ? 2 + Math.sin(t * 8) * 1.5 : 1.5 + Math.sin(t * 2) * 0.3;
      eyeLRef.current.material.emissiveIntensity = eyePulse;
      eyeRRef.current.material.emissiveIntensity = eyePulse;
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.1, 0]} rotation={[0, 0.18, 0]}>

      {/* ── GOLDEN HALO ─────────────────────────────────────────────────── */}
      <group ref={haloRef} position={[0, 1.82, -0.28]}>
        <mesh>
          <torusGeometry args={[0.92, 0.038, 16, 80]} />
          <meshStandardMaterial color={C.halo} emissive={C.haloEmit} emissiveIntensity={1.2}
            metalness={1} roughness={0.05} />
        </mesh>
        {/* Outer soft glow ring */}
        <mesh>
          <torusGeometry args={[0.96, 0.1, 8, 60]} />
          <meshStandardMaterial color="#ffaa00" emissive="#ff7700" emissiveIntensity={0.4}
            transparent opacity={0.22} roughness={0} />
        </mesh>
        {/* Star spikes on halo */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.92, Math.sin(a) * 0.92, 0]}
              rotation={[0, 0, a]}>
              <cylinderGeometry args={[0.008, 0.001, 0.14, 4]} />
              <meshStandardMaterial color={C.goldLight} emissive={C.gold} emissiveIntensity={1}
                metalness={1} roughness={0} />
            </mesh>
          );
        })}
      </group>

      {/* ── HEAD ────────────────────────────────────────────────────────── */}
      <group ref={headRef} position={[0, 1.72, 0]}>

        {/* Skull base */}
        <mesh>
          <sphereGeometry args={[0.48, 32, 32]} />
          <meshStandardMaterial color={C.skin} roughness={0.28} metalness={0.12} />
        </mesh>
        {/* Forehead brow mass */}
        <mesh position={[0, 0.14, 0.38]} scale={[1, 0.38, 0.55]}>
          <sphereGeometry args={[0.38, 20, 12]} />
          <meshStandardMaterial color={C.skin} roughness={0.28} metalness={0.1} />
        </mesh>
        {/* Strong jaw */}
        <mesh position={[0, -0.28, 0.16]} scale={[0.88, 0.55, 0.82]}>
          <sphereGeometry args={[0.42, 16, 16]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} metalness={0.1} />
        </mesh>
        {/* Cheekbones */}
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * 0.3, -0.04, 0.34]} scale={[0.65, 0.42, 0.52]}>
            <sphereGeometry args={[0.22, 12, 12]} />
            <meshStandardMaterial color={C.skinLight} roughness={0.3} metalness={0.1} />
          </mesh>
        ))}

        {/* ── Eyes ─────────────────────────────────────────────────── */}
        {[-1, 1].map((s, idx) => (
          <group key={s} position={[s * 0.165, 0.065, 0.42]}>
            {/* White sclera */}
            <mesh>
              <sphereGeometry args={[0.075, 16, 16]} />
              <meshStandardMaterial color="#d0d8e8" roughness={0.05} />
            </mesh>
            {/* Iris glow */}
            <mesh ref={idx === 0 ? eyeLRef : eyeRRef} position={[0, 0, 0.06]}>
              <circleGeometry args={[0.046, 20]} />
              <meshStandardMaterial color={C.eye} emissive={C.eyeEmit} emissiveIntensity={1.5}
                roughness={0} />
            </mesh>
            {/* Pupil */}
            <mesh position={[0, 0, 0.065]}>
              <circleGeometry args={[0.022, 14]} />
              <meshStandardMaterial color="#001428" roughness={0} />
            </mesh>
          </group>
        ))}

        {/* Eyebrows (thick) */}
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * 0.165, 0.19, 0.44]} rotation={[0, 0, s * -0.22]}
            scale={[1, 0.28, 0.45]}>
            <cylinderGeometry args={[0.095, 0.06, 0.2, 8]} />
            <meshStandardMaterial color={C.hair} roughness={0.7} />
          </mesh>
        ))}

        {/* Nose */}
        <mesh position={[0, -0.04, 0.47]} rotation={[0.25, 0, 0]}
          scale={[0.7, 1, 0.65]}>
          <cylinderGeometry args={[0.04, 0.065, 0.22, 10]} />
          <meshStandardMaterial color={C.skin} roughness={0.35} metalness={0.1} />
        </mesh>
        {/* Nose tip */}
        <mesh position={[0, -0.15, 0.48]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color={C.skin} roughness={0.35} />
        </mesh>

        {/* Lips */}
        <mesh position={[0, -0.25, 0.43]} scale={[1, 0.55, 0.9]}>
          <sphereGeometry args={[0.085, 14, 8]} />
          <meshStandardMaterial color="#1c3050" roughness={0.55} />
        </mesh>

        {/* ── Beard ─────────────────────────────────────────────────── */}
        <ZeusBeard />

        {/* ── Hair ──────────────────────────────────────────────────── */}
        <ZeusHair hairRef={hairRef} />

        {/* ── Crown ─────────────────────────────────────────────────── */}
        <ZeusCrown />
      </group>

      {/* ── NECK ───────────────────────────────────────────────────────── */}
      <mesh position={[0, 1.24, 0.02]}>
        <cylinderGeometry args={[0.17, 0.2, 0.34, 16]} />
        <meshStandardMaterial color={C.skin} roughness={0.28} metalness={0.1} />
      </mesh>

      {/* ── TORSO ──────────────────────────────────────────────────────── */}
      <group ref={torsoRef}>
        {/* Chest main mass */}
        <mesh position={[0, 0.82, 0]} scale={[1, 1, 0.68]}>
          <sphereGeometry args={[0.56, 28, 28]} />
          <meshStandardMaterial color={C.skin} roughness={0.27} metalness={0.12} />
        </mesh>
        {/* Pec muscles */}
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * 0.23, 0.96, 0.35]} scale={[0.78, 0.68, 0.58]}>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color={C.skinLight} roughness={0.25} metalness={0.12} />
          </mesh>
        ))}
        {/* Abs center line */}
        <mesh position={[0, 0.52, 0.34]} scale={[0.55, 1.1, 0.42]}>
          <sphereGeometry args={[0.32, 14, 14]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} metalness={0.1} />
        </mesh>
        {/* Waist */}
        <mesh position={[0, 0.18, 0.0]}>
          <cylinderGeometry args={[0.37, 0.34, 0.52, 20]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} metalness={0.1} />
        </mesh>
        {/* ── Golden sash ───────────────────────────────────────────── */}
        <ZeusSash />
      </group>

      {/* ── SHOULDER PAULDRONS (gold) ──────────────────────────────────── */}
      <ZeusPauldron side="left" />
      <ZeusPauldron side="right" />

      {/* ── LEFT ARM (relaxed at side) ─────────────────────────────────── */}
      <group ref={leftArmRef} position={[-0.66, 0.9, 0.02]} rotation={[0, 0, 0.12]}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.21, 16, 16]} />
          <meshStandardMaterial color={C.skin} roughness={0.28} metalness={0.1} />
        </mesh>
        <mesh position={[-0.05, -0.32, 0]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.155, 0.135, 0.58, 16]} />
          <meshStandardMaterial color={C.skin} roughness={0.28} metalness={0.1} />
        </mesh>
        <mesh position={[-0.09, -0.63, 0]}>
          <sphereGeometry args={[0.135, 12, 12]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} />
        </mesh>
        <mesh position={[-0.12, -0.9, 0.06]} rotation={[0.2, 0, 0.14]}>
          <cylinderGeometry args={[0.115, 0.1, 0.52, 16]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} />
        </mesh>
        <mesh position={[-0.14, -1.18, 0.1]}>
          <sphereGeometry args={[0.115, 12, 12]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} />
        </mesh>
        {/* Bracer */}
        <mesh position={[-0.11, -0.75, 0.03]} rotation={[0.2, 0, 0.14]}>
          <torusGeometry args={[0.12, 0.024, 8, 24]} />
          <meshStandardMaterial color={C.gold} emissive={C.goldEmit} emissiveIntensity={0.45}
            metalness={0.85} roughness={0.18} />
        </mesh>
        <mesh position={[-0.12, -0.88, 0.06]} rotation={[0.2, 0, 0.14]}>
          <torusGeometry args={[0.108, 0.018, 8, 24]} />
          <meshStandardMaterial color={C.goldLight} emissive={C.goldEmit} emissiveIntensity={0.4}
            metalness={0.9} roughness={0.12} />
        </mesh>
      </group>

      {/* ── RIGHT ARM (raised power pose) ─────────────────────────────── */}
      <group ref={rightArmRef} position={[0.66, 0.92, 0.04]} rotation={[0, 0, -0.38]}>
        <mesh>
          <sphereGeometry args={[0.21, 16, 16]} />
          <meshStandardMaterial color={C.skin} roughness={0.28} metalness={0.1} />
        </mesh>
        <mesh position={[0.08, -0.28, 0.0]} rotation={[0, 0, -0.18]}>
          <cylinderGeometry args={[0.155, 0.135, 0.56, 16]} />
          <meshStandardMaterial color={C.skin} roughness={0.28} metalness={0.1} />
        </mesh>
        <mesh position={[0.13, -0.57, 0]}>
          <sphereGeometry args={[0.135, 12, 12]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} />
        </mesh>
        <mesh position={[0.17, -0.82, 0.0]} rotation={[-0.25, 0, -0.12]}>
          <cylinderGeometry args={[0.115, 0.1, 0.5, 16]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} />
        </mesh>
        <mesh position={[0.19, -1.1, 0.0]}>
          <sphereGeometry args={[0.115, 12, 12]} />
          <meshStandardMaterial color={C.skin} roughness={0.3} />
        </mesh>
        {/* Bracer (more ornate on right) */}
        <mesh position={[0.16, -0.7, 0]} rotation={[-0.25, 0, -0.12]}>
          <torusGeometry args={[0.12, 0.028, 8, 24]} />
          <meshStandardMaterial color={C.gold} emissive={C.goldEmit} emissiveIntensity={0.5}
            metalness={0.88} roughness={0.15} />
        </mesh>
        <mesh position={[0.165, -0.82, 0]} rotation={[-0.25, 0, -0.12]}>
          <torusGeometry args={[0.108, 0.02, 8, 24]} />
          <meshStandardMaterial color={C.goldLight} emissive={C.goldEmit} emissiveIntensity={0.45}
            metalness={0.9} roughness={0.1} />
        </mesh>
        {/* ── Lightning bolt ─────────────────────────────────────── */}
        <LightningBolt lightningRef={lightningRef} />
      </group>

      {/* ── ROBE ───────────────────────────────────────────────────────── */}
      <ZeusRobe robeRef={robeRef} />

    </group>
  );
}

// ─── Cosmic nebula backdrop ───────────────────────────────────────────────────
function CosmicNebula() {
  return (
    <>
      {/* Left teal nebula */}
      <mesh position={[-4.5, 1.5, -9]}>
        <sphereGeometry args={[3.8, 12, 12]} />
        <meshStandardMaterial color="#003344" emissive="#004455" emissiveIntensity={0.6}
          transparent opacity={0.18} roughness={1} />
      </mesh>
      <mesh position={[-3, 0.5, -8]}>
        <sphereGeometry args={[2.5, 10, 10]} />
        <meshStandardMaterial color="#002233" emissive="#003366" emissiveIntensity={0.5}
          transparent opacity={0.22} roughness={1} />
      </mesh>
      {/* Right golden/warm nebula */}
      <mesh position={[4.5, 2.0, -10]}>
        <sphereGeometry args={[4, 12, 12]} />
        <meshStandardMaterial color="#331100" emissive="#552200" emissiveIntensity={0.55}
          transparent opacity={0.2} roughness={1} />
      </mesh>
      <mesh position={[3.2, 0.8, -8.5]}>
        <sphereGeometry args={[2.8, 10, 10]} />
        <meshStandardMaterial color="#221500" emissive="#443300" emissiveIntensity={0.5}
          transparent opacity={0.25} roughness={1} />
      </mesh>
    </>
  );
}

// ─── Main 3D scene ───────────────────────────────────────────────────────────
function ZeusScene({ speaking, listening }) {
  return (
    <>
      {/* Ambient base light */}
      <ambientLight intensity={0.25} color="#1a2040" />

      {/* Key light – golden from top-right (like the concept art) */}
      <pointLight position={[3, 5, 3]} intensity={2.2} color="#d4a030" distance={20} />

      {/* Fill light – cyan from left */}
      <pointLight position={[-4, 2, 2]} intensity={1.4} color="#0090c0" distance={18} />

      {/* Rim light – deep blue from behind */}
      <pointLight position={[0, 3, -6]} intensity={0.9} color="#1030a0" distance={15} />

      {/* Lightning light (flickers near right hand) */}
      <pointLight position={[1.5, -0.5, 1.5]} intensity={speaking ? 1.8 : 0.8}
        color="#88aaff" distance={8} />

      {/* Cosmic starfield */}
      <Stars radius={80} depth={50} count={3500} factor={4} saturation={0.6} fade speed={0.8} />

      {/* Sparkle particles */}
      <Sparkles count={60} scale={8} size={1.5} speed={0.25} color="#d4af37" />
      <Sparkles count={40} scale={6} size={1.0} speed={0.35} color="#00aaff" />

      {/* Nebula clouds */}
      <CosmicNebula />

      {/* The Zeus figure */}
      <Suspense fallback={null}>
        <ZeusAvatar speaking={speaking} listening={listening} />
      </Suspense>

      {/* Camera controls – limited so user can orbit but not go crazy */}
      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={10}
        maxPolarAngle={Math.PI / 1.7}
        minPolarAngle={Math.PI / 4}
        autoRotate={false}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────
const ZEUS3D = ({ onCommand, speaking = false, listening = false }) => {
  const [voiceInput, setVoiceInput] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const recognitionRef = useRef(null);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.lang = 'ro-RO';
    rec.onstart = () => setRecognizing(true);
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      setVoiceInput(text);
      if (onCommand) onCommand(text);
    };
    rec.onend = () => setRecognizing(false);
    rec.onerror = (e) => {
      setRecognizing(false);
      setVoiceInput('Eroare: ' + (e.error || 'necunoscută'));
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch (err) {
      setVoiceInput('Recunoaștere indisponibilă: ' + err.message);
      setRecognizing(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setRecognizing(false);
  };

  const isListening = listening || recognizing;

  return (
    <div style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {/* 3D Canvas */}
      <div style={{ width: '100%', height: 520, borderRadius: 24,
        overflow: 'hidden', background: 'radial-gradient(ellipse at center, #060616 0%, #020208 100%)',
        boxShadow: '0 0 60px #a78bfa44, 0 0 120px #4400aa22' }}>
        <Canvas
          camera={{ position: [0, 0.4, 5.5], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
        >
          <ZeusScene speaking={speaking || recognizing} listening={isListening} />
        </Canvas>
      </div>

      {/* Name plate */}
      <div style={{ textAlign: 'center', marginTop: 10, letterSpacing: 6,
        fontSize: 11, color: '#8b6900', textTransform: 'uppercase', fontWeight: 700 }}>
        ⚡ ZEUS — God of Thunder ⚡
      </div>

      {/* Voice command button */}
      <div style={{ textAlign: 'center', marginTop: 10, position: 'relative', zIndex: 2 }}>
        <button
          onClick={recognizing ? stopListening : startListening}
          style={{
            background: recognizing
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            color: 'white', border: 'none', borderRadius: 24,
            padding: '8px 28px', cursor: 'pointer', fontSize: 13,
            fontWeight: 600, letterSpacing: 1,
            boxShadow: recognizing ? '0 0 24px #ef4444bb' : '0 0 18px #7c3aedbb',
            transition: 'all 0.25s ease',
          }}
        >
          {recognizing ? '⏹ Stop' : '🎤 Comandă vocală'}
        </button>
        {voiceInput && (
          <div style={{ marginTop: 8, color: '#a78bfa', fontSize: 12,
            background: 'rgba(167,139,250,0.1)', borderRadius: 8,
            padding: '4px 14px', border: '1px solid #a78bfa44',
            display: 'inline-block' }}>
            "{voiceInput}"
          </div>
        )}
      </div>
    </div>
  );
};

export default ZEUS3D;

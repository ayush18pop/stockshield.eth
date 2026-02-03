---
name: Real-Time Data Visualization
description: 60 FPS Particle Systems & "Point Cloud" Charts (WANTEX Aesthetic)
---

# Real-Time Data Visualization (WANTEX Style)

## Visual Philosophy: "Data as Matter"

The reference image uses **Particle Systems** (dots forming shapes) rather than solid lines or shapes.
- **Charts** should look like point clouds.
- **Backgrounds** should be interactive 3D particle fields.
- **Gauges** should be dotted arcs.

## Technology Stack Update

- **Core**: `Three.js` + `@react-three/fiber` (R3F).
- **Abstractions**: `@react-three/drei` (OrbitControls, Points, Instances).
- **Shaders**: Custom GLSL for performance at 10k+ particles.

## Component: Particle Hero (The "Wave")

```tsx
// components/canvas/ParticleWave.tsx
"use client";
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Particles({ count = 5000 }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate random positions sphere/wave
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const t = Math.random() * 100;
      const factor = 20 + Math.random() * 100;
      const speed = 0.01 + Math.random() / 200;
      const x = Math.sin(t) * factor;
      const y = Math.cos(t) * factor;
      const z = Math.random() * -100; // Depth
      temp.push({ t, factor, speed, x, y, z, mx: 0, my: 0 });
    }
    return temp;
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;
    
    particles.forEach((particle, i) => {
      // Rotation logic
      let { t, factor, speed, x, y, z } = particle;
      t = particle.t += speed / 2;
      const a = Math.cos(t) + Math.sin(t * 1) / 10;
      const b = Math.sin(t) + Math.cos(t * 2) / 10;
      const s = Math.cos(t);
      
      // Update position
      dummy.position.set(
        (particle.mx / 10) * a + x + Math.cos(t / 10) * 10,
        (particle.my / 10) * b + y + Math.sin(t / 10) * 10,
        z
      );
      dummy.scale.set(s, s, s);
      dummy.rotation.set(s * 5, s * 5, s * 5);
      dummy.updateMatrix();
      
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <circleGeometry args={[0.05]} /> {/* Small dots */}
      <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} />
    </instancedMesh>
  );
}

export function ParticleHero() {
  return (
    <div className="absolute inset-0 -z-10 bg-[#050505]">
      <Canvas camera={{ position: [0, 0, 50], fov: 75 }}>
        <Particles count={3000} />
      </Canvas>
      {/* Gradient Overlay for Fade Effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]" />
    </div>
  );
}
```

## Component: Dotted Line Chart

Instead of `ctx.lineTo`, we use dots.

```tsx
// components/charts/DottedPriceChart.tsx
function drawPriceLine(ctx, data, width, height) {
  // ... calc x, y
  
  // Draw Dots instead of Line
  data.forEach((price, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((price - min) / range) * height;
    
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2); // 1.5px radius dot
    ctx.fillStyle = i === data.length - 1 ? '#FF4D00' : '#FFFFFF'; // Orange head, white trail
    ctx.fill();
  });
}
```

## Dashboard Layout Strategy

The "WANTEX" image shows a "Services" section (Bento grid). For the Dashboard:
- **Regime Panel**: A large square card with a particle globe indicating the regime.
- **Metrics**: Small square cards with "01", "02" labels and big numbers.
- **Log**: A terminal-like list with monospaced font.

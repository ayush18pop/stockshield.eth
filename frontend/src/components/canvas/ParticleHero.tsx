'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Premium "Living Data" Dome
function LivingDome() {
    const points = useRef<THREE.Points>(null);

    // 1. Geometry: High-density, structured yet organic
    const { positions, colors, randoms } = useMemo(() => {
        const count = 20000; // Premium density
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const randoms = new Float32Array(count); // For independent motion

        const color1 = new THREE.Color("#ffffff");
        const color2 = new THREE.Color("#FF4D00"); // Subtle Voltage Orange tint

        for (let i = 0; i < count; i++) {
            // Dome structure
            const r = 40 + Math.random() * 5; // Thicker shell
            const phi = Math.acos(1 - Math.random() * 0.7); // Cap it
            const theta = Math.random() * Math.PI * 2;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi) - 15; // Y position
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

            // Color mixing based on height/noise
            const mix = Math.random();
            // Mostly white, rare orange sparks
            const c = mix > 0.95 ? color2 : color1;

            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            randoms[i] = Math.random();
        }

        return { positions, colors, randoms };
    }, []);

    // 2. Animation: Simulating organic "breath" via Vertex Shader would be ideal, 
    // but CPU loop is fine for 15k particles if optimized.
    useFrame((state) => {
        if (!points.current) return;

        const time = state.clock.elapsedTime;

        // Global Rotation (Slow, majestic)
        points.current.rotation.y = time * 0.02;

        // Interactive Fluid Tilt
        // Lerp with heavy damping for "Premium" weight
        const mx = state.pointer.x * 0.05; // Subtle
        const my = state.pointer.y * 0.05;

        points.current.rotation.x = THREE.MathUtils.lerp(points.current.rotation.x, my + 0.05, 0.02);
        points.current.rotation.z = THREE.MathUtils.lerp(points.current.rotation.z, -mx, 0.02);

        // Note: Mutating 20k positions in JS loop is expensive. 
        // For "100x Premium", we just wiggle the entire object or use a shader.
        // Let's add a subtle "Pulse" scale to the whole object.
        const pulse = 1 + Math.sin(time * 0.5) * 0.02;
        points.current.scale.set(pulse, pulse, pulse);
    });

    return (
        <points ref={points} position={[0, -2, 0]}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={positions.length / 3}
                    array={positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={colors.length / 3}
                    array={colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.15}
                vertexColors
                transparent
                opacity={0.8}
                sizeAttenuation={true}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

export function ParticleHero() {
    return (
        <div className="absolute inset-0 w-full h-full bg-[#050505]">
            <Canvas camera={{ position: [0, 5, 50], fov: 40 }} dpr={[1, 2]}> {/* Lower FOV for cinematic look */}
                <color attach="background" args={['#050505']} />

                {/* The Star of the Show */}
                <LivingDome />

                {/* Subtle fog for depth cueing - NOT too strong to hide it */}
                <fog attach="fog" args={['#050505', 40, 100]} />
            </Canvas>

            {/* 
        PREMIUM GRAIN OVERLAY 
        High-freq noise for that "Film" look
      */}
            <div
                className="absolute inset-0 opacity-[0.08] pointer-events-none mix-blend-overlay"
                style={{
                    filter: 'contrast(120%) brightness(100%)',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Cinematic Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] pointer-events-none" />

            {/* Horizontal Scanline (Subtle Tech Feel) */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
        </div>
    );
}

'use client';

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Premium Starfield with enhanced density and glow
function Starfield() {
    const points = useRef<THREE.Points>(null);

    const { positions, colors, sizes } = useMemo(() => {
        const count = 15000; // Dense starfield
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);

        const colorWhite = new THREE.Color("#ffffff");
        const colorOrange = new THREE.Color("#FF4D00");
        const colorBlue = new THREE.Color("#4a90d9");

        for (let i = 0; i < count; i++) {
            // Spherical distribution for dome effect
            const radius = 30 + Math.random() * 50;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(1 - Math.random() * 1.2); // Hemisphere bias

            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.cos(phi) * 0.6 - 10; // Flatten and lower
            positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

            // Color distribution: mostly white, some orange accents, rare blue
            const colorRoll = Math.random();
            let c: THREE.Color;
            if (colorRoll > 0.97) {
                c = colorOrange;
            } else if (colorRoll > 0.94) {
                c = colorBlue;
            } else {
                c = colorWhite;
            }

            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            // Varied sizes for depth perception
            sizes[i] = 0.1 + Math.random() * 0.25;
        }

        return { positions, colors, sizes };
    }, []);

    useFrame((state) => {
        if (!points.current) return;
        const time = state.clock.elapsedTime;

        // Slow majestic rotation
        points.current.rotation.y = time * 0.015;

        // Subtle breathing pulse
        const pulse = 1 + Math.sin(time * 0.3) * 0.02;
        points.current.scale.set(pulse, pulse, pulse);

        // Mouse-reactive tilt
        const mx = state.pointer.x * 0.03;
        const my = state.pointer.y * 0.03;
        points.current.rotation.x = THREE.MathUtils.lerp(points.current.rotation.x, my + 0.1, 0.02);
        points.current.rotation.z = THREE.MathUtils.lerp(points.current.rotation.z, -mx, 0.02);
    });

    return (
        <points ref={points} position={[0, 0, 0]}>
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
                size={0.2}
                vertexColors
                transparent
                opacity={0.9}
                sizeAttenuation={true}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </points>
    );
}

// Glowing core in center
function GlowCore() {
    const mesh = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (!mesh.current) return;
        const time = state.clock.elapsedTime;
        mesh.current.scale.setScalar(1 + Math.sin(time * 0.5) * 0.1);
    });

    return (
        <mesh ref={mesh} position={[0, -5, -20]}>
            <sphereGeometry args={[8, 32, 32]} />
            <meshBasicMaterial color="#FF4D00" transparent opacity={0.08} />
        </mesh>
    );
}

export function ParticleHero() {
    return (
        <div className="absolute inset-0 w-full h-full bg-[#050505]">
            <Canvas
                camera={{ position: [0, 5, 45], fov: 45 }}
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: false }}
            >
                <color attach="background" args={['#050505']} />

                {/* Main starfield */}
                <Starfield />

                {/* Subtle glow core */}
                <GlowCore />

                {/* Depth fog */}
                <fog attach="fog" args={['#050505', 35, 90]} />
            </Canvas>

            {/* Film grain overlay */}
            <div
                className="absolute inset-0 opacity-[0.06] pointer-events-none mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Cinematic vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_40%,#050505_100%)] pointer-events-none" />

            {/* Subtle scan lines */}
            <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_3px] pointer-events-none opacity-30" />
        </div>
    );
}

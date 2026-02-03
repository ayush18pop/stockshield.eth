---
name: Next.js Enterprise Patterns
description: "WANTEX Stack": Next.js 14 + Reac Three Fiber + Tailwind
---

# Next.js Enterprise Patterns (WANTEX Edition)

## Stack Additions

To achieve the "Point Cloud" aesthetic, we strictly require:

```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.100.0",
    "framer-motion": "^11.0.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "@types/three": "^0.160.0"
  }
}
```

## Project Structure Updates

Add a dedicated `canvas` directory for 3D scenes.

```
src/
├── components/
│   ├── canvas/             # 3D Scenes (Lazy loaded)
│   │   ├── ParticleWave.tsx
│   │   ├── RegimeGlobe.tsx
│   │   └── Scene.tsx       # Root canvas wrapper
│   ├── ui/                 # "Bento" UI components
│   │   ├── bento-grid.tsx
│   │   ├── glass-card.tsx
│   │   └── dot-matrix.tsx
```

## Layout Strategy: "The Grid"

The "WANTEX" image relies on a visible, structured grid.

**`globals.css` utility**:
```css
.bg-grid-pattern {
  background-size: 40px 40px;
  background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
}
```

**Root Layout**:
```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark bg-[#050505]">
      <body className="antialiased text-white selection:bg-[#FF4D00] selection:text-white">
        <div className="fixed inset-0 -z-20 bg-[#050505]" />
        <div className="fixed inset-0 -z-10 bg-grid-pattern opacity-20 pointer-events-none" />
        {children}
      </body>
    </html>
  );
}
```

## Lazy Loading 3D

3D covers the screen. To prevent Total Blocking Time (TBT), lazy load the canvas.

```tsx
// components/canvas/Scene.tsx
'use client'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'

export default function Scene({ children }) {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </Canvas>
    </div>
  )
}
```

## Font Configuration

```tsx
// app/fonts.ts
import { Inter, Space_Mono } from 'next/font/google'

export const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'
})

export const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono'
})
```

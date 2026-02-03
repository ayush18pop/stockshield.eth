---
name: Design System Implementation
description: "WANTEX AESTHETIC": Digital Brutalism x High-Tech Particle Systems
---

# Design System Implementation

## Philosophy: "Digital Brutalism x High-Tech"

**"ULTRATHINK" VISUAL LANGUAGE**:
- **Void Black**: The background is not dark gray; it is deep, infinite black (`#050505`).
- **Neon Signal**: Key interactions use a high-voltage orange (`#FF4D00`).
- **Structured Chaos**: Grid lines are visible (`border-white/10`). Layouts are asymmetric but aligned.
- **Data Texture**: Use dot matrices, pixel fonts, and raw numbers (01, 04, W/04) as decor.

## Color Tokens

```css
/* globals.css */
@layer base {
  :root {
    /* Base */
    --background: 0 0% 2%;        /* #050505 */
    --foreground: 0 0% 100%;      /* #FFFFFF */
    
    /* Primary Accent - Voltage Orange */
    --primary: 18 100% 50%;       /* #FF4D00 */
    --primary-foreground: 0 0% 100%;
    
    /* Secondary / Muted */
    --muted: 0 0% 12%;            /* #1F1F1F */
    --muted-foreground: 0 0% 60%;
    
    /* Cards */
    --card: 0 0% 4%;              /* #0A0A0A */
    --card-border: 0 0% 15%;      /* #262626 */
    
    /* Status */
    --success: 142 70% 50%;       /* Neon Green */
    --error: 0 100% 50%;          /* Pure Red */
  }
}
```

## Typography Strategy

**1. The "Clean" Layer (Content)**:
- Font: `Inter` or `Manrope`.
- Weights: 400 (Body), 500 (Labels).
- Tracking: Tight (-0.02em).

**2. The "Machine" Layer (Decor/Headers)**:
- Font: `Space Mono`, `JetBrains Mono`, or a "Dot Matrix" custom font.
- Usage: Section numbers ("01", "02"), big headers ("WANTEX"), data labels.
- Style: Uppercase, widely spaced or pixelated.

## Component Patterns

### 1. The "Bento" Grid Card
*As seen in the 'Projects' section of the reference.*

```tsx
// components/ui/bento-card.tsx
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

interface BentoCardProps {
  title: string;
  subtitle: string;
  number?: string;
  image?: string; // Abstract particle bg
  className?: string;
}

export function BentoCard({ title, subtitle, number, className }: BentoCardProps) {
  return (
    <div className={cn(
      "group relative flex flex-col justify-between overflow-hidden",
      "border border-white/10 bg-[#0A0A0A] p-6 transition-colors hover:border-[#FF4D00]/50",
      "rounded-sm", // Sharp or slightly rounded corners
      className
    )}>
      {/* Hover Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#FF4D00]/0 to-[#FF4D00]/5 opacity-0 transition-opacity group-hover:opacity-100" />
      
      {/* Header */}
      <div className="flex justify-between items-start z-10">
        <h3 className="text-xl font-medium tracking-tight text-white">{title}</h3>
        {number && (
          <span className="font-mono text-xs text-white/40 bg-white/5 px-2 py-1 rounded-sm">
            {number}
          </span>
        )}
      </div>
      
      {/* Footer */}
      <div className="mt-8 z-10 flex items-end justify-between">
        <p className="text-sm text-white/60 max-w-[80%]">{subtitle}</p>
        <div className="bg-[#FF4D00] p-1.5 rounded-sm opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0">
          <ArrowUpRight className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}
```

### 2. Dot Matrix Text
*As seen in the "W/04" and "V01" text in the reference.*

```tsx
// components/ui/dot-matrix.tsx
export function DotMatrix({ text, className }: { text: string, className?: string }) {
  // Implementation note: Ideally use a font like "Dot Matrix" or SVG mapping
  return (
    <span className={cn("font-mono font-bold tracking-widest uppercase", className)}>
      <span className="sr-only">{text}</span>
      {/* CSS effect for dots could go here, or just use a pixel font */}
      {text}
    </span>
  );
}
```

### 3. Primary Button (Voltage Style)

```tsx
<Button className="bg-[#FF4D00] hover:bg-[#CC3D00] text-white rounded-full px-8 py-6 text-sm font-medium tracking-wide transition-transform active:scale-95">
  Explore What's Next
</Button>
```

## Animation Tokens

- **Hover**: `transition-all duration-300 ease-out`.
- **Particles**: Slow, organic rotation (`animate-spin-slow`).
- **Reveal**: Staggered fade-up for grid items.

```css
/* Custom Utilities */
.glass-panel {
  background: rgba(10, 10, 10, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

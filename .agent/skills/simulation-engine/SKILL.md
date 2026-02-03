---
name: Simulation Engine Development
description: "Data-Driven Physics": Simulating Financial Markets for Particle Visualization
---

# Simulation Engine Development (WANTEX Edition)

## Philosophy: "The Ghost in the Machine"

The simulation engine is not just numbers; it drives the **Particle System**.
- **Price** = Wave Amplitude.
- **Volatility** = Particle Turbulence/Speed.
- **Volume** = Particle Density.
- **Circuit Breaker** = System "Freeze" Glitch Effect.

## Core Interfaces (Updated for Visuals)

```typescript
export interface SimulationState {
  // ... standard fields ...
  
  // Visual Drivers (Mapped 0-1 for Shaders)
  visuals: {
    turbulence: number;   // Driven by Volatility
    density: number;      // Driven by Volume/VPIN
    glitchFactor: number; // Driven by Circuit Breaker (0-1)
    colorShift: number;   // Driven by Regime
  };
}
```

## Simulation Runner Pattern

The ticker must run at **60 FPS locked** to sync with the React Three Fiber loop.

```typescript
// lib/simulation/runner.ts
class SimulationRunner {
  // ...
  
  private updateDerivedState() {
    // Map financial data to visual drivers
    const { volatility, vpin, circuitBreakerLevel } = this.state.protectionState;
    
    this.state.visuals = {
      turbulence: Math.min(volatility * 2, 1.0),
      density: Math.min(vpin + 0.2, 1.0),
      glitchFactor: circuitBreakerLevel / 4.0,
      colorShift: this.getRegimeColorShift(this.state.protectionState.currentRegime)
    };
  }
}
```

## Math Functions (Whitepaper + Visuals)

*(Standard Math functions from PRD remain here, but with added comments about their visual impact)*

### Circuit Breaker as "System Failure"
When `determineCircuitBreakerLevel` returns > 0, the UI should visually degrade (chromatic aberration, noise).

```typescript
export function determineCircuitBreakerLevel(...) {
  // ... logic ...
  // If Level 4 (Pause), the simulation time stops, but the rendering loop continues
  // with a "frozen" effect.
}
```

## Data Streaming for Particles

To feed 5000+ particles, avoid object allocation per frame. Use `Float32Array`.

```typescript
class DataStream {
  // Ring buffer for price history (visual trail)
  public priceBuffer: Float32Array = new Float32Array(1000);
  public ptr: number = 0;
  
  push(price: number) {
    this.priceBuffer[this.ptr] = price;
    this.ptr = (this.ptr + 1) % 1000;
  }
}
```

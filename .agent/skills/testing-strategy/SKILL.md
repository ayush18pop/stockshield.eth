---
name: Testing Strategy
description: "Visual Integrity": Performance & Shader Testing
---

# Testing Strategy (WANTEX Edition)

## Visual Regression Testing

The "Avant-Garde" aesthetic relies on pixel-perfect grids and particles.

**Tool**: Playwright + Percy (or pixelmatch).

```typescript
// e2e/visual.spec.ts
test('particle hero renders correctly', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000); // Wait for shader compile
  
  // Screenshot the canvas container only
  const hero = page.locator('#hero-canvas');
  await expect(hero).toHaveScreenshot('hero-particle-state.png', {
    threshold: 0.1, // Allow slight GPU variances
  });
});
```

## Performance Testing (Critical)

**Requirement**: 60 FPS with 3000 particles.

```typescript
// e2e/performance.spec.ts
test('maintains 60fps under load', async ({ page }) => {
  await page.goto('/demo');
  
  // Inject FPS meter
  const fps = await page.evaluate(() => {
    return new Promise(resolve => {
      let frames = 0;
      const start = performance.now();
      function loop() {
        frames++;
        if (performance.now() - start >= 1000) {
          resolve(frames);
        } else {
          requestAnimationFrame(loop);
        }
      }
      requestAnimationFrame(loop);
    });
  });
  
  expect(fps).toBeGreaterThan(55);
});
```

## Visual Integrity Checklist

1. **Dark Mode Depth**: Verify background is `#050505`, not `#000000` (monitor calibration issue prevention).
2. **Grid Alignment**: Check if `bento-grid` items align to the pixel grid (using helper overlay).
3. **Contrast**: Ensure "Voltage Orange" text passes WCAG on Black background (Orange #FF4D00 on Black #050505 is 5.6:1, passing AA).

## Unit Testing Shaders

Use `glsl-token-string` or partial mocks to test GLSL logic if complex. Usually, visual tests cover this.

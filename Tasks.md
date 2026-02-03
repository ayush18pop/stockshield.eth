# StockShield Frontend — Enterprise Master Plan

> **Vision**: Build a flagship, multi-billion dollar grade interface for DeFi LP protection.
> **Standards**: Zero runtime bugs, 60FPS performance, WCAG AA accessibility, "Avant-Garde" aesthetics, institutional-grade security, and battle-tested reliability.

---

## Phase 0: Enterprise Foundation & DevOps

### 0.1 Repository Initialization
- [ ] Initialize project with `pnpm create next-app@latest --typescript --tailwind --eslint --app`
- [ ] Configure `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] Set up path aliases (`@/components`, `@/lib`, `@/hooks`, `@/styles`)
- [ ] Initialize `.nvmrc` for Node version pinning (v20 LTS)
- [ ] Create `CONTRIBUTING.md` with branching strategy (Trunk-Based Development)

### 0.2 Code Quality & Linting (Zero Tolerance)
- [ ] **ESLint Configuration**:
  - [ ] Extend `next/core-web-vitals`, `plugin:@typescript-eslint/strict`
  - [ ] Add `eslint-plugin-jsx-a11y` for accessibility
  - [ ] Add `eslint-plugin-security` for security vulnerabilities
  - [ ] Add `eslint-plugin-import` for import ordering
- [ ] **Prettier Configuration**:
  - [ ] Install `prettier-plugin-tailwindcss` for class sorting
  - [ ] Configure `.prettierrc` with semicolons, single quotes, 100 char width
- [ ] **Pre-commit Hooks (Husky + lint-staged)**:
  - [ ] Run ESLint, Prettier, and TypeScript type-check on staged files
  - [ ] Enforce Conventional Commits with `@commitlint/config-conventional`

### 0.3 CI/CD Pipeline (GitHub Actions)
- [ ] **Workflow: `ci.yml`**
  - [ ] Job 1: `lint` — Run ESLint and Prettier check
  - [ ] Job 2: `typecheck` — Run `tsc --noEmit`
  - [ ] Job 3: `test:unit` — Run Vitest with coverage threshold (80%+)
  - [ ] Job 4: `test:e2e` — Run Playwright on Chromium, Firefox, WebKit
  - [ ] Job 5: `build` — Verify production build succeeds
- [ ] **Workflow: `deploy-preview.yml`**
  - [ ] Trigger on PR to `main`
  - [ ] Deploy to Vercel preview environment
  - [ ] Post preview URL as PR comment
- [ ] **Workflow: `security.yml`**
  - [ ] Run `npm audit` with `--audit-level=high`
  - [ ] Run GitHub CodeQL analysis for JavaScript/TypeScript

### 0.4 Security Hardening
- [ ] Configure `next.config.js` with strict Content Security Policy (CSP)
- [ ] Set security headers: `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`
- [ ] Implement rate limiting for API routes (if applicable)
- [ ] Set up **Sentry** for error tracking and performance monitoring
  - [ ] Configure source map uploads for production debugging
  - [ ] Set up alerts for error rate spikes

### 0.5 Observability & Monitoring
- [ ] Integrate **Vercel Analytics** or **Plausible** for privacy-friendly analytics
- [ ] Set up **Web Vitals** tracking (LCP, FID, CLS)
- [ ] Configure custom Sentry performance transactions for Demo simulations

---

## Phase 1: Design System — "Intentional Minimalism"

### 1.1 Theme Configuration
- [ ] **Color System**:
  - [ ] Define semantic tokens: `--color-shield-primary`, `--color-danger`, `--color-warning`
  - [ ] Create regime-specific colors: `--regime-core`, `--regime-overnight`, `--regime-weekend`
  - [ ] Implement dark mode as primary (light mode optional)
- [ ] **Typography**:
  - [ ] Configure Inter (or Outfit) as primary font via `next/font`
  - [ ] Define type scale: `text-xs` to `text-4xl` with tight tracking (-0.02em)
  - [ ] Enable `tabular-nums` for all numeric displays
- [ ] **Motion & Animation**:
  - [ ] Set up Framer Motion with spring physics presets
  - [ ] Define animation tokens: `transition-fast` (150ms), `transition-normal` (300ms)
  - [ ] Create reusable motion variants: `fadeIn`, `slideUp`, `scaleIn`

### 1.2 Component Library (Shadcn/UI Extended)
- [ ] Initialize Shadcn/UI with `slate` color scheme
- [ ] **Core Components**:
  - [ ] `Button` — Primary, Secondary, Ghost, Destructive variants with glow effects
  - [ ] `Card` — Standard and `GlassCard` (glassmorphism with backdrop-blur)
  - [ ] `Badge` — Status indicators for regimes, circuit breaker levels
  - [ ] `Tooltip` — Rich information display on hover
  - [ ] `Tabs` — For scenario selection
  - [ ] `Slider` — For speed control (1x, 5x, 10x, 60x)
  - [ ] `Select` — For scenario dropdown
- [ ] **Domain-Specific Components**:
  - [ ] `RegimeIndicator` — Animated badge showing current market regime
  - [ ] `FeeDisplay` — Real-time dynamic fee with breakdown tooltip
  - [ ] `CircuitBreakerMeter` — Visual level indicator (0-4)
  - [ ] `OracleAgeTimer` — Countdown/up timer with color coding

### 1.3 Data Visualization Components
- [ ] **`PriceChart`** (High-Performance):
  - [ ] Use Canvas-backed rendering (Visx or Recharts with canvas mode)
  - [ ] Support dual Y-axis (Price + VPIN)
  - [ ] Regime background coloring (gradient overlays)
  - [ ] Trade markers (triangles for buys, inverted for sells)
  - [ ] Gap event vertical lines
- [ ] **`PnLTracker`**:
  - [ ] Real-time comparison line chart
  - [ ] Color-coded: green (positive), red (negative)
  - [ ] Show absolute value and percentage
- [ ] **`VPINGauge`**:
  - [ ] Semi-circular gauge (0 to 1.0)
  - [ ] Color zones: Green (<0.3), Yellow (0.3-0.5), Orange (0.5-0.7), Red (>0.7)
  - [ ] Animated needle with spring physics
- [ ] **`EventTimeline`**:
  - [ ] Horizontal scrolling timeline
  - [ ] Event markers with icons (📰, ⚠️, 🛡️)
  - [ ] Auto-scroll to current simulation time
  - [ ] Click to jump to event

---

## Phase 2: Simulation Engine (The Brain)

### 2.1 Core Architecture
- [ ] **`SimulationState` Interface** (TypeScript):
  - [ ] `simulatedTime: Date`
  - [ ] `elapsedSeconds: number`
  - [ ] `oraclePrice: number`
  - [ ] `lastOracleUpdate: Date`
  - [ ] `poolState: { token0Reserve, token1Reserve, poolPrice, inventoryImbalance }`
  - [ ] `protectionState: { currentRegime, dynamicFee, volatility, vpin, circuitBreakerLevel, inGapAuction, gapAuctionEndTime }`
  - [ ] `lpPnL: number`
  - [ ] `feesCollected: number`
  - [ ] `tradesExecuted: Trade[]`
  - [ ] `events: Event[]`
- [ ] **`SimulationRunner` Class**:
  - [ ] Singleton pattern for global access
  - [ ] Tick-based loop using `requestAnimationFrame` (60 FPS target)
  - [ ] Support pause/resume, speed control (1x, 5x, 10x, 60x)
  - [ ] "Jump to Event" functionality
  - [ ] Seeded random for reproducibility

### 2.2 Mathematical Core (Whitepaper-Accurate)
- [ ] **Dynamic Fee Calculation**:
  ```ts
  function calculateDynamicFee(regime, volatility, vpin, inventoryImbalance): number
  // Fee = f₀ + ασ² + β·VPIN + γ·R + δ|I|
  // Returns fee in basis points, capped per regime
  ```
  - [ ] Implement base fee lookup by regime
  - [ ] Implement regime multiplier lookup
  - [ ] Apply volatility component (α = 0.5)
  - [ ] Apply VPIN component (β = 0.3)
  - [ ] Apply inventory component (δ = 0.02)
  - [ ] Apply fee caps (50-500 bps by regime)
  - [ ] **Unit Tests**: Verify calculation matches whitepaper examples

- [ ] **VPIN Calculation**:
  ```ts
  function calculateVPIN(trades: Trade[], bucketSize?: number, numBuckets?: number): number
  // VPIN = Σ|V_buy - V_sell| / (n × V_bucket)
  ```
  - [ ] Implement volume bucket aggregation
  - [ ] Use circular buffer for memory efficiency
  - [ ] Return 0.3 baseline if insufficient data
  - [ ] **Unit Tests**: Verify edge cases (empty trades, single trade)

- [ ] **Gap Auction Bid Calculation**:
  ```ts
  function calculateGapAuctionBid(gapPercent, liquidityValue, elapsedMinutes): number
  // MinBid(t) = Gap × L × 70% × e^(-0.4t)
  ```
  - [ ] Implement exponential decay
  - [ ] **Unit Tests**: Verify decay curve matches whitepaper

- [ ] **Circuit Breaker Logic**:
  ```ts
  function determineCircuitBreakerLevel(state: SimulationState): 0|1|2|3|4
  // Flags: oracle staleness, price deviation, VPIN, inventory
  ```
  - [ ] Implement flag detection logic
  - [ ] Return min(flagCount, 4)
  - [ ] **Unit Tests**: Verify each flag triggers correctly

- [ ] **LVR Calculation**:
  ```ts
  function calculateLVR(volatility, timeInYears): number
  // LVR Rate = σ²/8 per year
  ```

- [ ] **Oracle Staleness Detection**:
  ```ts
  function checkOracleStaleness(state): { level: string, message: string }
  // CORE hours: >60s = WARNING, >180s = DANGER, >300s = PAUSE
  ```

### 2.3 Scenario Engine
- [ ] **`ScenarioLoader`**:
  - [ ] Load initial state from scenario definition
  - [ ] Load event timeline (scheduled events)
  - [ ] Support "trigger" system (e.g., "At T+10s, Whale sells 5000 units")
- [ ] **Scenario Definitions** (JSON/TS config files):
  - [ ] Define initial pool state
  - [ ] Define oracle price feed
  - [ ] Define scheduled events with timestamps
  - [ ] Define expected outcomes for validation

---

## Phase 3: Demo Page (Priority ⭐ — The "Hackathon Winner")

### 3.1 Page Layout
- [ ] **Header Controls Bar**:
  - [ ] Scenario Selector (Dropdown with icons and difficulty stars)
  - [ ] Speed Control (1x/5x/10x/60x slider or buttons)
  - [ ] Transport Controls: ▶️ Play, ⏸️ Pause, 🔄 Reset, ⏭️ Skip to Event
- [ ] **Split-Screen Panels**:
  - [ ] Left: Traditional AMM (Unprotected)
  - [ ] Right: StockShield AMM (Protected)
  - [ ] Identical layout structure for easy comparison
- [ ] **Each Panel Contains**:
  - [ ] Price Chart (with trades)
  - [ ] LP PnL Tracker (real-time)
  - [ ] Metrics Panel (Fee, Regime, VPIN, Inventory, Circuit Breaker)
- [ ] **Bottom Timeline**:
  - [ ] Horizontal event timeline with time markers
  - [ ] Regime background coloring

### 3.2 Scenario Implementation (All 8)

#### Scenario 1: Overnight Earnings Surprise (AAPL)
- [ ] Initial State: AAPL @ $150, $100K liquidity, Thursday 3 PM ET
- [ ] Event: 5:30 PM — Earnings beat, +10% gap to $165
- [ ] Traditional: Arbitrage drains ~$2,270
- [ ] StockShield: Gap auction captures ~$920 for LPs
- [ ] Expected Delta: ~$1,590 saved

#### Scenario 2: Monday Morning Gap (TSLA)
- [ ] Initial State: TSLA @ $200, $50K liquidity, Friday 3 PM ET
- [ ] Event: Weekend Musk tweet, Monday open -15% @ $170
- [ ] Show weekend fee increase deterring trades
- [ ] Demonstrate Soft Open 30s pause + Gap Auction
- [ ] Expected Delta: Weekend protection + gap capture

#### Scenario 3: Flash Crash Recovery (MSFT)
- [ ] Initial State: MSFT @ $400, $75K liquidity, Tuesday 2:30 PM ET
- [ ] Event: 2:45 PM — Flash crash -12%, recovery in 45 seconds
- [ ] Traditional: Double loss (sell low, buy high) ~$3,120
- [ ] StockShield: Circuit breaker pauses trading, $0 loss
- [ ] Show CB level progression: 0→1→2→3→4→3→2→1→0

#### Scenario 4: Trading Halt — Oracle Staleness (GME)
- [ ] Initial State: GME @ $25, $20K liquidity, Wednesday 10 AM ET
- [ ] Event: 10:30 AM — NYSE halts GME for news pending
- [ ] Traditional: Informed traders exploit stale price
- [ ] StockShield: Detects oracle age >60s, triggers warning/pause
- [ ] Show Oracle Age Timer color progression

#### Scenario 5: Low-Liquidity Hour Attack (AMZN)
- [ ] Initial State: AMZN @ $180, $30K liquidity, Monday 5:30 AM ET
- [ ] Event: 6 AM — Whale manipulates thin ECN, exploits oracle lag
- [ ] Traditional: Attacker profits $100, LP loses $100
- [ ] StockShield: VPIN spike + PRE_MARKET fees reduce attack profit to $25

#### Scenario 6: Informed Trader — VPIN Detection (PFE)
- [ ] Initial State: PFE @ $40, $25K liquidity, Wednesday 4 PM ET
- [ ] Event: 4:30 PM — FDA announcement expected
- [ ] Show VPIN rising from 0.25 → 0.75 as one-sided buying occurs
- [ ] Traditional: Fixed 5 bps fee throughout
- [ ] StockShield: Fee increases 5→45 bps, pauses at VPIN 0.75

#### Scenario 7: Holiday Weekend Disaster (BAC)
- [ ] Initial State: BAC @ $35, $40K liquidity, Thursday 4 PM ET
- [ ] Event: Friday holiday, Sat European bank crisis, Monday open -12%
- [ ] Traditional: 200 shares traded @ $34.50, -$860 net
- [ ] StockShield: 10 shares traded (high fees), +$131 net

#### Scenario 8: Stale Oracle Attack (NVDA)
- [ ] Initial State: NVDA @ $800, $60K liquidity
- [ ] Event: Attacker front-runs pending oracle update in mempool
- [ ] Traditional: Attacker extracts $12/share
- [ ] StockShield: TWAP oracle reduces edge to $2/share

### 3.3 Real-Time Comparison Features
- [ ] **Live Delta Display**: "StockShield saved LPs: $X,XXX"
- [ ] **Flash Messages**:
  - [ ] "🛡️ Gap Auction Active — LP capturing 70% of gap value"
  - [ ] "⚠️ Circuit Breaker Level 3 — Depth reduced 75%"
  - [ ] "❌ Trading Paused — Extreme volatility detected"
- [ ] **Event Log Panel**:
  - [ ] Scrolling log of events with timestamps and severity colors
  - [ ] Click to filter by type (TRADE, NEWS, REGIME, etc.)

### 3.4 Responsiveness
- [ ] Desktop: Full side-by-side layout
- [ ] Tablet: Stacked panels with tab switching
- [ ] Mobile: Single panel with toggle + summary comparison

---

## Phase 4: Landing Page (The "Hook")

### 4.1 Hero Section
- [ ] **Visual**: 3D animated "shield" or abstract protection graphic (Three.js/R3F)
- [ ] **Headline**: "The Protection Layer for Tokenized Stock LPs"
- [ ] **Subheadline**: Explain discontinuous hedging problem in one line
- [ ] **CTAs**: "Launch App" (primary), "View Demo" (secondary)
- [ ] **Trust Signals**: "Built on Uniswap v4", "Yellow Network Powered"

### 4.2 Problem Statement Section
- [ ] **Interactive Visualization**:
  - [ ] Show clock with market hours (NYSE 9:30-4:00)
  - [ ] Animated price gap at market open
  - [ ] LP value draining to arbitrageurs
- [ ] **Statistics**: "LPs lose 40-60% more on tokenized securities vs. crypto"

### 4.3 Solution Overview Section
- [ ] **Four Features Grid/Bento**:
  - [ ] Regime Detection — Icon, title, description
  - [ ] Dynamic Fees — Icon, title, description
  - [ ] Gap Capture Auctions — Icon, title, description
  - [ ] Circuit Breakers — Icon, title, description
- [ ] Each card should have subtle hover animation

### 4.4 Technology Stack Section
- [ ] **Logo Carousel or Grid**:
  - [ ] Uniswap v4 Hooks
  - [ ] Yellow Network ERC-7824
  - [ ] ENS Integration
  - [ ] Chainlink/Pyth Oracles

### 4.5 Footer
- [ ] Navigation links: Docs, Demo, Launch App, GitHub
- [ ] Social links: Twitter, Discord
- [ ] Legal: Terms, Privacy
- [ ] Copyright

---

## Phase 5: Docs Page (Technical Reference)

### 5.1 Documentation Framework
- [ ] Set up Contentlayer or MDX for content management
- [ ] Configure sidebar navigation from folder structure
- [ ] Implement search functionality (Algolia DocSearch or local)

### 5.2 Content Structure
- [ ] **Introduction**
  - [ ] The LP Protection Problem
  - [ ] Why Tokenized Securities Are Different
- [ ] **Protocol Design**
  - [ ] Regime Detection
  - [ ] Dynamic Fee Engine
  - [ ] Gap Capture Auction
  - [ ] Circuit Breakers
- [ ] **Mathematics**
  - [ ] Fee Formula Breakdown (with LaTeX rendering)
  - [ ] LVR Theory
  - [ ] VPIN Calculation
- [ ] **Architecture**
  - [ ] Smart Contracts
  - [ ] Yellow Network Integration
  - [ ] ENS Integration
- [ ] **Edge Cases** (Link to Demo scenarios)
- [ ] **Whitepaper** (Embedded PDF or download)

### 5.3 Math Rendering
- [ ] Integrate KaTeX or MathJax for LaTeX formulas
- [ ] Style math blocks to match design system

---

## Phase 6: Launch App (Web3 Integration)

### 6.1 Wallet Connection
- [ ] Set up RainbowKit with custom theme matching design system
- [ ] Support MetaMask, WalletConnect, Coinbase Wallet
- [ ] Display connected address and network badge

### 6.2 Header Bar
- [ ] Current regime indicator
- [ ] Real-time dynamic fee display
- [ ] Wallet connect/disconnect button

### 6.3 Swap Interface
- [ ] Token pair selector (e.g., AAPL/USDC)
- [ ] Input/output amount fields
- [ ] **Fee Breakdown**:
  - [ ] Base fee
  - [ ] Regime adjustment
  - [ ] VPIN adjustment
  - [ ] Inventory adjustment
  - [ ] Total fee
- [ ] Protection status badge

### 6.4 Dashboard Panel
- [ ] LP position overview
- [ ] Pool stats: TVL, 24h Volume, Fees Earned
- [ ] Protection status indicators
- [ ] Add/Remove liquidity actions

### 6.5 Analytics Panel
- [ ] Historical fee chart
- [ ] Regime timeline visualization
- [ ] VPIN indicator
- [ ] Circuit breaker status

---

## Phase 7: Testing & Quality Assurance

### 7.1 Unit Testing (Vitest)
- [ ] **Simulation Engine Math**:
  - [ ] `calculateDynamicFee` — All regime/input combinations
  - [ ] `calculateVPIN` — Edge cases (empty, single trade, overflow)
  - [ ] `calculateGapAuctionBid` — Decay curve accuracy
  - [ ] `determineCircuitBreakerLevel` — All flag combinations
- [ ] **Coverage Target**: 90%+ for `lib/simulation/` directory

### 7.2 Component Testing
- [ ] Visual regression testing with Storybook + Chromatic (optional)
- [ ] Interaction testing for controls (play/pause, speed change)

### 7.3 E2E Testing (Playwright)
- [ ] **Demo Page Flows**:
  - [ ] Load demo page successfully
  - [ ] Select each scenario and verify it loads
  - [ ] Run simulation to completion (10x speed)
  - [ ] Verify PnL delta is non-zero
- [ ] **Wallet Connection**:
  - [ ] Mock wallet connection flow
  - [ ] Verify address displays correctly

### 7.4 Accessibility Testing
- [ ] Run Axe/WAVE automated scans
- [ ] Manual keyboard navigation test
- [ ] Screen reader testing (NVDA/VoiceOver)
- [ ] Color contrast verification

### 7.5 Performance Testing
- [ ] Lighthouse CI with thresholds:
  - [ ] Performance: 90+
  - [ ] Accessibility: 95+
  - [ ] Best Practices: 95+
  - [ ] SEO: 90+
- [ ] Demo page 60 FPS verification during 10x speed simulation

---

## Phase 8: Performance & Optimization

### 8.1 Rendering Performance
- [ ] Memoize chart components with `React.memo`
- [ ] Use `useMemo` for computed values
- [ ] Virtualize long lists (trade log) with `@tanstack/react-virtual`
- [ ] Debounce/throttle high-frequency state updates

### 8.2 Bundle Optimization
- [ ] Analyze bundle with `@next/bundle-analyzer`
- [ ] **Target**: Initial JS < 150KB gzipped
- [ ] Dynamic import heavy dependencies:
  - [ ] Chart libraries
  - [ ] Three.js (if used)
  - [ ] Sentry (non-blocking)
- [ ] Configure tree-shaking for unused code

### 8.3 Image Optimization
- [ ] Use `next/image` for all images
- [ ] Generate OG images dynamically with `@vercel/og`
- [ ] Use WebP/AVIF formats

---

## Phase 9: SEO & Final Polish

### 9.1 Meta & SEO
- [ ] Configure metadata for all pages
- [ ] Generate `sitemap.xml` and `robots.txt`
- [ ] Set up canonical URLs
- [ ] Add JSON-LD structured data for SoftwareApplication

### 9.2 Open Graph & Social
- [ ] Design and implement OG images for each page
- [ ] Configure Twitter card metadata
- [ ] Add social sharing functionality

### 9.3 Final Polish
- [ ] Favicon and app icons (all sizes)
- [ ] Loading states and skeletons
- [ ] Empty states
- [ ] Error states (404, 500 pages)
- [ ] Print styles (if applicable)

---

## Success Criteria Checklist

- [ ] Judges can trigger any attack scenario with one click
- [ ] Side-by-side comparison shows clear difference (Traditional loses, StockShield protects)
- [ ] Math matches whitepaper formulas exactly
- [ ] Simulations are visually compelling and easy to understand
- [ ] Demo runs without errors for 5-minute presentation
- [ ] 60 FPS performance maintained during all simulations
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] Lighthouse Performance score 90+
- [ ] Zero console errors or warnings in production

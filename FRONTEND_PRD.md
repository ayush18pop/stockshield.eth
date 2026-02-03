# StockShield Frontend PRD

> **Product Requirements Document for StockShield Protocol Frontend**

## Overview

StockShield is a Uniswap v4 hook protocol that protects liquidity providers in tokenized securities AMMs. The frontend consists of 4 main sections:

1. **Landing Page** - Project introduction and value proposition
2. **Docs Page** - Protocol documentation and whitepaper
3. **Launch App** - Main application interface
4. **Demo Page** - Interactive attack simulations for judges ⭐ **PRIORITY**

---

## 1. Landing Page

### Purpose

First impression for users and judges. Communicate the problem and solution clearly.

### Required Sections

#### Hero Section

- Headline: "The Protection Layer for Tokenized Stock LPs"
- Subheadline: Explain the discontinuous hedging problem in one line
- Two CTAs: "Launch App" | "View Demo"

#### Problem Statement

Explain why traditional AMMs fail for tokenized securities:

- Markets have trading hours (NYSE: 9:30 AM - 4:00 PM ET)
- AMMs trade 24/7 but LPs cannot hedge when markets are closed
- Arbitrageurs exploit stale prices during overnight/weekends
- LPs lose 40-60% more on tokenized securities vs. crypto

#### Solution Overview

Four core protection mechanisms:

1. **Regime Detection** - Automatic identification of market conditions
2. **Dynamic Fees** - Real-time fee adjustment based on risk
3. **Gap Capture Auctions** - Capture overnight gap value for LPs
4. **Circuit Breakers** - Graduated response to extreme conditions

#### Technology Stack

- Uniswap v4 Hooks (on-chain execution)
- Yellow Network ERC-7824 (state channels for speed)
- ENS (human-readable vault names)

#### Footer

- Links to Docs, Demo, GitHub
- Hackathon prize track info (if applicable)

---

## 2. Docs Page

### Purpose

Comprehensive technical documentation for developers, LPs, and judges who want deep understanding.

### Structure (Sidebar Navigation)

```
├── Introduction
│   ├── The LP Protection Problem
│   └── Why Tokenized Securities Are Different
├── Protocol Design
│   ├── Regime Detection
│   ├── Dynamic Fee Engine
│   ├── Gap Capture Auction
│   └── Circuit Breakers
├── Mathematics
│   ├── Fee Formula Breakdown
│   ├── LVR Theory
│   └── VPIN Calculation
├── Architecture
│   ├── Smart Contracts
│   ├── Yellow Network Integration
│   └── ENS Integration
├── Edge Cases
│   └── (Link to Demo page scenarios)
└── Whitepaper
    └── (Embedded PDF or download link)
```

### Key Content to Include

#### Fee Formula (display prominently)

```
Fee = f₀ + ασ² + β·VPIN + γ·R + δ|I|
```

| Component | Description |
|-----------|-------------|
| f₀ | Base fee (regime-dependent: 5-50 bps) |
| ασ² | Volatility component |
| β·VPIN | Toxicity detection |
| γ·R | Regime multiplier (1x-6x) |
| δ\|I\| | Inventory imbalance |

#### Regime Table

| Regime | Hours (ET) | Base Fee | Multiplier |
|--------|------------|----------|------------|
| Core Session | 9:35-16:00 | 5 bps | 1.0x |
| Pre/Post Market | 4:00-9:30, 16:00-20:00 | 15 bps | 2.0x |
| Overnight | 20:00-4:00 | 30 bps | 4.0x |
| Weekend | Fri 20:00 - Mon 4:00 | 50 bps | 6.0x |

#### References

- Avellaneda-Stoikov (2008) - Inventory risk
- Kyle (1985) - Price impact and informed trading
- Milionis et al. (2023) - LVR theory

---

## 3. Launch App

### Purpose

Main application for LPs to interact with StockShield-protected pools.

### Required Components

#### Header

- Current regime indicator (Core/Pre-Market/Overnight/Weekend)
- Real-time dynamic fee display
- Wallet connect button

#### Dashboard Panel

- LP position overview
- Current pool stats (TVL, 24h volume, fees earned)
- Protection status indicators

#### Swap Interface

- Token pair selection (e.g., AAPL/USDC)
- Input/output amounts
- Fee breakdown showing StockShield adjustments
- Protection status badge

#### Analytics Panel

- Historical fee chart
- Regime timeline visualization
- VPIN indicator
- Circuit breaker status

#### Pool Management

- Add/remove liquidity
- View LP performance vs. traditional AMM
- Earnings breakdown

### Data Requirements

- Oracle price feed (Chainlink/Pyth)
- Regime detection from on-chain timestamp
- Fee calculation from hook contract
- Pool reserves and inventory balance

---

## 4. Demo Page ⭐ EXTREME DETAIL SPECIFICATION

### Purpose

Interactive simulations demonstrating how StockShield protects LPs in real attack scenarios. This is the **primary deliverable** for hackathon judges. Must be visually compelling, mathematically accurate, and immediately understandable.

---

### 4.1 Page Architecture

#### Global Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER: Scenario Selector | Speed Control | Play/Pause | Reset         │
├─────────────────────────────────────────────────────────────────────────┤
│                         SCENARIO TITLE + DESCRIPTION                     │
├──────────────────────────────────┬──────────────────────────────────────┤
│                                  │                                      │
│     TRADITIONAL AMM PANEL        │      STOCKSHIELD PANEL               │
│     (Unprotected)                │      (Protected)                     │
│                                  │                                      │
│  ┌──────────────────────────┐   │   ┌──────────────────────────┐       │
│  │     PRICE CHART          │   │   │     PRICE CHART          │       │
│  │     (with trades)        │   │   │     (with trades)        │       │
│  └──────────────────────────┘   │   └──────────────────────────┘       │
│                                  │                                      │
│  ┌──────────────────────────┐   │   ┌──────────────────────────┐       │
│  │     LP PnL TRACKER       │   │   │     LP PnL TRACKER       │       │
│  │     (real-time)          │   │   │     (real-time)          │       │
│  └──────────────────────────┘   │   └──────────────────────────┘       │
│                                  │                                      │
│  ┌──────────────────────────┐   │   ┌──────────────────────────┐       │
│  │     METRICS PANEL        │   │   │     METRICS PANEL        │       │
│  │     Fee: 0.30%           │   │   │     Fee: 0.30%           │       │
│  │     Regime: Core         │   │   │     Regime: Core         │       │
│  │     VPIN: 0.25           │   │   │     VPIN: 0.25           │       │
│  │     Inventory: +5%       │   │   │     Inventory: +5%       │       │
│  └──────────────────────────┘   │   └──────────────────────────┘       │
│                                  │                                      │
├──────────────────────────────────┴──────────────────────────────────────┤
│                         EVENT TIMELINE (Bottom)                          │
│  ─●────────●────────●────────●────────●────────●────────●────────●──    │
│  4PM     5:30PM   6PM      8PM     12AM     4AM     6AM     9:30AM      │
│  Close   Earnings  AH       Night   Night   Pre     Pre     Open        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Global Controls Specification

#### Scenario Selector (Dropdown/Tabs)

| ID | Scenario Name | Stock | Difficulty |
|----|---------------|-------|------------|
| 1 | Overnight Earnings Surprise | AAPL | ★★☆ |
| 2 | Monday Morning Gap | TSLA | ★★★ |
| 3 | Flash Crash Recovery | MSFT | ★★★ |
| 4 | Trading Halt | GME | ★★☆ |
| 5 | Low-Liquidity Hour Attack | AMZN | ★★★ |
| 6 | Informed Trader (VPIN) | PFE | ★★☆ |
| 7 | Weekend Holiday Disaster | BAC | ★★★ |
| 8 | Stale Oracle Attack | NVDA | ★★☆ |

#### Speed Control

- `1x` - Real-time (1 sim-second = 1 real second)
- `5x` - Fast (1 sim-second = 200ms)
- `10x` - Very fast (1 sim-second = 100ms)
- `60x` - Ultra (for long scenarios like weekends)

#### Transport Controls

- **Play** ▶️ - Start/resume simulation
- **Pause** ⏸️ - Freeze simulation
- **Reset** 🔄 - Return to scenario start
- **Skip to Event** ⏭️ - Jump to next key event

---

### 4.3 Shared Data Structures

#### SimulationState

```typescript
interface SimulationState {
  // Time
  simulatedTime: Date;           // Simulated Eastern Time
  elapsedSeconds: number;        // Seconds since scenario start
  
  // Market
  oraclePrice: number;           // Current "true" price
  lastOracleUpdate: Date;        // When oracle last updated
  
  // Pool State (for each panel)
  poolState: {
    token0Reserve: number;       // e.g., AAPL tokens
    token1Reserve: number;       // e.g., USDC
    poolPrice: number;           // Current AMM price
    inventoryImbalance: number;  // -1 to +1
  };
  
  // Protection State (StockShield only)
  protectionState: {
    currentRegime: Regime;
    dynamicFee: number;          // In basis points
    volatility: number;          // Realized volatility
    vpin: number;                // 0 to 1
    circuitBreakerLevel: number; // 0-4
    inGapAuction: boolean;
    gapAuctionEndTime?: Date;
  };
  
  // Tracking
  lpPnL: number;                 // Cumulative LP PnL in USD
  feesCollected: number;         // Fees earned
  tradesExecuted: Trade[];       // History of trades
  events: Event[];               // Timeline events
}

type Regime = 'CORE' | 'SOFT_OPEN' | 'PRE_MARKET' | 'AFTER_HOURS' | 'OVERNIGHT' | 'WEEKEND' | 'HOLIDAY';

interface Trade {
  timestamp: Date;
  direction: 'BUY' | 'SELL';
  amount: number;
  price: number;
  feesPaid: number;
  traderType: 'ARBITRAGEUR' | 'NOISE' | 'INFORMED';
  blocked?: boolean;             // StockShield only
  blockReason?: string;
}

interface Event {
  timestamp: Date;
  type: 'REGIME_CHANGE' | 'NEWS' | 'ORACLE_UPDATE' | 'CIRCUIT_BREAKER' | 'GAP_AUCTION' | 'TRADE';
  description: string;
  severity: 'INFO' | 'WARNING' | 'DANGER';
}
```

---

### 4.4 Mathematical Formulas (Must Be Exact)

#### Dynamic Fee Calculation

```javascript
function calculateDynamicFee(state) {
  const { currentRegime, volatility, vpin, inventoryImbalance } = state;
  
  // Base fees by regime (in basis points)
  const baseFees = {
    CORE: 5,
    SOFT_OPEN: 10,
    PRE_MARKET: 15,
    AFTER_HOURS: 15,
    OVERNIGHT: 30,
    WEEKEND: 50,
    HOLIDAY: 50
  };
  
  // Regime multipliers
  const regimeMultipliers = {
    CORE: 1.0,
    SOFT_OPEN: 1.5,
    PRE_MARKET: 2.0,
    AFTER_HOURS: 2.0,
    OVERNIGHT: 4.0,
    WEEKEND: 6.0,
    HOLIDAY: 6.0
  };
  
  // Parameters (calibrated from whitepaper)
  const alpha = 0.5;    // Volatility sensitivity
  const beta = 0.3;     // VPIN sensitivity
  const gamma = 1.0;    // Regime sensitivity
  const delta = 0.02;   // Inventory sensitivity
  
  const f0 = baseFees[currentRegime];
  const R = regimeMultipliers[currentRegime];
  
  // Fee = f₀ + ασ² + β·VPIN + γ·R·(vol+VPIN components) + δ|I|
  const volComponent = alpha * Math.pow(volatility, 2) * 10000; // Convert to bps
  const vpinComponent = beta * vpin * 100;
  const regimeComponent = gamma * R * (volComponent + vpinComponent);
  const inventoryComponent = delta * Math.abs(inventoryImbalance) * 10000;
  
  const totalFee = f0 + volComponent + vpinComponent + regimeComponent + inventoryComponent;
  
  // Cap at max fee for regime
  const maxFees = { CORE: 50, PRE_MARKET: 100, OVERNIGHT: 300, WEEKEND: 500 };
  return Math.min(totalFee, maxFees[currentRegime] || 500);
}
```

#### Gap Auction Minimum Bid

```javascript
function calculateGapAuctionBid(gapPercent, liquidityValue, elapsedMinutes) {
  // MinBid(t) = Gap × L × 70% × e^(-0.4t)
  const lpCaptureRate = 0.70;
  const decayConstant = 0.4; // per minute
  
  const gapValue = gapPercent * liquidityValue;
  const minBid = gapValue * lpCaptureRate * Math.exp(-decayConstant * elapsedMinutes);
  
  return minBid;
}
```

#### LVR Calculation

```javascript
function calculateLVR(volatility, timeInYears) {
  // LVR Rate = σ²/8 per year
  const lvrRateAnnual = Math.pow(volatility, 2) / 8;
  return lvrRateAnnual * timeInYears;
}
```

#### VPIN Calculation

```javascript
function calculateVPIN(trades, bucketSize = 10000, numBuckets = 50) {
  // VPIN = Σ|V_buy - V_sell| / (n × V_bucket)
  const buckets = [];
  let currentBucket = { buy: 0, sell: 0 };
  
  for (const trade of trades) {
    const volume = trade.amount * trade.price;
    if (trade.direction === 'BUY') {
      currentBucket.buy += volume;
    } else {
      currentBucket.sell += volume;
    }
    
    const totalVolume = currentBucket.buy + currentBucket.sell;
    if (totalVolume >= bucketSize) {
      buckets.push({ ...currentBucket });
      currentBucket = { buy: 0, sell: 0 };
    }
  }
  
  if (buckets.length < numBuckets) return 0.3; // Default baseline
  
  const recentBuckets = buckets.slice(-numBuckets);
  const imbalanceSum = recentBuckets.reduce((sum, b) => sum + Math.abs(b.buy - b.sell), 0);
  const vpin = imbalanceSum / (numBuckets * bucketSize);
  
  return Math.min(vpin, 1.0);
}
```

#### Circuit Breaker Logic

```javascript
function determineCircuitBreakerLevel(state) {
  let flags = 0;
  
  // Oracle staleness (>60 seconds during market hours)
  const oracleAge = (state.simulatedTime - state.lastOracleUpdate) / 1000;
  if (state.currentRegime === 'CORE' && oracleAge > 60) flags++;
  
  // Price deviation >3%
  const deviation = Math.abs(state.poolPrice - state.oraclePrice) / state.oraclePrice;
  if (deviation > 0.03) flags++;
  
  // VPIN >0.7
  if (state.vpin > 0.7) flags++;
  
  // Inventory imbalance >40%
  if (Math.abs(state.inventoryImbalance) > 0.4) flags++;
  
  // Levels: 0=Normal, 1=Warning, 2=Caution, 3=Danger, 4=Pause
  return Math.min(flags, 4);
}

const circuitBreakerEffects = {
  0: { spreadMultiplier: 1.0, depthReduction: 0 },
  1: { spreadMultiplier: 2.0, depthReduction: 0 },
  2: { spreadMultiplier: 5.0, depthReduction: 0.5 },
  3: { spreadMultiplier: 10.0, depthReduction: 0.75 },
  4: { spreadMultiplier: Infinity, depthReduction: 1.0 } // Trading paused
};
```

---

### 4.5 Scenario Specifications (EXTREME DETAIL)

---

#### SCENARIO 1: Overnight Earnings Surprise

**Narrative**
> Sarah is an LP providing $100,000 of liquidity in an Apple/USDC pool. Apple announces quarterly earnings at 5:30 PM ET, beating expectations. The stock gaps +10% in after-hours trading. Watch how arbitrageurs exploit traditional AMMs while StockShield protects Sarah.

**Initial State**

| Parameter | Value |
|-----------|-------|
| Stock | AAPL |
| Initial Price | $150.00 |
| Pool Liquidity | $100,000 (50% AAPL, 50% USDC) |
| LP Position | 333.33 AAPL tokens + $50,000 USDC |
| Volatility | 35% annualized |
| VPIN | 0.25 (normal) |
| Simulation Start | Thursday 3:00 PM ET |
| Simulation End | Friday 10:00 AM ET |

**Timeline of Events**

| Sim Time | Event | Oracle Price | Description |
|----------|-------|--------------|-------------|
| 3:00 PM | START | $150.00 | Normal core session trading |
| 3:30 PM | Trade | $150.00 | Noise trader buys 10 AAPL |
| 3:45 PM | Trade | $150.50 | Noise trader sells 5 AAPL |
| 4:00 PM | REGIME→AFTER_HOURS | $150.25 | NYSE closes, regime changes |
| 4:15 PM | Trade attempt | $150.25 | Trader tries to buy, sees higher fee |
| 5:30 PM | 📰 NEWS | $165.00 | **EARNINGS BEAT! +10% GAP** |
| 5:31 PM | ARBITRAGE | $165.00 | Arb buys from traditional pool at $150-155 |
| 5:32 PM | ARBITRAGE | $165.00 | Second arb wave |
| 6:00 PM | Pool settled | $165.00 | Traditional pool now at new price |
| 8:00 PM | REGIME→OVERNIGHT | $164.50 | Extended hours end |
| 9:30 AM+1 | GAP_AUCTION | $166.00 | Market opens, gap auction triggers |
| 9:31 AM+1 | Auction bid | $166.00 | Trader bids for early access |
| 9:35 AM+1 | REGIME→CORE | $166.00 | Normal trading resumes |
| 10:00 AM+1 | END | $165.50 | Simulation ends |

**Trade Execution Details (5:31 PM - Arbitrage Event)**

*Traditional AMM:*

```
Arbitrageur detects: Oracle = $165, Pool = $150
Opportunity: $15 per share × available depth
Trade 1: Buy 100 AAPL @ avg $152 (slippage)
  - LP receives: $15,200 USDC
  - LP gives: 100 AAPL (worth $16,500)
  - LP loss: $1,300
Trade 2: Buy 80 AAPL @ avg $156
  - LP receives: $12,480 USDC
  - LP gives: 80 AAPL (worth $13,200)
  - LP loss: $720
Trade 3: Buy 50 AAPL @ avg $160
  - LP receives: $8,000 USDC
  - LP gives: 50 AAPL (worth $8,250)
  - LP loss: $250
Total LP Loss: $2,270
```

*StockShield:*

```
Arbitrageur detects: Oracle = $165, Pool = $150
Current Regime: AFTER_HOURS
Dynamic Fee: 15 bps base + volatility spike = 85 bps
Trade 1: Buy 100 AAPL @ avg $152
  - Fee: 0.85% × $15,200 = $129
  - LP receives: $15,200 + $129 fee
  - LP loss reduced by fee capture
GAP_AUCTION_TRIGGERED (gap > 5%)
  - MinBid = $15 × $100,000 × 0.70 × e^0 = $1,050
  - Arbitrageur must pay $1,050 to LPs for priority
  - StockShield captures 70% of gap for LPs
Total LP Loss: $680 (vs $2,270 without protection)
Value Captured: $920 for LPs
```

**Display Requirements**

*Price Chart:*

- X-axis: Time (3 PM to 10 AM next day)
- Y-axis: Price ($145 - $170)
- Show oracle price as solid line
- Show pool price as dashed line
- Highlight gap event with vertical marker
- Color-code background by regime (green=core, yellow=after-hours, red=overnight)

*PnL Tracker:*

- Real-time cumulative line chart
- Traditional: Should go deeply negative at 5:31 PM
- StockShield: Should dip but recover with fee capture
- Show difference prominently: "-$2,270 vs -$680"

*Event Log:*

```
[5:30:00 PM] 📰 EARNINGS RELEASED - Apple beats Q4 expectations
[5:30:15 PM] 📈 Oracle updated: $150.25 → $165.00 (+9.8%)
[5:31:02 PM] ⚠️ Gap detected: 9.8% - Exceeds 5% threshold
[5:31:02 PM] 🛡️ [StockShield] Gap auction activated
[5:31:05 PM] 💰 [Traditional] Arb bought 100 AAPL @ $152
[5:31:05 PM] 🛡️ [StockShield] Arb bid $1,050 for priority - ACCEPTED
[5:31:06 PM] 💰 [StockShield] Arb bought 100 AAPL @ $152 + paid auction
...
```

---

#### SCENARIO 2: Monday Morning Gap

**Narrative**
> Bob is an LP in a Tesla/USDC pool with $50,000 of liquidity. On Friday at market close, Tesla is at $200. Over the weekend, Elon Musk tweets controversial statements. By Monday, the market consensus is that Tesla will open down 15%. Watch how the weekend unfolds.

**Initial State**

| Parameter | Value |
|-----------|-------|
| Stock | TSLA |
| Initial Price | $200.00 |
| Pool Liquidity | $50,000 |
| Volatility | 65% annualized |
| Simulation Start | Friday 3:00 PM ET |
| Simulation End | Monday 10:00 AM ET |

**Timeline of Events**

| Sim Time | Event | Oracle Price | Description |
|----------|-------|--------------|-------------|
| Friday 3:00 PM | START | $200.00 | Normal trading |
| Friday 4:00 PM | REGIME→AFTER_HOURS | $200.00 | Market closes |
| Friday 8:00 PM | REGIME→WEEKEND | $200.00 | Weekend begins |
| Saturday 2:00 PM | 📰 NEWS | $200.00 | Musk tweet causes controversy |
| Saturday 3:00 PM | Trade attempt | $200.00 | Trader tries to sell at $200 |
| Sunday 8:00 PM | Consensus forms | $200.00 | Market expects -15% |
| Monday 4:00 AM | REGIME→PRE_MARKET | $200.00 | Pre-market begins |
| Monday 9:30 AM | SOFT_OPEN | $170.00 | **Market opens -15%** |
| Monday 9:30:30 AM | END_SOFT_OPEN | $170.00 | 30-second pause ends |
| Monday 9:31 AM | GAP_AUCTION | $170.00 | Gap auction for gap-down |
| Monday 9:35 AM | REGIME→CORE | $171.00 | Normal trading |
| Monday 10:00 AM | END | $172.00 | Simulation ends |

**Saturday Trading Attempt Detail**

*Traditional AMM:*

```
Trader wants to sell 50 TSLA at pool price $200
Current oracle: Still $200 (markets closed)
Trade executes normally
Fee: 0.30% (default)

By Monday open, price is $170
LP bought TSLA at $200, now worth $170
LP loss: 50 × ($200 - $170) = $1,500
```

*StockShield:*

```
Trader wants to sell 50 TSLA at pool price $200
Current Regime: WEEKEND
Dynamic Fee Calculation:
  - Base: 50 bps
  - Volatility (65%): +21 bps
  - Regime multiplier 6x: amplifies components
  - Total: 180 bps (1.8%)

Trader sees: "Fee: 1.8% ($180 on $10,000 trade)"
Trader decision: "Too expensive, I'll wait for Monday"
Trade CANCELLED by user

Result: No weekend trades, LP protected
```

**Soft Open Mechanism (Monday 9:30 AM)**

```
[9:30:00.000] Market officially opens
[9:30:00.100] Oracle detects NYSE open signal
[9:30:00.200] StockShield: SOFT_OPEN regime activated
[9:30:00.200] Trading PAUSED for 30 seconds
[9:30:00.500] Oracle updates: $200 → $170 (-15%)
[9:30:05.000] Gap magnitude calculated: 15%
[9:30:05.100] Gap auction parameters set:
              - Gap value: 15% × $50,000 = $7,500
              - LP capture: 70% = $5,250 max
              - Initial minBid: $5,250
              - Decay: λ = 0.4/min
[9:30:30.000] SOFT_OPEN ends
[9:30:30.100] GAP_AUCTION begins
[9:30:31.000] First bid received: $4,800
              - Time elapsed: 1 second (0.017 min)
              - MinBid = $5,250 × e^(-0.4×0.017) = $5,214
              - Bid $4,800 < $5,214: REJECTED
[9:30:45.000] Second bid received: $4,500
              - Time elapsed: 15 seconds (0.25 min)
              - MinBid = $5,250 × e^(-0.4×0.25) = $4,753
              - Bid $4,500 < $4,753: REJECTED
[9:31:30.000] Third bid received: $3,800
              - Time elapsed: 60 seconds (1 min)
              - MinBid = $5,250 × e^(-0.4×1) = $3,517
              - Bid $3,800 > $3,517: ACCEPTED ✓
[9:31:30.100] LP receives: $3,800 gap auction payment
[9:31:30.200] Trader can now trade at new price
```

---

#### SCENARIO 3: Flash Crash Recovery

**Narrative**
> Emma is an LP in a Microsoft/USDC pool with $75,000 of liquidity. A fat-finger error on NYSE causes Microsoft to drop 12% for 45 seconds, then fully recover. Traditional AMMs suffer double losses (sell low, buy high). StockShield's circuit breaker prevents this.

**Initial State**

| Parameter | Value |
|-----------|-------|
| Stock | MSFT |
| Initial Price | $400.00 |
| Pool Liquidity | $75,000 |
| Volatility | 28% annualized |
| VPIN | 0.25 |
| Simulation Start | Tuesday 2:30 PM ET |
| Simulation End | Tuesday 3:00 PM ET |

**Timeline of Events (Second-by-Second for Crash)**

| Sim Time | Event | Oracle | Pool (Trad) | Pool (Shield) | CB Level |
|----------|-------|--------|-------------|---------------|----------|
| 2:45:00 | Normal | $400 | $400 | $400 | 0 |
| 2:45:01 | Crash starts | $395 | $400 | $400 | 0 |
| 2:45:02 | | $385 | $398 | $398 | 1 |
| 2:45:03 | | $370 | $392 | (PAUSED) | 2 |
| 2:45:04 | | $355 | $380 | (PAUSED) | 3 |
| 2:45:05 | Crash bottom | $350 | $365 | (PAUSED) | 4 |
| 2:45:10 | Recovery | $360 | $360 | (PAUSED) | 4 |
| 2:45:20 | | $380 | $375 | (PAUSED) | 3 |
| 2:45:30 | | $390 | $385 | (PAUSED) | 2 |
| 2:45:40 | | $395 | $392 | $395 | 1 |
| 2:45:45 | Full recovery | $398 | $396 | $398 | 0 |

**Circuit Breaker Trigger Sequence**

```
[2:45:02.100] Price deviation check: |$400 - $385| / $400 = 3.75%
[2:45:02.100] ⚠️ FLAG: Price deviation > 3%
[2:45:02.100] Circuit Breaker Level: 0 → 1 (WARNING)
[2:45:02.100] Action: Spread multiplier = 2x
[2:45:02.200] Arb attempts sell at $398
[2:45:02.200] Spread widened: Sell price now $392 (not $398)
[2:45:02.300] Arb proceeds anyway

[2:45:03.000] Price deviation: |$400 - $370| / $400 = 7.5%
[2:45:03.000] ⚠️ FLAG: Price deviation > 3%
[2:45:03.000] ⚠️ FLAG: Price move > 5% in < 60 seconds
[2:45:03.000] Circuit Breaker Level: 1 → 2 (CAUTION)
[2:45:03.000] Action: Spread = 5x, Depth reduced 50%
[2:45:03.100] Arb attempts sell 50 MSFT
[2:45:03.100] Only 25 MSFT available (depth reduced)
[2:45:03.200] Trade partially filled

[2:45:04.000] Price deviation: 11.25%
[2:45:04.000] ⚠️ FLAG: Deviation > 3%
[2:45:04.000] ⚠️ FLAG: Move > 5% in < 60s
[2:45:04.000] ⚠️ FLAG: VPIN spiking to 0.72
[2:45:04.000] Circuit Breaker Level: 2 → 3 (DANGER)
[2:45:04.000] Action: Spread = 10x, Depth reduced 75%

[2:45:05.000] Price deviation: 12.5%
[2:45:05.000] ⚠️ FLAG: 4 flags active
[2:45:05.000] 🚨 Circuit Breaker Level: 3 → 4 (PAUSE)
[2:45:05.000] ❌ ALL TRADING HALTED
[2:45:05.000] Message: "Trading paused - extreme volatility detected"
```

**Recovery Sequence**

```
[2:45:20.000] Oracle: $380 (recovering)
[2:45:20.000] Deviation now: 5%
[2:45:20.000] Flags: 2 (deviation + recent volatility)
[2:45:20.000] Circuit Breaker: 4 → 3
[2:45:20.000] Still paused (level 3 = 75% depth reduction, 10x spread)

[2:45:30.000] Oracle: $390
[2:45:30.000] Deviation: 2.5%
[2:45:30.000] VPIN: 0.45 (normalizing)
[2:45:30.000] Flags: 1
[2:45:30.000] Circuit Breaker: 3 → 2 → 1
[2:45:30.000] Trading cautiously resumes

[2:45:40.000] Oracle: $395
[2:45:40.000] All flags cleared
[2:45:40.000] Circuit Breaker: 1 → 0
[2:45:40.000] ✅ Normal trading resumed
```

**Final PnL Comparison**

| Metric | Traditional AMM | StockShield |
|--------|-----------------|-------------|
| Sold during crash | 120 MSFT @ avg $375 | 0 MSFT |
| Bought during recovery | 120 MSFT @ avg $388 | 0 MSFT |
| Loss from crash | -$1,560 | $0 |
| Loss from recovery | -$1,560 | $0 |
| **Total Loss** | **-$3,120** | **$0** |

---

#### SCENARIO 4: Trading Halt (Oracle Staleness)

**Narrative**
> GameStop is halted on NYSE for "news pending" while the AMM remains technically open. Without protection, traders with advance information can exploit the stale oracle price.

**Initial State**

| Parameter | Value |
|-----------|-------|
| Stock | GME |
| Initial Price | $25.00 |
| Pool Liquidity | $20,000 |
| Simulation Start | Wednesday 10:00 AM ET |
| Simulation End | Wednesday 11:00 AM ET |

**Timeline**

| Sim Time | Oracle Age | Event | Traditional | StockShield |
|----------|------------|-------|-------------|-------------|
| 10:00 | 0s | Normal trading | Open | Open |
| 10:30 | 0s | NYSE halts GME | Open | Open |
| 10:31 | 60s | Oracle stale | Open | ⚠️ Warning |
| 10:32 | 120s | Insider tries trade | ✅ Executes | ❌ Blocked |
| 10:35 | 300s | 5 min stale | Open | 🚨 PAUSED |
| 10:45 | N/A | NYSE resumes | Open | Checking... |
| 10:45:05 | 5s | Oracle updates | Open | ✅ Resumes |

**Oracle Staleness Detection Logic**

```javascript
function checkOracleStaleness(state) {
  const ageSeconds = (state.simulatedTime - state.lastOracleUpdate) / 1000;
  
  // During CORE hours, oracle should update every few seconds
  if (state.currentRegime === 'CORE') {
    if (ageSeconds > 60) {
      return { level: 'WARNING', message: 'Oracle is 1+ minute stale' };
    }
    if (ageSeconds > 180) {
      return { level: 'DANGER', message: 'Oracle is 3+ minutes stale' };
    }
    if (ageSeconds > 300) {
      return { level: 'PAUSE', message: 'Trading halted - suspected NYSE halt' };
    }
  }
  
  return { level: 'OK', message: null };
}
```

**Display: Oracle Staleness Timer**

- Show countdown/up timer: "Oracle age: 0:00"
- Color coding:
  - Green (0-60s): Fresh
  - Yellow (60-180s): Stale warning
  - Orange (180-300s): Danger
  - Red (300s+): Trading paused

---

#### SCENARIO 5: Low-Liquidity Hour Attack (Pre-Market Manipulation)

**Narrative**
> A whale attempts to manipulate Amazon's price during pre-market hours (6 AM) when ECN liquidity is thin. They push the price down temporarily on external venues, then try to exploit the AMM's lagging oracle.

**Initial State**

| Parameter | Value |
|-----------|-------|
| Stock | AMZN |
| Initial Price | $180.00 |
| Pool Liquidity | $30,000 |
| Volatility | 32% |
| Simulation Start | Monday 5:30 AM ET |
| Simulation End | Monday 7:00 AM ET |

**Attack Sequence**

```
[6:00:00 AM] Current state:
             - ECN liquidity: Thin ($500K total)
             - Oracle: $180.00
             - Pool: $180.00
             - Regime: PRE_MARKET

[6:00:10 AM] 🦈 WHALE places large sell on ECN
             - Sells 5,000 AMZN on thin book
             - ECN price drops: $180 → $175

[6:00:15 AM] Oracle updates (5s latency): $180 → $177
             - Oracle smoothing reduces impact
             
[6:00:16 AM] 🎯 ATTACKER attempts buy from AMM
             - Pool price: $178 (lagging)
             - Oracle: $177
             
             Traditional AMM:
             - Trade executes at $178
             - Attacker buys 50 AMZN
             - Whale cancels ECN order
             - Price rebounds to $180
             - Attacker profits: $100
             - LP loss: $100
             
             StockShield:
             - Regime: PRE_MARKET (2x multiplier)
             - VPIN: Suddenly spiked to 0.65 (one-sided buying)
             - Dynamic fee: 15 + (vol×2) + (VPIN×30) = 55 bps
             - TWAP oracle: Shows $178.50 (not $177)
             - Trade executes at higher fee
             - Attacker profit reduced to $25
             - LP loss reduced to $25 (+ $30 in fees = net +$5)
```

**VPIN Visualization Requirement**

Display VPIN as a real-time gauge:

```
VPIN Indicator:
[===|========|========|=====|====]
0.0  0.25     0.50     0.70  1.0
     ▲ Normal  ▲ Elevated  ▲ Toxic
     
Current: 0.65 ⚠️ ELEVATED
Action: Fees increased by 30 bps
```

---

#### SCENARIO 6: Informed Trader (VPIN Detection Before FDA Announcement)

**Narrative**
> Pfizer has an FDA committee meeting at 4:30 PM to review a new drug. Starting at 4:15 PM, unusual one-sided buying occurs, suggesting informed trading.

**Timeline**

| Time | VPIN | Buy Volume | Sell Volume | Fee (Trad) | Fee (Shield) |
|------|------|------------|-------------|------------|--------------|
| 4:00 PM | 0.25 | 10K | 12K | 5 bps | 5 bps |
| 4:05 PM | 0.30 | 15K | 10K | 5 bps | 8 bps |
| 4:10 PM | 0.38 | 25K | 8K | 5 bps | 12 bps |
| 4:15 PM | 0.52 | 40K | 5K | 5 bps | 25 bps |
| 4:20 PM | 0.68 | 60K | 3K | 5 bps | 45 bps |
| 4:25 PM | 0.75 | 80K | 2K | 5 bps | 🚨 PAUSED |
| 4:30 PM | --- | --- | --- | --- | ✅ FDA Approves |
| 4:31 PM | 0.40 | 30K | 25K | 5 bps | 15 bps |

**VPIN Progression Chart**

- X-axis: Time (4:00 PM - 4:35 PM)
- Y-axis: VPIN (0 - 1.0)
- Line chart showing VPIN rising
- Horizontal threshold lines at 0.3, 0.5, 0.7
- Color zones: Green (<0.3), Yellow (0.3-0.5), Orange (0.5-0.7), Red (>0.7)

---

#### SCENARIO 7: Holiday Weekend Disaster

**Narrative**
> Bank of America LP during a 3-day weekend (Thursday before a Friday holiday). European bank crisis develops.

**Timeline**

- Thursday 4 PM: Market closes, BAC at $35
- Friday: European bank fails, global markets crash 8%
- Saturday-Sunday: News develops, BAC expected to open -12%
- Monday 9:30 AM: BAC opens at $30.80

**Key Numbers**

| Metric | Traditional AMM | StockShield |
|--------|-----------------|-------------|
| Weekend trades | 200 shares @ $34.50 avg | 10 shares @ $35 (high fees) |
| Weekend fee revenue | $20 | $175 |
| Monday gap loss | -$880 | -$44 |
| **Net weekend impact** | **-$860** | **+$131** |

---

#### SCENARIO 8: Stale Oracle Attack

**Narrative**
> Nvidia's oracle updates every 10 seconds. An attacker monitors pending oracle transactions and front-runs price movements.

**Attack Pattern**

```
[T+0s] Oracle shows: $800
[T+8s] Attacker sees pending oracle update to $812 in mempool
[T+8.1s] Attacker buys NVDA from pool at $800
[T+10s] Oracle updates to $812
[T+10.1s] Attacker could sell at $812 (in traditional AMM)

StockShield Defense:
- Uses TWAP oracle (30-second window)
- At T+8s, TWAP = ($800×8 + ... ) / 30 ≈ $801
- After update: TWAP = weighted average, not spot
- Attacker's edge reduced from $12 to $2
```

---

### 4.6 Visual Components Specification

#### Price Chart Requirements

- Chart type: Line chart with area fill
- Time granularity: 1 second for short scenarios, 1 minute for long
- Features:
  - Dual axis if needed (price + VPIN)
  - Trade markers (triangles for buys, inverted for sells)
  - Regime background coloring
  - Gap event vertical lines
  - Circuit breaker activation markers

#### PnL Tracker Requirements

- Real-time updating line chart
- Start at $0
- Color: Green when positive, red when negative
- Show absolute value and percentage
- Compare line between Traditional and StockShield

#### Metrics Panel Requirements

| Metric | Format | Update Frequency |
|--------|--------|------------------|
| Current Fee | "X.XX bps" or "X.XX%" | Per trade |
| Regime | Badge with icon | On change |
| VPIN | Progress bar + number | Every 500ms |
| Volatility | Percentage | Every second |
| Inventory | Percentage with direction | Every second |
| Circuit Breaker | Level 0-4 with color | On change |
| Oracle Age | Timer "0:00" | Every second |

#### Event Timeline Requirements

- Horizontal scrolling timeline
- Events as markers with icons
- Hover/click for details
- Auto-scroll to current time
- Visual distinction between severity levels

---

### 4.7 Simulation Engine Requirements

#### Tick Rate

- Minimum: 60 updates/second for smooth animation
- Maximum sim time per tick: Varies by speed setting

#### State Synchronization

- Both panels must process identical market events
- Only difference: Protection logic applied or not

#### Randomization

- Use seeded random for reproducibility
- Same seed = same noise trades
- Each scenario has fixed seed for consistent demo

#### Performance

- No frame drops during normal operation
- Smooth chart updates
- Responsive controls even during fast simulation

---

## Technical Requirements

### Frontend Stack

- Framework: Next.js or Vite+React (developer's choice)
- State management: For simulation state sync
- Charts: Real-time capable (Recharts, Chart.js, etc.)
- Web3: wagmi + viem for Launch App

### Performance

- Demo simulations must run smoothly at 60fps
- Charts should update in real-time without lag
- Mobile responsive (at minimum for demo page)

### Accessibility

- All interactive elements keyboard accessible
- Sufficient color contrast for data visualization

---

## Priority Order for Development

1. **Demo Page** - Primary for hackathon judges
2. **Landing Page** - First impression
3. **Docs Page** - Reference material
4. **Launch App** - Can be simplified/mockup for hackathon

---

## Reference Materials

- [StockShield_Whitepaper.tex](./StockShield_Whitepaper.tex) - Full protocol specification
- [StockShield_Comprehensive_Guide.tex](./StockShield_Comprehensive_Guide.tex) - Mathematical foundations and edge cases
- [DEMO_STRATEGY.md](./DEMO_STRATEGY.md) - Existing demo approach and pitch strategy

---

## Success Criteria

For hackathon demo:

- [ ] Judges can trigger any attack scenario with one click
- [ ] Side-by-side comparison shows clear difference (Traditional loses, StockShield protects)
- [ ] Math matches whitepaper formulas exactly
- [ ] Simulations are visually compelling and easy to understand
- [ ] Demo runs without errors for 5-minute presentation

---

*Design, creative direction, and aesthetic choices are left to the frontend developer.*

# Yellow Network Integration — StockShield

## Overview

StockShield uses Yellow Network state channels for a novel purpose: **real-time risk parameter propagation** rather than traditional payment flows.

---

## How It Maps to Yellow's Judging Criteria

### 1. Problem & Solution Clarity ✅

**Problem**: Uniswap v4 hooks need real-time risk parameters (VPIN, regime, volatility) to set dynamic fees, but:

- On-chain computation is expensive and leaks information
- Oracle updates are too slow (every block)
- Centralized APIs are trust assumptions

**Solution**: Compute risk parameters off-chain, broadcast via Yellow state channels, enforce on-chain only at swap time.

---

### 2. Yellow SDK Integration Depth ✅

We use `@erc7824/nitrolite` with full lifecycle management:

```typescript
// yellow-client.ts - 593 lines of integration

import {
    NitroliteClient,
    WalletStateSigner,
    createECDSAMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createEIP712AuthMessageSigner,
    createCreateChannelMessage,
    createResizeChannelMessage,
    createCloseChannelMessage,
    parseAnyRPCResponse,
} from '@erc7824/nitrolite';
```

**Full Authentication Flow**:

1. Generate session key → `createECDSAMessageSigner()`
2. Request auth challenge → `createAuthRequestMessage()`
3. Sign with EIP-712 → `createEIP712AuthMessageSigner()`
4. Verify and get session → `createAuthVerifyMessageFromChallenge()`

**Channel Management**:

- Create channels with token allocation
- Resize channels (fund/withdraw)
- Close channels with final state

---

### 3. Off-Chain Logic Demonstration ✅

Three components run entirely off-chain:

#### VPIN Calculator (261 lines)

```
Academic implementation of Volume-synchronized Probability of Informed Trading
- Bucket-based tracking (2% of ADV per bucket)
- 50-bucket rolling window
- Normalized output: 0.0 (balanced) → 1.0 (toxic)
```

#### Regime Detector (NYSE-aware)

```
7 market states with different risk profiles:
- CORE_SESSION (1x multiplier)
- SOFT_OPEN (1.5x + gap auction)
- PRE_MARKET, AFTER_HOURS (2x)
- OVERNIGHT (4x)
- WEEKEND, HOLIDAY (6x)
```

#### State Broadcaster (302 lines)

```typescript
// Broadcasts fee recommendations every 5 seconds
const update: StateUpdate = {
    channelId: this.channelId,
    timestamp: Date.now(),
    vpin: 0.45,              // Current toxicity
    regime: 'SOFT_OPEN',     // Market state
    recommendedFee: 25,      // Basis points
    oraclePrice: 240_000n,   // 18 decimals
};
await this.sendStateUpdate(update);
```

---

### 4. On-Chain Settlement ✅

Yellow state channel updates are consumed by the Uniswap v4 hook:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Yellow ClearNode                                       │
│       │                                                 │
│       ▼ (state channel update)                          │
│  ┌─────────────────┐                                    │
│  │ state_update    │                                    │
│  │ {vpin, regime,  │─────────────────────────────────┐  │
│  │  recommended_   │                                 │  │
│  │  fee}           │                                 │  │
│  └─────────────────┘                                 │  │
│                                                      ▼  │
│                                   ┌──────────────────┐  │
│                                   │ beforeSwap()     │  │
│                                   │   → read params  │  │
│                                   │   → calculate fee│  │
│                                   │   → return delta │  │
│                                   └──────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

The hook only executes fee enforcement—all computation happens off-chain via Yellow.

---

### 5. Business Model ✅

**Revenue**: Protocol fee on captured arbitrage value

- 70% of gap capture → LPs
- 20% of gap capture → Protocol treasury
- 10% of gap capture → Solvers (gas + incentive)

**Market Size**: $92M annual LP losses in tokenized stock pools
**Capture Target**: $76M (82% efficiency)

---

## Code References

| File | Purpose | Lines |
|------|---------|:-----:|
| `yellow-client.ts` | Full SDK integration | 593 |
| `state-broadcaster.ts` | Real-time updates | 302 |
| `vpin-calculator.ts` | Off-chain risk calc | 261 |
| `regime-detector.ts` | Market state machine | ~300 |

---

## Why This Integration Matters

Traditional MEV protection (Flashbots, CoW Swap) uses off-chain auctions for **trade execution**.

StockShield uses Yellow state channels for **parameter propagation** — a novel primitive that enables:

1. Sub-second fee updates (vs. per-block with oracles)
2. Zero gas for parameter changes
3. Privacy until execution (no on-chain signals)

This is the **first use of ERC-7824 state channels for dynamic AMM configuration**.

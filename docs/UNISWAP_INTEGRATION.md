
# 🦄 Uniswap v4 Integration: Privacy & Adverse Selection Protection

This document outlines how StockShield leverages **Uniswap v4 Hooks** to solve the "Adverse Selection" problem for LPs in tokenized asset pools.

## 🏆 For Prize Judges: Key Implementation Details

### 1. Singleton Dynamic Fee Hook

**File:** [`contracts/src/StockShieldHook.sol`](../contracts/src/StockShieldHook.sol)

Unlike standard AMMs where fees are static (e.g., 30bps), StockShield implements a **Dynamic Pricing Engine**. We separate the "Risk Signal" (VPIN) from the "Execution Layer" (Uniswap).

* **Privacy Mechanism:** The VPIN (toxicity) signal is computed **off-chain** in a private computation environment.
* **Adverse Selection Defense:** When a swap hits the pool, the hook checks the latest VPIN update. If `VPIN > 0.5` (High Toxicity), the fee automatically spikes to 500bps. This neutralizes the arbitrage advantage of HFTs.

### 2. Gap Auction Mechanism (Session Awareness)

**File:** [`contracts/src/hooks/GapAuctionHook.sol`](../contracts/src/hooks/GapAuctionHook.sol)

Traditional AMMs bleed value when real-world markets gap overnight. StockShield introduces **Session-Aware Liquidity**.

* **BeforeSwap Hook:** Checks if `block.timestamp` is within a "Market Gap" period (e.g., Monday Morning Open).
* **Auction Logic:** Instead of allowing the first arbitrageur to extract 100% of the value, the hook forces a **Gap Auction**. Traders bid for the right to execute the first swap, and 70% of the bid value is returned directly to the LPs.

### 3. Custom Accounting & Unclaimed Fees

**File:** [`contracts/src/libraries/FeeMath.sol`](../contracts/src/libraries/FeeMath.sol)

We implement custom accounting logic within the hook to segregate "Base Fees" (for LPs) from "Protection Fees" (for the protocol shield). This ensures that LPs are fairly compensated for the risk they take.

---

## 🏗️ Architecture Diagram

```mermaid
graph TD
    User[Trader] -->|Swap(tAAPL)| PM[PoolManager]
    PM -->|beforeSwap| Hook[StockShieldHook]
    
    Hook -->|1. Check Regime| Regime[RegimeOracle]
    Hook -->|2. Check Toxicity| VPIN[VPIN Score]
    
    Regime -- "Market Closed" --> Revert[Block Trade]
    Regime -- "Gap Detected" --> Auction[Trigger Gap Auction]
    VPIN -- "High VPIN" --> FeeHigh[Set Fee = 500bps]
    VPIN -- "Low VPIN" --> FeeLow[Set Fee = 5bps]
    
    Auction -->|Revenue| LP[Liquidity Providers]
    FeeHigh -->|Revenue| LP
```

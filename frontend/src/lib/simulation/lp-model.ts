import type { Regime } from '@/types/simulation';

/**
 * LP Position Model
 * 
 * Tracks the state of a liquidity provider's position including:
 * - Position value and reserves
 * - P&L components (fees, IL, adverse selection, gap losses/gains)
 * - Inventory imbalance
 */

export interface LPPosition {
    // Configuration
    initialPrice: number;           // Price when LP entered
    initialBalance: number;         // Initial capital (USD)
    poolShare: number;              // Fraction of pool (e.g., 0.10 = 10%)
    poolTVL: number;                // Total pool value locked (USD)

    // Current state
    currentPrice: number;
    inventoryImbalance: number;     // -1 (all token0) to +1 (all token1)

    // P&L Components
    feesEarned: number;
    impermanentLoss: number;
    adverseSelectionLoss: number;
    gapLoss: number;
    gapAuctionGains: number;
}

/**
 * Create a new LP position
 */
export function createLPPosition(
    initialPrice: number,
    initialBalance: number,
    poolShare: number = 0.10,
    poolTVL: number = 1_000_000
): LPPosition {
    return {
        initialPrice,
        initialBalance,
        poolShare,
        poolTVL,
        currentPrice: initialPrice,
        inventoryImbalance: 0,
        feesEarned: 0,
        impermanentLoss: 0,
        adverseSelectionLoss: 0,
        gapLoss: 0,
        gapAuctionGains: 0,
    };
}

/**
 * Calculate Impermanent Loss
 * 
 * Formula from Uniswap whitepaper:
 * IL = (2 * sqrt(k) / (1 + k)) - 1
 * where k = currentPrice / initialPrice
 * 
 * @param initialPrice - Price when LP entered
 * @param currentPrice - Current asset price
 * @param initialBalance - LP's initial capital
 * @returns The impermanent loss as a positive number (always a loss)
 */
export function calculateImpermanentLoss(
    initialPrice: number,
    currentPrice: number,
    initialBalance: number
): number {
    if (initialPrice <= 0 || currentPrice <= 0) return 0;

    const k = currentPrice / initialPrice;
    const ilFactor = (2 * Math.sqrt(k)) / (1 + k) - 1;

    // IL factor is negative for price movements, we return absolute value
    return Math.abs(ilFactor) * initialBalance;
}

/**
 * Calculate the value change due to price movement (not IL)
 * This is the directional gain/loss from holding the asset
 */
export function calculateHoldingPnL(
    initialPrice: number,
    currentPrice: number,
    initialBalance: number
): number {
    // Assuming 50/50 position in token0/token1
    // Half in stablecoin (no change), half in asset (moves with price)
    const assetPortion = initialBalance / 2;
    const priceChange = (currentPrice - initialPrice) / initialPrice;
    return assetPortion * priceChange;
}

/**
 * Calculate net P&L for LP position
 */
export function calculateNetPnL(position: LPPosition): number {
    return (
        position.feesEarned -
        position.impermanentLoss -
        position.adverseSelectionLoss -
        position.gapLoss +
        position.gapAuctionGains
    );
}

/**
 * Update LP position with a new trade
 * 
 * @param position - Current LP position
 * @param tradeVolume - Volume of the trade in USD
 * @param feeRate - Fee rate applied (e.g., 0.003 for 30 bps)
 * @param isInformed - Whether the trade is from an informed trader
 * @param hasProtection - Whether StockShield protection is active
 */
export function processTradeForLP(
    position: LPPosition,
    tradeVolume: number,
    feeRate: number,
    isInformed: boolean,
    hasProtection: boolean
): LPPosition {
    const updated = { ...position };

    // Fee earned = trade volume × fee rate × LP's share
    const feeEarned = tradeVolume * feeRate * position.poolShare;
    updated.feesEarned += feeEarned;

    // Adverse selection from informed traders
    // Informed traders extract ~10 bps on average per trade
    if (isInformed) {
        const extraction = tradeVolume * 0.001 * position.poolShare;
        if (hasProtection) {
            // StockShield reduces extraction by 60% through higher fees
            updated.adverseSelectionLoss += extraction * 0.4;
        } else {
            updated.adverseSelectionLoss += extraction;
        }
    }

    return updated;
}

/**
 * Update LP position with current price (recalculates IL)
 */
export function updatePositionPrice(
    position: LPPosition,
    newPrice: number
): LPPosition {
    const updated = { ...position };
    updated.currentPrice = newPrice;
    updated.impermanentLoss = calculateImpermanentLoss(
        position.initialPrice,
        newPrice,
        position.initialBalance
    );
    return updated;
}

/**
 * Get P&L breakdown for display
 */
export interface PnLBreakdown {
    feesEarned: number;
    impermanentLoss: number;
    adverseSelectionLoss: number;
    gapLoss: number;
    gapAuctionGains: number;
    netPnL: number;
    netPnLPercent: number;
}

export function getPnLBreakdown(position: LPPosition): PnLBreakdown {
    const netPnL = calculateNetPnL(position);
    return {
        feesEarned: position.feesEarned,
        impermanentLoss: position.impermanentLoss,
        adverseSelectionLoss: position.adverseSelectionLoss,
        gapLoss: position.gapLoss,
        gapAuctionGains: position.gapAuctionGains,
        netPnL,
        netPnLPercent: (netPnL / position.initialBalance) * 100,
    };
}

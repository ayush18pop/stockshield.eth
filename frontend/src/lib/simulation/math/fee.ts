import type { Regime } from '@/types/simulation';

// Base fees by regime (in basis points)
export const BASE_FEES: Record<Regime, number> = {
    CORE: 5,
    SOFT_OPEN: 10,
    PRE_MARKET: 15,
    AFTER_HOURS: 15,
    OVERNIGHT: 30,
    WEEKEND: 50,
    HOLIDAY: 50,
};

// Regime multipliers
export const REGIME_MULTIPLIERS: Record<Regime, number> = {
    CORE: 1.0,
    SOFT_OPEN: 1.5,
    PRE_MARKET: 2.0,
    AFTER_HOURS: 2.0,
    OVERNIGHT: 4.0,
    WEEKEND: 6.0,
    HOLIDAY: 6.0,
};

// Max fees by regime (in basis points)
export const MAX_FEES: Record<Regime, number> = {
    CORE: 50,
    SOFT_OPEN: 75,
    PRE_MARKET: 100,
    AFTER_HOURS: 100,
    OVERNIGHT: 300,
    WEEKEND: 500,
    HOLIDAY: 500,
};

// Parameters from whitepaper
const ALPHA = 0.5;  // Volatility sensitivity
const BETA = 0.3;   // VPIN sensitivity
const GAMMA = 1.0;  // Regime sensitivity
const DELTA = 0.02; // Inventory sensitivity

/**
 * Calculate dynamic fee based on regime, volatility, VPIN, and inventory
 * Formula: Fee = f₀ + ασ² + β·VPIN + γ·R + δ|I|
 * @returns Fee in basis points
 */
export function calculateDynamicFee(
    regime: Regime,
    volatility: number,
    vpin: number,
    inventoryImbalance: number
): number {
    const f0 = BASE_FEES[regime];
    const R = REGIME_MULTIPLIERS[regime];

    const volComponent = ALPHA * Math.pow(volatility, 2) * 10000;
    const vpinComponent = BETA * vpin * 100;
    const regimeComponent = GAMMA * R * (volComponent + vpinComponent);
    const inventoryComponent = DELTA * Math.abs(inventoryImbalance) * 10000;

    const totalFee = f0 + volComponent + vpinComponent + regimeComponent + inventoryComponent;

    return Math.min(Math.round(totalFee * 100) / 100, MAX_FEES[regime]);
}

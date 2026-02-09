/**
 * Dynamic Fee Calculation
 * 
 * Formula from Developer Handbook Section 3 (lines 313-331):
 * Fee = f₀ + ασ² + β·VPIN + γ·R·(vol+VPIN) + δ|I|
 */

import type { Regime } from '@/types/simulation';
import { FEE_PARAMS } from '../scenario-data';

const { BASE_FEES, MAX_FEES, REGIME_MULTIPLIERS, ALPHA, BETA, GAMMA, DELTA } = FEE_PARAMS;

/**
 * Calculate dynamic fee based on regime, volatility, VPIN, and inventory
 * 
 * Formula from Developer Handbook Section 3:
 * Fee = f₀ + ασ² + β·VPIN + γ·R·(vol+VPIN) + δ|I|
 * 
 * Where:
 * - f₀ = Base fee (5-50 bps depending on regime)
 * - α = Volatility sensitivity (0.5)
 * - σ = Realized volatility (0-1, typically 0.2-0.5 for stocks)
 * - β = VPIN sensitivity (0.3)
 * - VPIN = Volume-Synchronized Probability of Informed Trading (0-1)
 * - γ = Regime interaction factor (0.2)
 * - R = Regime multiplier (1x for core, up to 6x for weekend)
 * - δ = Inventory sensitivity (0.02)
 * - I = Inventory imbalance (-1 to +1)
 * 
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

    // Volatility component: higher fee when prices are jumping around
    // For stocks, σ is typically 0.2-0.5 (20-50% annualized)
    // σ² = 0.04-0.25, × 100 to get bps contribution × ALPHA
    const volComponent = ALPHA * volatility * volatility * 100;

    // VPIN component: higher fee when trades look "informed" (0-1)
    // VPIN of 0.5 adds ~15 bps (0.3 × 0.5 × 100)
    const vpinComponent = BETA * vpin * 100;

    // Regime component: multiplied fee during risky periods
    // This is the interaction term γ·R·(vol+VPIN)
    const regimeComponent = GAMMA * R * (volComponent + vpinComponent);

    // Inventory component: higher fee if pool is imbalanced
    // 40% imbalance adds ~0.8 bps (0.02 × 0.4 × 100)
    const inventoryComponent = DELTA * Math.abs(inventoryImbalance) * 100;

    const totalFee = f0 + volComponent + vpinComponent + regimeComponent + inventoryComponent;

    // Round to 1 decimal place and cap at max
    return Math.min(Math.round(totalFee * 10) / 10, MAX_FEES[regime]);
}

/**
 * Get the regime multiplier for display
 */
export function getRegimeMultiplier(regime: Regime): number {
    return REGIME_MULTIPLIERS[regime];
}

/**
 * Get the base fee for a regime
 */
export function getBaseFee(regime: Regime): number {
    return BASE_FEES[regime];
}

/**
 * Get the max fee for a regime
 */
export function getMaxFee(regime: Regime): number {
    return MAX_FEES[regime];
}

// Re-export for backward compatibility
export { BASE_FEES, MAX_FEES, REGIME_MULTIPLIERS };
export { determineCircuitBreakerLevel, CIRCUIT_BREAKER_EFFECTS } from './circuit-breaker';

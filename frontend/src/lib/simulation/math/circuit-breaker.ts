/**
 * Determine circuit breaker level based on current market conditions
 * @returns Level 0-4 (0=Normal, 4=Paused)
 */
export function determineCircuitBreakerLevel(
    oracleAge: number,       // seconds
    priceDeviation: number,  // percentage (e.g., 0.05 for 5%)
    vpin: number,
    inventoryImbalance: number,
    isCore: boolean
): 0 | 1 | 2 | 3 | 4 {
    let flags = 0;

    // Oracle staleness (>60s during CORE)
    if (isCore && oracleAge > 60) flags++;

    // Price deviation >3%
    if (priceDeviation > 0.03) flags++;

    // VPIN >0.7
    if (vpin > 0.7) flags++;

    // Inventory imbalance >40%
    if (Math.abs(inventoryImbalance) > 0.4) flags++;

    return Math.min(flags, 4) as 0 | 1 | 2 | 3 | 4;
}

export const CIRCUIT_BREAKER_EFFECTS = {
    0: { spreadMultiplier: 1.0, depthReduction: 0, label: 'Normal' },
    1: { spreadMultiplier: 2.0, depthReduction: 0, label: 'Warning' },
    2: { spreadMultiplier: 5.0, depthReduction: 0.5, label: 'Caution' },
    3: { spreadMultiplier: 10.0, depthReduction: 0.75, label: 'Danger' },
    4: { spreadMultiplier: Infinity, depthReduction: 1.0, label: 'PAUSED' },
} as const;

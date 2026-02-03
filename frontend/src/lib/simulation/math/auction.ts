const LP_CAPTURE_RATE = 0.70;
const DECAY_CONSTANT = 0.4; // per minute

/**
 * Calculate minimum bid for gap auction
 * Formula: MinBid(t) = Gap × L × 70% × e^(-0.4t)
 * @param gapPercent - Gap percentage (e.g., 0.10 for 10%)
 * @param liquidityValue - Total liquidity value in USD
 * @param elapsedMinutes - Time elapsed since auction start
 * @returns Minimum bid in USD
 */
export function calculateGapAuctionBid(
    gapPercent: number,
    liquidityValue: number,
    elapsedMinutes: number
): number {
    const gapValue = gapPercent * liquidityValue;
    const minBid = gapValue * LP_CAPTURE_RATE * Math.exp(-DECAY_CONSTANT * elapsedMinutes);
    return Math.round(minBid * 100) / 100;
}

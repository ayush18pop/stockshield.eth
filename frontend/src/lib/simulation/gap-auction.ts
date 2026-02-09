import type { LPPosition } from './lp-model';

/**
 * Gap Auction Simulation
 * 
 * When a price gaps overnight (e.g., earnings announcement),
 * StockShield runs an auction to capture value for LPs.
 * 
 * Per whitepaper:
 * - Commit-reveal auction (30s commit, 30s reveal)
 * - LPs capture 70% of gap value
 * - Winning bidder gets priority trading rights
 */

export interface GapAuctionResult {
    triggered: boolean;
    gapPercent: number;         // e.g., 0.10 for 10% gap
    gapDirection: 'UP' | 'DOWN' | null;
    gapValueUSD: number;        // Total value of the gap
    lpCaptureRate: number;      // Always 0.70 (70%)
    lpGains: number;            // What LPs capture from auction
    lpLoss: number;             // What LPs still lose (30%)
    auctionDurationMs: number;  // 60000ms (60 seconds)
}

// Minimum gap to trigger auction (0.5%)
const MIN_GAP_THRESHOLD = 0.005;

// LP capture rate from auction
const LP_CAPTURE_RATE = 0.70;

// Auction duration
const AUCTION_DURATION_MS = 60_000; // 60 seconds

/**
 * Detect if a gap should trigger an auction
 * 
 * @param previousClose - Previous session close price
 * @param currentOpen - Current session open price
 */
export function detectGap(
    previousClose: number,
    currentOpen: number
): { hasGap: boolean; gapPercent: number; direction: 'UP' | 'DOWN' | null } {
    if (previousClose <= 0) {
        return { hasGap: false, gapPercent: 0, direction: null };
    }

    const gapPercent = (currentOpen - previousClose) / previousClose;

    if (Math.abs(gapPercent) >= MIN_GAP_THRESHOLD) {
        return {
            hasGap: true,
            gapPercent,
            direction: gapPercent > 0 ? 'UP' : 'DOWN',
        };
    }

    return { hasGap: false, gapPercent: 0, direction: null };
}

/**
 * Simulate a gap auction
 * 
 * Traditional AMM: LP loses full gap value to arbitrageurs
 * StockShield: LP captures 70% through auction mechanism
 * 
 * @param gapPercent - Gap percentage (e.g., 0.10 for 10%)
 * @param poolTVL - Total pool value locked
 * @param lpShare - LP's share of pool (e.g., 0.10 for 10%)
 */
export function simulateGapAuction(
    gapPercent: number,
    poolTVL: number,
    lpShare: number
): GapAuctionResult {
    const absGap = Math.abs(gapPercent);

    if (absGap < MIN_GAP_THRESHOLD) {
        return {
            triggered: false,
            gapPercent: 0,
            gapDirection: null,
            gapValueUSD: 0,
            lpCaptureRate: LP_CAPTURE_RATE,
            lpGains: 0,
            lpLoss: 0,
            auctionDurationMs: 0,
        };
    }

    // Total gap value = gap% × pool TVL × LP's share
    const gapValueUSD = absGap * poolTVL * lpShare;

    return {
        triggered: true,
        gapPercent: absGap,
        gapDirection: gapPercent > 0 ? 'UP' : 'DOWN',
        gapValueUSD,
        lpCaptureRate: LP_CAPTURE_RATE,
        lpGains: gapValueUSD * LP_CAPTURE_RATE,      // 70% captured
        lpLoss: gapValueUSD * (1 - LP_CAPTURE_RATE), // 30% lost
        auctionDurationMs: AUCTION_DURATION_MS,
    };
}

/**
 * Calculate traditional AMM gap loss (no protection)
 * 
 * Without StockShield, arbitrageurs capture 100% of the gap
 */
export function calculateTraditionalGapLoss(
    gapPercent: number,
    poolTVL: number,
    lpShare: number
): number {
    return Math.abs(gapPercent) * poolTVL * lpShare;
}

/**
 * Apply gap event to LP positions
 * 
 * @param traditionalLP - LP without protection
 * @param shieldLP - LP with StockShield
 * @param gapPercent - Gap percentage
 */
export function applyGapEvent(
    traditionalLP: LPPosition,
    shieldLP: LPPosition,
    gapPercent: number
): { traditional: LPPosition; shield: LPPosition; auctionResult: GapAuctionResult } {
    // Traditional: loses full gap to arbitrage
    const traditionalLoss = calculateTraditionalGapLoss(
        gapPercent,
        traditionalLP.poolTVL,
        traditionalLP.poolShare
    );

    // StockShield: auction captures 70%
    const auctionResult = simulateGapAuction(
        gapPercent,
        shieldLP.poolTVL,
        shieldLP.poolShare
    );

    return {
        traditional: {
            ...traditionalLP,
            gapLoss: traditionalLP.gapLoss + traditionalLoss,
        },
        shield: {
            ...shieldLP,
            gapLoss: shieldLP.gapLoss + auctionResult.lpLoss,
            gapAuctionGains: shieldLP.gapAuctionGains + auctionResult.lpGains,
        },
        auctionResult,
    };
}

/**
 * Get gap scenarios for demo
 * Based on the 8 scenarios defined in the demo page
 */
export const GAP_SCENARIOS: Record<number, {
    name: string;
    gapPercent: number;
    description: string;
}> = {
    1: {
        name: 'Overnight Earnings Surprise',
        gapPercent: 0.10,  // +10%
        description: 'Apple announces earnings after hours, causing a 10% gap up.',
    },
    2: {
        name: 'Monday Morning Gap',
        gapPercent: -0.15, // -15%
        description: 'Weekend tweet causes Monday open -15%.',
    },
    3: {
        name: 'Flash Crash Recovery',
        gapPercent: -0.125, // -12.5%
        description: 'Fat-finger error causes 12% crash, recovers in 45 seconds.',
    },
    4: {
        name: 'Trading Halt',
        gapPercent: 0.05,  // +5% on resume
        description: 'NYSE halts stock for news pending — oracle goes stale.',
    },
    5: {
        name: 'Low-Liquidity Hour Attack',
        gapPercent: -0.08, // -8%
        description: 'Whale manipulates thin ECN during pre-market.',
    },
    6: {
        name: 'Informed Trader (VPIN)',
        gapPercent: 0.03,  // +3%
        description: 'FDA announcement expected — VPIN spikes to 0.75.',
    },
    7: {
        name: 'Weekend Holiday Disaster',
        gapPercent: -0.20, // -20%
        description: 'Friday holiday, European bank crisis on Saturday.',
    },
    8: {
        name: 'Stale Oracle Attack',
        gapPercent: 0.04,  // +4%
        description: 'Attacker front-runs pending oracle update.',
    },
};

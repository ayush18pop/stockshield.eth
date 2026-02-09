import type { Regime } from '@/types/simulation';

/**
 * Trade Generator
 * 
 * Generates realistic trades for simulation based on:
 * - Current market regime
 * - Informed vs noise trader distribution
 * - Realistic volume patterns
 */

export interface SimulatedTrade {
    timestamp: number;
    volume: number;         // USD volume
    isBuy: boolean;
    isInformed: boolean;
    regime: Regime;
}

/**
 * Trading activity by regime
 * Based on real market data patterns
 */
const REGIME_TRADE_CONFIG: Record<Regime, {
    tradesPerHour: number;
    informedPercent: number;
    avgVolumeMin: number;
    avgVolumeMax: number;
}> = {
    CORE: {
        tradesPerHour: 20,
        informedPercent: 0.10,      // 10% informed during market hours
        avgVolumeMin: 10_000,
        avgVolumeMax: 50_000,
    },
    SOFT_OPEN: {
        tradesPerHour: 50,           // High activity at open
        informedPercent: 0.40,       // 40% informed (information from overnight)
        avgVolumeMin: 25_000,
        avgVolumeMax: 75_000,
    },
    PRE_MARKET: {
        tradesPerHour: 5,
        informedPercent: 0.20,
        avgVolumeMin: 5_000,
        avgVolumeMax: 25_000,
    },
    AFTER_HOURS: {
        tradesPerHour: 8,
        informedPercent: 0.15,
        avgVolumeMin: 5_000,
        avgVolumeMax: 25_000,
    },
    OVERNIGHT: {
        tradesPerHour: 2,
        informedPercent: 0.30,       // Higher informed % (only serious traders)
        avgVolumeMin: 5_000,
        avgVolumeMax: 15_000,
    },
    WEEKEND: {
        tradesPerHour: 1,
        informedPercent: 0.50,       // Very high informed % (speculative)
        avgVolumeMin: 5_000,
        avgVolumeMax: 15_000,
    },
    HOLIDAY: {
        tradesPerHour: 1,
        informedPercent: 0.50,
        avgVolumeMin: 5_000,
        avgVolumeMax: 15_000,
    },
};

/**
 * Generate a random volume within regime bounds
 */
function generateVolume(regime: Regime): number {
    const config = REGIME_TRADE_CONFIG[regime];
    const range = config.avgVolumeMax - config.avgVolumeMin;
    return config.avgVolumeMin + Math.random() * range;
}

/**
 * Determine if a trade is from an informed trader
 * 
 * During gap events, informed trader probability increases significantly
 */
function isInformedTrade(regime: Regime, isGapEvent: boolean = false): boolean {
    let probability = REGIME_TRADE_CONFIG[regime].informedPercent;

    // During gaps, informed probability spikes to 70%
    if (isGapEvent) {
        probability = 0.70;
    }

    return Math.random() < probability;
}

/**
 * Determine trade direction
 * 
 * For informed trades during positive gaps: more buys
 * For informed trades during negative gaps: more sells
 * For noise: random 50/50
 */
function determineBuyOrSell(
    isInformed: boolean,
    gapDirection: number = 0  // positive = gap up, negative = gap down
): boolean {
    if (isInformed && gapDirection !== 0) {
        // Informed traders trade in direction of gap
        // 70% probability of trading with the information
        if (gapDirection > 0) {
            return Math.random() < 0.7;  // More buys for gap up
        } else {
            return Math.random() > 0.7;  // More sells for gap down
        }
    }

    // Noise traders: 50/50
    return Math.random() > 0.5;
}

/**
 * Generate trades for a simulation tick
 * 
 * @param regime - Current market regime
 * @param tickDurationSeconds - Duration of the tick in seconds
 * @param currentTime - Current simulation timestamp
 * @param isGapEvent - Whether we're in a gap event period
 * @param gapDirection - Direction of gap (-1, 0, +1)
 */
export function generateTradesForTick(
    regime: Regime,
    tickDurationSeconds: number,
    currentTime: number,
    isGapEvent: boolean = false,
    gapDirection: number = 0
): SimulatedTrade[] {
    const config = REGIME_TRADE_CONFIG[regime];

    // Calculate expected trades for this tick
    const tradesPerSecond = config.tradesPerHour / 3600;
    const expectedTrades = tradesPerSecond * tickDurationSeconds;

    // Poisson-like random number of trades
    // For simplicity, use floor with random adjustment
    const numTrades = Math.floor(expectedTrades + (Math.random() - 0.5));

    const trades: SimulatedTrade[] = [];

    for (let i = 0; i < Math.max(0, numTrades); i++) {
        const isInformed = isInformedTrade(regime, isGapEvent);

        trades.push({
            timestamp: currentTime + (i / numTrades) * tickDurationSeconds * 1000,
            volume: generateVolume(regime),
            isBuy: determineBuyOrSell(isInformed, gapDirection),
            isInformed,
            regime,
        });
    }

    return trades;
}

/**
 * Calculate VPIN from recent trades
 * 
 * VPIN = Σ|buyVolume - sellVolume| / Σ totalVolume
 * 
 * Uses a rolling window of trades
 */
export function calculateVPINFromTrades(trades: SimulatedTrade[]): number {
    if (trades.length === 0) return 0;

    let buyVolume = 0;
    let sellVolume = 0;

    for (const trade of trades) {
        if (trade.isBuy) {
            buyVolume += trade.volume;
        } else {
            sellVolume += trade.volume;
        }
    }

    const totalVolume = buyVolume + sellVolume;
    if (totalVolume === 0) return 0;

    const imbalance = Math.abs(buyVolume - sellVolume);
    return imbalance / totalVolume;
}

/**
 * Get summary statistics for trades
 */
export interface TradeStats {
    totalTrades: number;
    totalVolume: number;
    informedVolume: number;
    noiseVolume: number;
    buyVolume: number;
    sellVolume: number;
    vpin: number;
}

export function getTradeStats(trades: SimulatedTrade[]): TradeStats {
    let totalVolume = 0;
    let informedVolume = 0;
    let noiseVolume = 0;
    let buyVolume = 0;
    let sellVolume = 0;

    for (const trade of trades) {
        totalVolume += trade.volume;
        if (trade.isInformed) {
            informedVolume += trade.volume;
        } else {
            noiseVolume += trade.volume;
        }
        if (trade.isBuy) {
            buyVolume += trade.volume;
        } else {
            sellVolume += trade.volume;
        }
    }

    return {
        totalTrades: trades.length,
        totalVolume,
        informedVolume,
        noiseVolume,
        buyVolume,
        sellVolume,
        vpin: calculateVPINFromTrades(trades),
    };
}

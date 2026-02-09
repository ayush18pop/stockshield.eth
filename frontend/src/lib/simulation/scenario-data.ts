/**
 * Scenario Data — Realistic Hardcoded Values from Documentation
 * 
 * Data sourced from:
 * - StockShield_Comprehensive_Guide.tex (Edge Cases 1-8)
 * - E2E_TEST_DOCUMENTATION.md
 * - StockShield_Developer_Handbook.tex
 */

import type { Regime } from '@/types/simulation';

// ============================================================================
// LP POSITION CONFIG
// ============================================================================
export const LP_CONFIG = {
    initialBalance: 100_000,      // $100k position
    poolShare: 0.10,              // 10% of pool
    poolTVL: 1_000_000,           // $1M pool
    traditionalFee: 0.003,        // 30 bps fixed
};

// ============================================================================
// SCENARIO DEFINITIONS
// ============================================================================

export interface KeyMoment {
    offsetMinutes: number;        // Minutes from scenario start
    label: string;
    type: 'start' | 'regime_change' | 'event' | 'auction' | 'end';
    regime?: Regime;
    priceChange?: number;         // Multiplier (e.g., 1.10 for +10%)
    traditionalLoss?: number;     // Loss at this moment
    shieldLoss?: number;
    shieldGain?: number;
}

export interface ScenarioData {
    id: number;
    name: string;
    stock: string;
    difficulty: 1 | 2 | 3;
    description: string;

    // Prices
    initialPrice: number;

    // Timeline
    durationMinutes: number;      // Total scenario duration
    keyMoments: KeyMoment[];

    // Final outcomes (from E2E / edge cases)
    outcomes: {
        traditional: {
            feesEarned: number;
            impermanentLoss: number;
            adverseSelectionLoss: number;
            gapLoss: number;
            netPnL: number;
        };
        shield: {
            feesEarned: number;
            impermanentLoss: number;
            adverseSelectionLoss: number;
            gapLoss: number;
            gapAuctionGains: number;
            netPnL: number;
        };
    };
}

export const SCENARIOS: ScenarioData[] = [
    // ========================================================================
    // Scenario 1: Overnight Earnings Surprise
    // Source: Comprehensive Guide Edge Case 1, lines 548-574
    // ========================================================================
    {
        id: 1,
        name: 'Overnight Earnings Surprise',
        stock: 'AAPL',
        difficulty: 2,
        description: 'Apple announces earnings after hours. Stock gaps +10%.',
        initialPrice: 150,
        durationMinutes: 180, // 3:30 PM to 6:30 PM (3 hours)
        keyMoments: [
            { offsetMinutes: 0, label: '3:30 PM — Simulation Start', type: 'start', regime: 'CORE' },
            { offsetMinutes: 30, label: '4:00 PM — Market Close', type: 'regime_change', regime: 'AFTER_HOURS' },
            {
                offsetMinutes: 120, label: '5:30 PM — Earnings Release', type: 'event',
                priceChange: 1.10, // +10%
                traditionalLoss: 1300, shieldLoss: 390, shieldGain: 910
            },
            { offsetMinutes: 121, label: 'Gap Auction Starts', type: 'auction' },
            { offsetMinutes: 180, label: '6:30 PM — End', type: 'end', regime: 'AFTER_HOURS' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 45,           // 30 bps on light trading
                impermanentLoss: 220,     // IL from 10% move
                adverseSelectionLoss: 150,
                gapLoss: 1300,            // Full gap loss (Edge Case 1: $1,300)
                netPnL: -1625,
            },
            shield: {
                feesEarned: 85,           // Higher dynamic fees
                impermanentLoss: 220,     // Same IL
                adverseSelectionLoss: 60, // 60% reduction
                gapLoss: 390,             // 30% of gap (rest captured)
                gapAuctionGains: 910,     // 70% captured
                netPnL: 325,
            },
        },
    },

    // ========================================================================
    // Scenario 2: Monday Morning Gap
    // Source: Comprehensive Guide Edge Case 2, lines 576-621
    // ========================================================================
    {
        id: 2,
        name: 'Monday Morning Gap',
        stock: 'TSLA',
        difficulty: 3,
        description: 'CEO tweets over weekend. Stock gaps -15% on Monday.',
        initialPrice: 200,
        durationMinutes: 240, // 7:30 AM to 11:30 AM (4 hours)
        keyMoments: [
            { offsetMinutes: 0, label: '7:30 AM — Pre-Market', type: 'start', regime: 'PRE_MARKET' },
            { offsetMinutes: 120, label: '9:30 AM — Market Open', type: 'regime_change', regime: 'SOFT_OPEN' },
            {
                offsetMinutes: 120, label: 'Gap Down -15%', type: 'event',
                priceChange: 0.85, // -15%
                traditionalLoss: 1400, shieldLoss: 420, shieldGain: 980
            },
            { offsetMinutes: 121, label: 'Gap Auction', type: 'auction' },
            { offsetMinutes: 125, label: '9:35 AM — Core Session', type: 'regime_change', regime: 'CORE' },
            { offsetMinutes: 240, label: '11:30 AM — End', type: 'end', regime: 'CORE' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 180,
                impermanentLoss: 480,
                adverseSelectionLoss: 280,
                gapLoss: 1400,            // $28 × 50 shares (Edge Case 2)
                netPnL: -1980,
            },
            shield: {
                feesEarned: 320,
                impermanentLoss: 480,
                adverseSelectionLoss: 112,
                gapLoss: 420,
                gapAuctionGains: 980,
                netPnL: 288,
            },
        },
    },

    // ========================================================================
    // Scenario 3: Flash Crash Recovery
    // Source: Comprehensive Guide Edge Case 5, lines 681-726
    // ========================================================================
    {
        id: 3,
        name: 'Flash Crash Recovery',
        stock: 'MSFT',
        difficulty: 3,
        description: 'Fat-finger error causes 12.5% crash, recovers in 45 seconds.',
        initialPrice: 400,
        durationMinutes: 60, // 2:30 PM to 3:30 PM (1 hour focused)
        keyMoments: [
            { offsetMinutes: 0, label: '2:30 PM — Normal Trading', type: 'start', regime: 'CORE' },
            {
                offsetMinutes: 15, label: '2:45 PM — Flash Crash!', type: 'event',
                priceChange: 0.875, // -12.5%
                traditionalLoss: 2500
            },
            {
                offsetMinutes: 15.75, label: '45 sec — Price Recovers', type: 'event',
                priceChange: 1.14, // Back to ~$398
                traditionalLoss: 2400
            }, // Double whammy
            { offsetMinutes: 16, label: 'Circuit Breaker Engaged', type: 'regime_change' },
            { offsetMinutes: 60, label: '3:30 PM — End', type: 'end', regime: 'CORE' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 120,
                impermanentLoss: 350,
                adverseSelectionLoss: 200,
                gapLoss: 4900,            // Edge Case 5: $4,900 total
                netPnL: -5330,
            },
            shield: {
                feesEarned: 120,
                impermanentLoss: 350,
                adverseSelectionLoss: 80,
                gapLoss: 0,               // Circuit breaker paused trading!
                gapAuctionGains: 0,
                netPnL: -310,             // Only minor IL/AS losses
            },
        },
    },

    // ========================================================================
    // Scenario 4: Trading Halt
    // Source: Comprehensive Guide Edge Case 3, lines 622-651
    // ========================================================================
    {
        id: 4,
        name: 'Trading Halt',
        stock: 'GME',
        difficulty: 2,
        description: 'NYSE halts stock for news pending. Oracle goes stale.',
        initialPrice: 25,
        durationMinutes: 90, // 10:15 AM to 11:45 AM
        keyMoments: [
            { offsetMinutes: 0, label: '10:15 AM — Normal', type: 'start', regime: 'CORE' },
            { offsetMinutes: 15, label: '10:30 AM — Trading Halted', type: 'event' },
            { offsetMinutes: 16, label: 'Oracle Stale — CB Triggers', type: 'regime_change' },
            {
                offsetMinutes: 30, label: '10:45 AM — Trading Resumes', type: 'event',
                priceChange: 1.12, // +12%
                traditionalLoss: 500, shieldLoss: 150, shieldGain: 350
            },
            { offsetMinutes: 90, label: '11:45 AM — End', type: 'end', regime: 'CORE' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 80,
                impermanentLoss: 120,
                adverseSelectionLoss: 100,
                gapLoss: 500,
                netPnL: -640,
            },
            shield: {
                feesEarned: 140,
                impermanentLoss: 120,
                adverseSelectionLoss: 40,
                gapLoss: 150,
                gapAuctionGains: 350,
                netPnL: 180,
            },
        },
    },

    // ========================================================================
    // Scenario 5: Low-Liquidity Hour Attack
    // Source: Comprehensive Guide Edge Case 4, lines 653-679
    // ========================================================================
    {
        id: 5,
        name: 'Low-Liquidity Hour Attack',
        stock: 'AMZN',
        difficulty: 3,
        description: 'Whale manipulates thin ECN during pre-market.',
        initialPrice: 180,
        durationMinutes: 120, // 5:00 AM to 7:00 AM
        keyMoments: [
            { offsetMinutes: 0, label: '5:00 AM — Pre-Market', type: 'start', regime: 'PRE_MARKET' },
            { offsetMinutes: 60, label: '6:00 AM — Manipulation Start', type: 'event' },
            {
                offsetMinutes: 61, label: 'ECN Price Pushed to $175', type: 'event',
                priceChange: 0.972, traditionalLoss: 400
            },
            {
                offsetMinutes: 65, label: 'Price Rebounds to $180', type: 'event',
                priceChange: 1.028, traditionalLoss: 400
            },
            { offsetMinutes: 120, label: '7:00 AM — End', type: 'end', regime: 'PRE_MARKET' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 30,
                impermanentLoss: 80,
                adverseSelectionLoss: 120,
                gapLoss: 800,             // Double-dip from manipulation
                netPnL: -970,
            },
            shield: {
                feesEarned: 90,           // Higher pre-market fees
                impermanentLoss: 80,
                adverseSelectionLoss: 48,
                gapLoss: 240,
                gapAuctionGains: 560,
                netPnL: 282,
            },
        },
    },

    // ========================================================================
    // Scenario 6: Informed Trader (VPIN Spike)
    // Source: Comprehensive Guide Edge Case 6, lines 728-756
    // ========================================================================
    {
        id: 6,
        name: 'Informed Trader (VPIN)',
        stock: 'PFE',
        difficulty: 2,
        description: 'FDA announcement expected. VPIN spikes to 0.75.',
        initialPrice: 30,
        durationMinutes: 90, // 3:45 PM to 5:15 PM
        keyMoments: [
            { offsetMinutes: 0, label: '3:45 PM — Normal', type: 'start', regime: 'CORE' },
            { offsetMinutes: 15, label: '4:00 PM — Market Close', type: 'regime_change', regime: 'AFTER_HOURS' },
            { offsetMinutes: 30, label: '4:15 PM — VPIN Spikes 0.75', type: 'event' },
            {
                offsetMinutes: 45, label: '4:30 PM — FDA Approval!', type: 'event',
                priceChange: 1.20, // +20%
                traditionalLoss: 2750, shieldLoss: 825, shieldGain: 1925
            },
            { offsetMinutes: 90, label: '5:15 PM — End', type: 'end', regime: 'AFTER_HOURS' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 60,
                impermanentLoss: 380,
                adverseSelectionLoss: 500,  // Heavy informed trading
                gapLoss: 2750,              // Edge Case 6: $2,750 from inform
                netPnL: -3570,
            },
            shield: {
                feesEarned: 180,            // VPIN drove up fees
                impermanentLoss: 380,
                adverseSelectionLoss: 200,
                gapLoss: 825,
                gapAuctionGains: 1925,
                netPnL: 700,
            },
        },
    },

    // ========================================================================
    // Scenario 7: Weekend Holiday Disaster
    // Source: Comprehensive Guide Edge Case 7, lines 758-793
    // ========================================================================
    {
        id: 7,
        name: 'Weekend Holiday Disaster',
        stock: 'BAC',
        difficulty: 3,
        description: 'Friday holiday. European bank crisis on Saturday.',
        initialPrice: 35,
        durationMinutes: 180, // 8:00 PM Friday to 11:00 PM Saturday (condensed)
        keyMoments: [
            { offsetMinutes: 0, label: 'Fri 8:00 PM — Weekend Starts', type: 'start', regime: 'WEEKEND' },
            { offsetMinutes: 60, label: 'Sat — European Crisis News', type: 'event' },
            {
                offsetMinutes: 120, label: 'Sat — Implied Price -10%', type: 'event',
                priceChange: 0.90,
                traditionalLoss: 900, shieldLoss: 270, shieldGain: 630
            },
            { offsetMinutes: 180, label: 'End of Simulation', type: 'end', regime: 'WEEKEND' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 15,           // Minimal weekend activity
                impermanentLoss: 180,
                adverseSelectionLoss: 200,
                gapLoss: 900,             // Edge Case 7: $900
                netPnL: -1265,
            },
            shield: {
                feesEarned: 75,           // 6x weekend fees
                impermanentLoss: 180,
                adverseSelectionLoss: 80,
                gapLoss: 270,
                gapAuctionGains: 630,
                netPnL: 175,
            },
        },
    },

    // ========================================================================
    // Scenario 8: Stale Oracle Attack
    // Source: Comprehensive Guide Edge Case 8, lines 795-829
    // ========================================================================
    {
        id: 8,
        name: 'Stale Oracle Attack',
        stock: 'NVDA',
        difficulty: 2,
        description: 'Attacker front-runs pending oracle update.',
        initialPrice: 800,
        durationMinutes: 60, // 1:45 PM to 2:45 PM
        keyMoments: [
            { offsetMinutes: 0, label: '1:45 PM — Normal', type: 'start', regime: 'CORE' },
            { offsetMinutes: 15, label: '2:00 PM — Oracle Stops Updating', type: 'event' },
            {
                offsetMinutes: 16, label: 'NVDA rises to $850 on NYSE', type: 'event',
                priceChange: 1.0625, // +6.25%
                traditionalLoss: 1500
            },
            { offsetMinutes: 30, label: '2:15 PM — Arbitrage Complete', type: 'event' },
            { offsetMinutes: 31, label: 'CB Level 4 — Trading Paused', type: 'regime_change' },
            { offsetMinutes: 60, label: '2:45 PM — End', type: 'end', regime: 'CORE' },
        ],
        outcomes: {
            traditional: {
                feesEarned: 90,
                impermanentLoss: 150,
                adverseSelectionLoss: 100,
                gapLoss: 1500,            // Edge Case 8: $1,500
                netPnL: -1660,
            },
            shield: {
                feesEarned: 90,
                impermanentLoss: 150,
                adverseSelectionLoss: 40,
                gapLoss: 0,               // Oracle staleness triggered CB!
                gapAuctionGains: 0,
                netPnL: -100,
            },
        },
    },
];

// ============================================================================
// FEE PARAMETERS (From Developer Handbook §3)
// ============================================================================

export const FEE_PARAMS = {
    BASE_FEES: {
        CORE: 5,
        SOFT_OPEN: 10,
        PRE_MARKET: 15,
        AFTER_HOURS: 15,
        OVERNIGHT: 30,
        WEEKEND: 50,
        HOLIDAY: 50,
    } as Record<Regime, number>,

    MAX_FEES: {
        CORE: 50,
        SOFT_OPEN: 100,
        PRE_MARKET: 150,
        AFTER_HOURS: 150,
        OVERNIGHT: 200,
        WEEKEND: 500,
        HOLIDAY: 500,
    } as Record<Regime, number>,

    REGIME_MULTIPLIERS: {
        CORE: 1.0,
        SOFT_OPEN: 1.5,
        PRE_MARKET: 2.0,
        AFTER_HOURS: 2.0,
        OVERNIGHT: 4.0,
        WEEKEND: 6.0,
        HOLIDAY: 6.0,
    } as Record<Regime, number>,

    // Sensitivity coefficients (Developer Handbook line 320-330)
    ALPHA: 0.5,   // Volatility: 0.5 × σ²
    BETA: 0.3,    // VPIN: 0.3 × VPIN
    GAMMA: 0.2,   // Regime interaction
    DELTA: 0.02,  // Inventory: 2% per unit imbalance
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getScenarioById(id: number): ScenarioData | undefined {
    return SCENARIOS.find(s => s.id === id);
}

export function calculateProtectionValue(scenario: ScenarioData): number {
    return scenario.outcomes.shield.netPnL - scenario.outcomes.traditional.netPnL;
}

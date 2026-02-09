/**
 * Simulation Engine — Pre-computed Frames
 * 
 * Uses hardcoded scenario data to generate smooth, reproducible simulations.
 * No randomness — values are interpolated between key moments.
 */

import type { Regime, SimEvent } from '@/types/simulation';
import {
    ScenarioData,
    KeyMoment,
    getScenarioById,
    LP_CONFIG,
    FEE_PARAMS,
} from './scenario-data';
import { calculateDynamicFee } from './math/fee';
import { determineCircuitBreakerLevel } from './math/circuit-breaker';

// ============================================================================
// TYPES
// ============================================================================

export interface LPBreakdown {
    feesEarned: number;
    impermanentLoss: number;
    adverseSelectionLoss: number;
    gapLoss: number;
    gapAuctionGains: number;
    netPnL: number;
}

export interface SimulationFrame {
    // Time
    offsetMinutes: number;
    time: string;              // Formatted time string
    progress: number;          // 0-1 progress through scenario

    // Prices
    oraclePrice: number;
    poolPriceTraditional: number;
    poolPriceShield: number;

    // Regime & Metrics
    regime: Regime;
    dynamicFee: number;        // bps
    vpin: number;
    inventoryImbalance: number;
    circuitBreakerLevel: 0 | 1 | 2 | 3 | 4;

    // LP P&L
    traditionalPnL: LPBreakdown;
    shieldPnL: LPBreakdown;

    // Event (if any at this moment)
    event: SimEvent | null;
    isKeyMoment: boolean;
}

export interface PrecomputedSimulation {
    scenarioId: number;
    scenario: ScenarioData;
    frames: SimulationFrame[];
    keyMomentIndices: number[];  // Frame indices of key moments
    totalFrames: number;
    framesPerMinute: number;
}

// ============================================================================
// FRAME GENERATION
// ============================================================================

const FRAMES_PER_MINUTE = 10;  // 6 seconds between frames for smooth playback

/**
 * Generate all frames for a scenario
 */
export function generateScenarioFrames(scenarioId: number): PrecomputedSimulation {
    const scenario = getScenarioById(scenarioId);
    if (!scenario) {
        throw new Error(`Scenario ${scenarioId} not found`);
    }

    const { durationMinutes, keyMoments, initialPrice, outcomes } = scenario;
    const totalFrames = durationMinutes * FRAMES_PER_MINUTE;

    const frames: SimulationFrame[] = [];
    const keyMomentIndices: number[] = [];

    // Sort key moments by time
    const sortedMoments = [...keyMoments].sort((a, b) => a.offsetMinutes - b.offsetMinutes);

    // Track current state
    let currentRegime: Regime = sortedMoments[0]?.regime || 'CORE';
    let currentPrice = initialPrice;
    let cumulativeTraditional: LPBreakdown = createEmptyBreakdown();
    let cumulativeShield: LPBreakdown = createEmptyBreakdown();
    let lastEventIdx = 0;

    for (let frameIdx = 0; frameIdx <= totalFrames; frameIdx++) {
        const offsetMinutes = (frameIdx / FRAMES_PER_MINUTE);
        const progress = offsetMinutes / durationMinutes;

        // Find the current moment we're in
        const activeMoment = findActiveMoment(sortedMoments, offsetMinutes);
        const nextMoment = findNextMoment(sortedMoments, offsetMinutes);

        // Update regime if moment specifies one
        if (activeMoment?.regime) {
            currentRegime = activeMoment.regime;
        }

        // Calculate price (linear interpolation between moments)
        currentPrice = interpolatePrice(
            sortedMoments,
            offsetMinutes,
            initialPrice,
            currentPrice
        );

        // Check if this is a key moment
        const keyMoment = sortedMoments.find(
            m => Math.abs(m.offsetMinutes - offsetMinutes) < (0.5 / FRAMES_PER_MINUTE)
        );

        if (keyMoment) {
            keyMomentIndices.push(frameIdx);

            // Apply losses/gains at event moments
            if (keyMoment.traditionalLoss !== undefined) {
                cumulativeTraditional.gapLoss += keyMoment.traditionalLoss;
            }
            if (keyMoment.shieldLoss !== undefined) {
                cumulativeShield.gapLoss += keyMoment.shieldLoss;
            }
            if (keyMoment.shieldGain !== undefined) {
                cumulativeShield.gapAuctionGains += keyMoment.shieldGain;
            }
        }

        // Calculate fees accumulation (gradual over time)
        const feeProgress = progress;
        cumulativeTraditional.feesEarned = outcomes.traditional.feesEarned * feeProgress;
        cumulativeShield.feesEarned = outcomes.shield.feesEarned * feeProgress;

        // IL and AS losses gradually accumulate
        cumulativeTraditional.impermanentLoss = outcomes.traditional.impermanentLoss * feeProgress;
        cumulativeTraditional.adverseSelectionLoss = outcomes.traditional.adverseSelectionLoss * feeProgress;
        cumulativeShield.impermanentLoss = outcomes.shield.impermanentLoss * feeProgress;
        cumulativeShield.adverseSelectionLoss = outcomes.shield.adverseSelectionLoss * feeProgress;

        // Calculate net P&L
        cumulativeTraditional.netPnL = calculateNetPnL(cumulativeTraditional);
        cumulativeShield.netPnL = calculateNetPnL(cumulativeShield);

        // Calculate dynamic metrics
        const vpin = calculateVPINForMoment(sortedMoments, offsetMinutes, currentRegime);
        const inventory = calculateInventoryForMoment(offsetMinutes, durationMinutes);
        const dynamicFee = calculateDynamicFee(currentRegime, 0.35, vpin, inventory);
        const priceDeviation = Math.abs(currentPrice - currentPrice) / currentPrice; // Simplified
        const cbLevel = determineCircuitBreakerLevel(0, priceDeviation, vpin, inventory, currentRegime === 'CORE');

        // Generate event if at a key moment
        let event: SimEvent | null = null;
        if (keyMoment && keyMoment !== sortedMoments[lastEventIdx]) {
            event = createEventFromMoment(keyMoment, scenario);
            lastEventIdx = sortedMoments.indexOf(keyMoment);
        }

        frames.push({
            offsetMinutes,
            time: formatTime(offsetMinutes, keyMoment?.label || ''),
            progress,
            oraclePrice: currentPrice,
            poolPriceTraditional: currentPrice,
            poolPriceShield: cbLevel >= 4 ? initialPrice : currentPrice,
            regime: currentRegime,
            dynamicFee,
            vpin,
            inventoryImbalance: inventory,
            circuitBreakerLevel: cbLevel,
            traditionalPnL: { ...cumulativeTraditional },
            shieldPnL: { ...cumulativeShield },
            event,
            isKeyMoment: !!keyMoment,
        });
    }

    return {
        scenarioId,
        scenario,
        frames,
        keyMomentIndices,
        totalFrames: frames.length,
        framesPerMinute: FRAMES_PER_MINUTE,
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createEmptyBreakdown(): LPBreakdown {
    return {
        feesEarned: 0,
        impermanentLoss: 0,
        adverseSelectionLoss: 0,
        gapLoss: 0,
        gapAuctionGains: 0,
        netPnL: 0,
    };
}

function calculateNetPnL(breakdown: LPBreakdown): number {
    return breakdown.feesEarned
        - breakdown.impermanentLoss
        - breakdown.adverseSelectionLoss
        - breakdown.gapLoss
        + breakdown.gapAuctionGains;
}

function findActiveMoment(moments: KeyMoment[], offsetMinutes: number): KeyMoment | undefined {
    // Find the most recent moment that has passed
    for (let i = moments.length - 1; i >= 0; i--) {
        const moment = moments[i];
        if (moment && moment.offsetMinutes <= offsetMinutes) {
            return moment;
        }
    }
    return moments[0];
}

function findNextMoment(moments: KeyMoment[], offsetMinutes: number): KeyMoment | undefined {
    return moments.find(m => m.offsetMinutes > offsetMinutes);
}

function interpolatePrice(
    moments: KeyMoment[],
    offsetMinutes: number,
    initialPrice: number,
    _currentPrice: number
): number {
    // Find price changes from moments
    let price = initialPrice;

    for (const moment of moments) {
        if (moment.offsetMinutes <= offsetMinutes && moment.priceChange) {
            price = price * moment.priceChange;
        }
    }

    return price;
}

function calculateVPINForMoment(
    moments: KeyMoment[],
    offsetMinutes: number,
    regime: Regime
): number {
    // Check if near a high-VPIN event
    for (const moment of moments) {
        if (moment.label.includes('VPIN') && Math.abs(moment.offsetMinutes - offsetMinutes) < 30) {
            return 0.75; // High VPIN near the event
        }
        if (moment.type === 'event' && Math.abs(moment.offsetMinutes - offsetMinutes) < 10) {
            return 0.55; // Elevated VPIN near events
        }
    }

    // Base VPIN varies by regime
    const baseVPIN: Record<Regime, number> = {
        CORE: 0.25,
        SOFT_OPEN: 0.45,
        PRE_MARKET: 0.35,
        AFTER_HOURS: 0.30,
        OVERNIGHT: 0.40,
        WEEKEND: 0.50,
        HOLIDAY: 0.50,
    };

    return baseVPIN[regime];
}

function calculateInventoryForMoment(offsetMinutes: number, totalMinutes: number): number {
    // Inventory drifts slowly over time, oscillating
    const phase = (offsetMinutes / totalMinutes) * Math.PI * 2;
    return Math.sin(phase) * 0.15; // ±15% inventory drift
}

function formatTime(offsetMinutes: number, label: string): string {
    // Extract time from label if available
    const timeMatch = label.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
    if (timeMatch && timeMatch[1]) {
        return timeMatch[1];
    }

    // Fallback: format as H:MM from base time
    const hours = Math.floor(offsetMinutes / 60);
    const mins = Math.floor(offsetMinutes % 60);
    return `+${hours}:${mins.toString().padStart(2, '0')}`;
}

function createEventFromMoment(moment: KeyMoment, scenario: ScenarioData): SimEvent {
    let severity: 'INFO' | 'WARNING' | 'DANGER' = 'INFO';
    let type: SimEvent['type'] = 'REGIME_CHANGE';

    if (moment.type === 'event') {
        if (moment.traditionalLoss && moment.traditionalLoss > 1000) {
            severity = 'DANGER';
            type = 'TRADE';
        } else {
            severity = 'WARNING';
            type = 'NEWS';
        }
    } else if (moment.type === 'auction') {
        type = 'GAP_AUCTION';
        severity = 'INFO';
    }

    return {
        timestamp: new Date(),
        type,
        description: moment.label,
        severity,
    };
}

// ============================================================================
// SIMULATION RUNNER (for compatibility with existing page)
// ============================================================================

export interface SimulationState {
    currentFrameIndex: number;
    isPlaying: boolean;
    speed: 1 | 5 | 10 | 60;
    precomputed: PrecomputedSimulation;
}

export function createSimulationState(scenarioId: number): SimulationState {
    return {
        currentFrameIndex: 0,
        isPlaying: false,
        speed: 5,
        precomputed: generateScenarioFrames(scenarioId),
    };
}

export function getCurrentFrame(state: SimulationState): SimulationFrame {
    const frame = state.precomputed.frames[state.currentFrameIndex];
    if (!frame) {
        throw new Error(`Frame at index ${state.currentFrameIndex} not found`);
    }
    return frame;
}

export function advanceFrame(state: SimulationState): SimulationState {
    const nextIndex = Math.min(
        state.currentFrameIndex + 1,
        state.precomputed.totalFrames - 1
    );

    return {
        ...state,
        currentFrameIndex: nextIndex,
    };
}

export function seekToProgress(state: SimulationState, progress: number): SimulationState {
    const targetIndex = Math.floor(progress * (state.precomputed.totalFrames - 1));

    return {
        ...state,
        currentFrameIndex: Math.max(0, Math.min(targetIndex, state.precomputed.totalFrames - 1)),
    };
}

export function seekToKeyMoment(state: SimulationState, momentIndex: number): SimulationState {
    const frameIndex = state.precomputed.keyMomentIndices[momentIndex];

    if (frameIndex !== undefined) {
        return {
            ...state,
            currentFrameIndex: frameIndex,
        };
    }

    return state;
}

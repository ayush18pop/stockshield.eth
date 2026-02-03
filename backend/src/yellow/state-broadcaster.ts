/**
 * State Broadcaster for Yellow Network
 * 
 * Broadcasts VPIN, regime, and fee updates via Yellow Network state channels.
 * Enables real-time off-chain parameter updates without gas costs.
 */

import { YellowClient } from './yellow-client';
import { Regime, RegimeDetector, RegimeInfo } from './regime-detector';
import { VPINCalculator, VPINMetrics } from './vpin-calculator';
import { OracleAggregator, OraclePrice } from '../oracle/oracle-aggregator';
import { StateUpdate } from './types';

export interface BroadcasterConfig {
    vpinUpdateInterval: number;    // ms between VPIN broadcasts (default: 5000)
    regimeCheckInterval: number;   // ms between regime checks (default: 60000)
    minVPINChange: number;          // Minimum VPIN change to trigger broadcast (default: 0.05)
}

const DEFAULT_CONFIG: BroadcasterConfig = {
    vpinUpdateInterval: 5000,      // 5 seconds
    regimeCheckInterval: 60000,    // 1 minute
    minVPINChange: 0.05,            // 5% change
};

export class StateBroadcaster {
    private client: YellowClient;
    private vpinCalc: VPINCalculator;
    private regimeDetector: RegimeDetector;
    private oracleAggregator: OracleAggregator | null;
    private config: BroadcasterConfig;

    private isRunning = false;
    private vpinInterval?: NodeJS.Timeout;
    private regimeInterval?: NodeJS.Timeout;

    private lastVPIN = 0;
    private lastRegime: Regime | null = null;
    private channelId: string | null = null;
    private asset: string = 'ETH'; // Default asset

    constructor(
        client: YellowClient,
        vpinCalc: VPINCalculator,
        regimeDetector: RegimeDetector,
        oracleAggregator: OracleAggregator | null = null,
        config: Partial<BroadcasterConfig> = {}
    ) {
        this.client = client;
        this.vpinCalc = vpinCalc;
        this.regimeDetector = regimeDetector;
        this.oracleAggregator = oracleAggregator;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Start broadcasting state updates
     */
    async start(channelId: string): Promise<void> {
        if (this.isRunning) {
            console.log('⚠️  State broadcaster already running');
            return;
        }

        this.channelId = channelId;
        this.isRunning = true;

        console.log('📡 Starting state broadcaster...');
        console.log(`   Channel: ${channelId}`);
        console.log(`   VPIN interval: ${this.config.vpinUpdateInterval}ms`);
        console.log(`   Regime interval: ${this.config.regimeCheckInterval}ms`);

        // Initial broadcast
        await this.broadcastCurrentState();

        // Periodic VPIN updates
        this.vpinInterval = setInterval(async () => {
            await this.checkAndBroadcastVPIN();
        }, this.config.vpinUpdateInterval);

        // Periodic regime checks
        this.regimeInterval = setInterval(async () => {
            await this.checkAndBroadcastRegime();
        }, this.config.regimeCheckInterval);
    }

    /**
     * Stop broadcasting
     */
    stop(): void {
        if (!this.isRunning) {
            return;
        }

        console.log('🛑 Stopping state broadcaster...');

        if (this.vpinInterval) {
            clearInterval(this.vpinInterval);
            this.vpinInterval = undefined;
        }

        if (this.regimeInterval) {
            clearInterval(this.regimeInterval);
            this.regimeInterval = undefined;
        }

        this.isRunning = false;
    }

    /**
     * Broadcast current VPIN if it changed significantly
     */
    async checkAndBroadcastVPIN(): Promise<void> {
        const vpin = this.vpinCalc.getVPIN();
        const change = Math.abs(vpin - this.lastVPIN);

        if (change >= this.config.minVPINChange) {
            await this.broadcastVPIN(vpin);
            this.lastVPIN = vpin;
        }
    }

    /**
     * Check for regime changes and broadcast
     */
    async checkAndBroadcastRegime(): Promise<void> {
        const regimeInfo = this.regimeDetector.getCurrentRegime();

        if (regimeInfo.regime !== this.lastRegime) {
            console.log(`🔄 Regime changed: ${this.lastRegime} → ${regimeInfo.regime}`);
            await this.broadcastRegime(regimeInfo);
            this.lastRegime = regimeInfo.regime;
        }
    }

    /**
     * Broadcast VPIN update
     */
    async broadcastVPIN(vpin: number): Promise<void> {
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const fee = this.calculateRecommendedFee(vpin, regimeInfo);

        // Get oracle price if available
        let oraclePrice: bigint | undefined;
        let oracleConfidence: number | undefined;
        if (this.oracleAggregator) {
            try {
                const oracle = await this.oracleAggregator.getConsensusPrice(this.asset);
                oraclePrice = oracle.price;
                oracleConfidence = oracle.confidence;
            } catch (error) {
                console.warn('⚠️  Failed to fetch oracle price:', error);
            }
        }

        const update: StateUpdate = {
            channelId: this.channelId!,
            timestamp: Date.now(),
            vpin,
            regime: regimeInfo.regime,
            recommendedFee: fee,
            oraclePrice,
            oracleConfidence,
        };

        await this.sendStateUpdate(update);
        console.log(`📊 VPIN broadcast: ${vpin.toFixed(3)} → Fee: ${fee} bps`);
    }

    /**
     * Broadcast regime change
     */
    async broadcastRegime(regimeInfo: RegimeInfo): Promise<void> {
        const vpin = this.vpinCalc.getVPIN();
        const fee = this.calculateRecommendedFee(vpin, regimeInfo);

        const update: StateUpdate = {
            channelId: this.channelId!,
            timestamp: Date.now(),
            vpin,
            regime: regimeInfo.regime,
            recommendedFee: fee,
        };

        await this.sendStateUpdate(update);
        console.log(`🔄 Regime broadcast: ${regimeInfo.regime} → Fee: ${fee} bps`);
    }

    /**
     * Broadcast fee update
     */
    async broadcastFee(fee: number): Promise<void> {
        const vpin = this.vpinCalc.getVPIN();
        const regimeInfo = this.regimeDetector.getCurrentRegime();

        const update: StateUpdate = {
            channelId: this.channelId!,
            timestamp: Date.now(),
            vpin,
            regime: regimeInfo.regime,
            recommendedFee: fee,
        };

        await this.sendStateUpdate(update);
        console.log(`💰 Fee broadcast: ${fee} bps`);
    }

    /**
     * Broadcast complete current state
     */
    async broadcastCurrentState(): Promise<void> {
        const vpin = this.vpinCalc.getVPIN();
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const fee = this.calculateRecommendedFee(vpin, regimeInfo);

        const update: StateUpdate = {
            channelId: this.channelId!,
            timestamp: Date.now(),
            vpin,
            regime: regimeInfo.regime,
            recommendedFee: fee,
        };

        await this.sendStateUpdate(update);
        console.log(`📡 State broadcast: VPIN=${vpin.toFixed(3)}, Regime=${regimeInfo.regime}, Fee=${fee}bps`);
    }

    /**
     * Calculate recommended fee based on VPIN and regime
     * 
     * Formula: fee = f₀ + β×VPIN + γ×R×VPIN
     * Where:
     * - f₀ = base fee (regime-dependent)
     * - β = VPIN sensitivity (0.3)
     * - γ = regime multiplier
     * - R = regime multiplier
     */
    private calculateRecommendedFee(vpin: number, regimeInfo: RegimeInfo): number {
        const f0 = regimeInfo.baseFee;
        const beta = 0.3;
        const gamma = regimeInfo.multiplier;

        // VPIN component (0-100 bps)
        const vpinComponent = beta * vpin * 100;

        // Regime-amplified VPIN
        const regimeComponent = gamma * vpinComponent;

        // Total fee
        const totalFee = f0 + vpinComponent + regimeComponent;

        // Cap at max fee for regime
        return Math.min(totalFee, regimeInfo.maxFee);
    }

    /**
     * Send state update via Yellow Network
     */
    private async sendStateUpdate(update: StateUpdate): Promise<void> {
        if (!this.client.connected || !this.client.authenticated) {
            console.warn('⚠️  Cannot broadcast: client not connected/authenticated');
            return;
        }

        // For now, we'll use a simple JSON-RPC message
        // In production, this would use signed state channel updates
        const message = JSON.stringify({
            jsonrpc: '2.0',
            method: 'state_update',
            params: update,
            id: Date.now(),
        });

        try {
            this.client.send(message);
        } catch (error) {
            console.error('❌ Failed to send state update:', error);
        }
    }

    /**
     * Get current state
     */
    getCurrentState(): StateUpdate | null {
        if (!this.channelId) {
            return null;
        }

        const vpin = this.vpinCalc.getVPIN();
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const fee = this.calculateRecommendedFee(vpin, regimeInfo);

        return {
            channelId: this.channelId,
            timestamp: Date.now(),
            vpin,
            regime: regimeInfo.regime,
            recommendedFee: fee,
        };
    }
}

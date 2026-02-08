/**
 * StockShield API Server
 * 
 * REST API endpoints for frontend integration.
 * WebSocket server for real-time updates.
 */

import http from 'http';
import { randomUUID } from 'crypto';
import { encodeAbiParameters, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { VPINCalculator, VPINMetrics } from '../yellow/vpin-calculator';
import { RegimeDetector, RegimeInfo, Regime } from '../yellow/regime-detector';
import { OracleAggregator, OraclePrice } from '../oracle/oracle-aggregator';
import { YellowClient } from '../yellow/yellow-client';
import { StateBroadcaster } from '../yellow/state-broadcaster';
import { GapAuctionService } from '../yellow/gap-auction';
import { AuctionPhase } from '../yellow/types';

// ============================================================================
// Types
// ============================================================================

interface PoolInfo {
    poolId: string;
    asset: string;
    liquidity: string;
    vpin: number;
    fee: number;
    regime: Regime;
}

interface CircuitBreakerState {
    level: number;
    flags: string[];
    actions: string[];
}

interface AuctionInfo {
    id: string;
    poolId: string;
    phase: 'COMMIT' | 'REVEAL' | 'SETTLED';
    gapPercent: number;
    endTime: number;
}

interface FeeComponents {
    baseFee: number;
    vpinComponent: number;
    volatilityComponent: number;
    inventoryComponent: number;
    regimeMultiplier: number;
    totalFee: number;
}

interface YellowRuntimeStatus {
    connected: boolean;
    authenticated: boolean;
    channelId: string | null;
}

interface YellowSession {
    sessionId: string;
    wallet: string;
    status: 'ACTIVE' | 'SETTLED';
    allowance: number;
    spent: number;
    remaining: number;
    txCount: number;
    startedAt: number;
    updatedAt: number;
    channelId: string | null;
    txLog: Array<{ action: string; amount: number; timestamp: number; vpin: number }>;
}

interface YellowAdapter {
    client: YellowClient;
    getChannelId: () => string | null;
    setChannelId: (channelId: string) => void;
}

interface AutoSettleActivity {
    tradeCount: number;
    lastTradeAt: number;
    lastTurnNum: number;
    inFlight: boolean;
}

interface AutoSettleEvent {
    channelId: string;
    closedAt: number;
    tradeCount: number;
    lastTurnNum: number;
    signature: string;
}

// ============================================================================
// API Server
// ============================================================================

interface PoolInfo {
    poolId: string;
    asset: string;
    liquidity: string;
    vpin: number;
    fee: number;
    regime: Regime;
    ensName?: string;
}

export class APIServer {
    private server: http.Server | null = null;
    private vpinCalc: VPINCalculator;
    private regimeDetector: RegimeDetector;
    private oracleAggregator: OracleAggregator;
    private startTime: number = Date.now();
    private yellowTurnNum: number = 1;
    private yellow: YellowAdapter | null;
    private yellowSession: YellowSession | null = null;
    private autoSettleEnabled = (process.env.YELLOW_AUTO_SETTLE_ENABLED ?? 'true') === 'true';
    private autoSettleIdleMs = Math.max(
        1,
        Number(process.env.YELLOW_AUTO_SETTLE_IDLE_SECONDS ?? '45')
    ) * 1000;
    private autoSettleMinTrades = Math.max(
        1,
        Number(process.env.YELLOW_AUTO_SETTLE_MIN_TRADES ?? '1')
    );
    private autoSettleTimers: Map<string, NodeJS.Timeout> = new Map();
    private autoSettleActivity: Map<string, AutoSettleActivity> = new Map();
    private lastAutoSettleEvent: AutoSettleEvent | null = null;
    private lastAutoSettleError: string | null = null;

    // Mock data for demo (since contracts aren't deployed)
    private mockPools: PoolInfo[] = [
        { poolId: '0xaapl', asset: 'AAPL', liquidity: '1000000', vpin: 0.35, fee: 15, regime: Regime.CORE_SESSION, ensName: 'aapl.pools.stockshield.eth' },
        { poolId: '0xtsla', asset: 'TSLA', liquidity: '750000', vpin: 0.42, fee: 22, regime: Regime.CORE_SESSION, ensName: 'tsla.pools.stockshield.eth' },
        { poolId: '0xeth', asset: 'ETH', liquidity: '2500000', vpin: 0.28, fee: 12, regime: Regime.CORE_SESSION, ensName: 'eth.pools.stockshield.eth' },
    ];

    constructor(
        vpinCalc: VPINCalculator,
        regimeDetector: RegimeDetector,
        oracleAggregator: OracleAggregator,
        yellow: YellowAdapter | null = null,
        private stateBroadcaster: StateBroadcaster | null = null,
        private gapAuction: GapAuctionService | null = null
    ) {
        this.vpinCalc = vpinCalc;
        this.regimeDetector = regimeDetector;
        this.oracleAggregator = oracleAggregator;
        this.yellow = yellow;
    }

    /**
     * Start the API server
     */
    start(port: number = 3001): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.listen(port, () => {
                console.log(`📡 API Server listening on http://localhost:${port}`);
                resolve();
            });

            this.server.on('error', reject);
        });
    }

    /**
     * Stop the API server
     */
    stop(): Promise<void> {
        return new Promise((resolve) => {
            for (const timer of this.autoSettleTimers.values()) {
                clearTimeout(timer);
            }
            this.autoSettleTimers.clear();
            this.autoSettleActivity.clear();

            if (this.server) {
                this.server.close(() => {
                    console.log('📡 API Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle incoming HTTP requests
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathname = url.pathname;

        try {
            // Route handling
            if (pathname === '/api/health') {
                return this.handleHealth(res);
            }

            if (pathname === '/api/regime') {
                return this.handleRegime(res);
            }

            if (pathname.startsWith('/api/vpin/')) {
                const poolId = pathname.replace('/api/vpin/', '');
                return this.handleVPIN(res, poolId);
            }

            if (pathname.startsWith('/api/price/')) {
                const asset = pathname.replace('/api/price/', '');
                return await this.handlePrice(res, asset);
            }

            if (pathname.startsWith('/api/fees/')) {
                const poolId = pathname.replace('/api/fees/', '');
                return this.handleFees(res, poolId);
            }

            if (pathname === '/api/pools') {
                return this.handlePools(res);
            }

            if (pathname.startsWith('/api/pools/')) {
                const poolId = pathname.replace('/api/pools/', '');
                return this.handlePoolDetail(res, poolId);
            }

            if (pathname === '/api/circuit-breaker') {
                return this.handleCircuitBreaker(res);
            }

            if (pathname === '/api/auctions/active') {
                return this.handleActiveAuctions(res);
            }

            // Trade endpoint - processes trades and broadcasts via Yellow
            if (pathname === '/api/trade' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return await this.handleTrade(res, body);
            }

            if (pathname === '/api/yellow/status') {
                return this.handleYellowStatus(res);
            }

            if (pathname === '/api/yellow/auto-settle') {
                return this.handleYellowAutoSettleStatus(res);
            }

            if (pathname === '/api/yellow/sign-trade' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return await this.handleYellowSignTrade(res, body);
            }

            if (pathname === '/api/yellow/session/start' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return await this.handleYellowStartSession(res, body);
            }

            if (pathname === '/api/yellow/session/spend' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return this.handleYellowSpend(res, body);
            }

            if (pathname === '/api/yellow/session/settle' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return this.handleYellowSettle(res, body);
            }

            // Gap Auction endpoints
            if (pathname === '/api/gap-auction/status') {
                return this.handleGapAuctionStatus(res);
            }

            if (pathname === '/api/gap-auction/start' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return await this.handleGapAuctionStart(res, body);
            }

            if (pathname === '/api/gap-auction/commit' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return await this.handleGapAuctionCommit(res, body);
            }

            if (pathname === '/api/gap-auction/reveal' && req.method === 'POST') {
                const body = await this.parseJsonBody(req);
                return await this.handleGapAuctionReveal(res, body);
            }

            // 404 Not Found
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not Found', path: pathname }));

        } catch (error) {
            console.error('API Error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({
                error: 'Internal Server Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            }));
        }
    }

    private parseJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
                if (body.length > 1_000_000) {
                    reject(new Error('Request body too large'));
                }
            });

            req.on('end', () => {
                if (!body.trim()) {
                    resolve({});
                    return;
                }
                try {
                    resolve(JSON.parse(body) as Record<string, unknown>);
                } catch {
                    reject(new Error('Invalid JSON body'));
                }
            });

            req.on('error', (error) => reject(error));
        });
    }

    // ========================================================================
    // Route Handlers
    // ========================================================================

    private handleHealth(res: http.ServerResponse): void {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const response = {
            status: 'healthy',
            uptime,
            services: {
                vpin: 'active',
                regime: 'active',
                oracle: 'active',
            },
            timestamp: Date.now(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }

    private handleRegime(res: http.ServerResponse): void {
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const nextTransition = this.regimeDetector.getTimeUntilNextRegime();

        const response = {
            regime: regimeInfo.regime,
            multiplier: regimeInfo.multiplier,
            baseFee: regimeInfo.baseFee,
            maxFee: regimeInfo.maxFee,
            riskLevel: regimeInfo.riskLevel,
            nextTransition: {
                regime: nextTransition.nextRegime,
                secondsUntil: nextTransition.secondsUntil,
            },
            timestamp: Date.now(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }

    private handleVPIN(res: http.ServerResponse, poolId: string): void {
        const metrics = this.vpinCalc.getMetrics();
        const interpretation = this.vpinCalc.getInterpretation(metrics.vpin);

        const response = {
            poolId,
            vpin: metrics.vpin,
            bucketCount: metrics.bucketsFilled,
            bucketSize: metrics.bucketSize,
            interpretation: interpretation.level,
            description: interpretation.description,
            recommendedAction: interpretation.recommendedAction,
            timestamp: Date.now(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }

    private async handlePrice(res: http.ServerResponse, asset: string): Promise<void> {
        // Mock prices for fallback when oracles are slow/unavailable
        const mockPrices: Record<string, number> = {
            'ETH': 3200,
            'BTC': 95000,
            'AAPL': 185,
            'TSLA': 250,
        };

        try {
            // Race between oracle call and timeout
            const timeoutPromise = new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), 5000)
            );

            const pricePromise = this.oracleAggregator.getConsensusPrice(asset.toUpperCase());
            const price = await Promise.race([pricePromise, timeoutPromise]);

            if (price && price.price > 0n) {
                // Real price from oracle
                const priceNumber = Number(price.price) / 1e18;

                const response = {
                    asset: asset.toUpperCase(),
                    price: priceNumber,
                    priceRaw: price.price.toString(),
                    source: price.source,
                    confidence: price.confidence,
                    timestamp: price.timestamp,
                    fetchedAt: Date.now(),
                };
                res.writeHead(200);
                res.end(JSON.stringify(response));
            } else {
                // Fallback to mock price
                const mockPrice = mockPrices[asset.toUpperCase()] || 100;
                const response = {
                    asset: asset.toUpperCase(),
                    price: mockPrice,
                    priceRaw: (BigInt(Math.floor(mockPrice)) * BigInt(10 ** 18)).toString(),
                    source: 'mock' as const,
                    confidence: 0.5,
                    timestamp: Date.now() / 1000,
                    fetchedAt: Date.now(),
                };
                res.writeHead(200);
                res.end(JSON.stringify(response));
            }
        } catch (error) {
            // Error fallback - return mock price with low confidence
            const mockPrice = mockPrices[asset.toUpperCase()] || 100;
            const response = {
                asset: asset.toUpperCase(),
                price: mockPrice,
                priceRaw: (BigInt(Math.floor(mockPrice)) * BigInt(10 ** 18)).toString(),
                source: 'mock' as const,
                confidence: 0.3,
                timestamp: Date.now() / 1000,
                fetchedAt: Date.now(),
            };
            res.writeHead(200);
            res.end(JSON.stringify(response));
        }
    }

    private handleFees(res: http.ServerResponse, poolId: string): void {
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const vpin = this.vpinCalc.getVPIN();

        // Calculate fee components (simplified version of contract logic)
        const baseFee = regimeInfo.baseFee;
        const vpinComponent = Math.floor(vpin * 30); // β = 0.3
        const volatilityComponent = 5; // Mock volatility
        const inventoryComponent = 2; // Mock inventory

        const totalBeforeMultiplier = baseFee + vpinComponent + volatilityComponent + inventoryComponent;
        const totalFee = Math.min(
            Math.floor(totalBeforeMultiplier * regimeInfo.multiplier),
            regimeInfo.maxFee
        );

        const response: FeeComponents = {
            baseFee,
            vpinComponent,
            volatilityComponent,
            inventoryComponent,
            regimeMultiplier: regimeInfo.multiplier,
            totalFee,
        };
        res.writeHead(200);
        res.end(JSON.stringify({ poolId, ...response, timestamp: Date.now() }));
    }

    private handlePools(res: http.ServerResponse): void {
        // Update mock pools with current regime
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const vpin = this.vpinCalc.getVPIN();

        const pools = this.mockPools.map(pool => ({
            ...pool,
            regime: regimeInfo.regime,
            vpin: Math.max(0, Math.min(1, vpin + (Math.random() * 0.1 - 0.05))), // Slight variation per pool, clamped to 0-1
        }));

        const response = {
            pools,
            count: pools.length,
            timestamp: Date.now(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }

    private handlePoolDetail(res: http.ServerResponse, poolId: string): void {
        const pool = this.mockPools.find(p => p.poolId === poolId);

        if (!pool) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Pool not found', poolId }));
            return;
        }

        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const vpin = this.vpinCalc.getVPIN();

        const response = {
            ...pool,
            regime: regimeInfo.regime,
            vpin,
            regimeInfo: {
                multiplier: regimeInfo.multiplier,
                baseFee: regimeInfo.baseFee,
                maxFee: regimeInfo.maxFee,
                riskLevel: regimeInfo.riskLevel,
            },
            timestamp: Date.now(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }

    private handleCircuitBreaker(res: http.ServerResponse): void {
        const vpin = this.vpinCalc.getVPIN();

        // Calculate circuit breaker level based on VPIN and other factors
        let level = 0;
        const flags: string[] = [];
        const actions: string[] = [];

        if (vpin > 0.7) {
            level++;
            flags.push('HIGH_VPIN');
            actions.push('Increased fees by 50%');
        }
        if (vpin > 0.8) {
            level++;
            flags.push('EXTREME_VPIN');
            actions.push('Reduced liquidity depth by 50%');
        }
        // Could add more flags: ORACLE_STALE, PRICE_DEVIATION, INVENTORY_IMBALANCE

        const response: CircuitBreakerState = {
            level,
            flags,
            actions,
        };
        res.writeHead(200);
        res.end(JSON.stringify({ ...response, timestamp: Date.now() }));
    }

    private handleActiveAuctions(res: http.ServerResponse): void {
        // Mock active auctions (no real contract yet)
        const auctions: AuctionInfo[] = [];

        // Could add mock auction based on regime transitions
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        if (regimeInfo.regime === Regime.SOFT_OPEN) {
            auctions.push({
                id: '0xauction1',
                poolId: '0xaapl',
                phase: 'COMMIT',
                gapPercent: 2.5,
                endTime: Date.now() + 30000, // 30 seconds
            });
        }

        const response = {
            auctions,
            count: auctions.length,
            timestamp: Date.now(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }

    /**
     * Handle trade simulation - core integration point
     * Processes trade → Updates VPIN → Calculates fee → Broadcasts via Yellow
     */
    private async handleTrade(
        res: http.ServerResponse,
        body: Record<string, unknown>
    ): Promise<void> {
        // Parse trade request
        const asset = typeof body.asset === 'string' ? body.asset.toUpperCase() : 'ETH';
        const volumeRaw = typeof body.volume === 'number' ? body.volume : Number(body.volume);
        const isBuy = typeof body.isBuy === 'boolean' ? body.isBuy : body.direction === 'BUY';

        if (!Number.isFinite(volumeRaw) || volumeRaw <= 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid trade volume' }));
            return;
        }

        // 1. Process trade in VPIN calculator
        const vpinBefore = this.vpinCalc.getVPIN();
        const metrics = this.vpinCalc.processTrade(volumeRaw, isBuy);
        const vpinAfter = metrics.vpin;

        // 2. Get current regime
        const regimeInfo = this.regimeDetector.getCurrentRegime();

        // 3. Calculate dynamic fee (matching hook formula)
        const baseFee = regimeInfo.baseFee;
        const vpinComponent = Math.floor(vpinAfter * 30); // β = 0.3
        const regimeComponent = Math.floor(regimeInfo.multiplier * vpinComponent);
        const recommendedFee = Math.min(
            baseFee + vpinComponent + regimeComponent,
            regimeInfo.maxFee
        );

        // 4. Get oracle price if available
        let oraclePrice: number | undefined;
        try {
            const price = await this.oracleAggregator.getConsensusPrice(asset);
            oraclePrice = Number(price.price) / 1e18;
        } catch {
            // Continue without oracle price
        }

        // 5. Broadcast via Yellow Network if connected
        let signature: string | null = null;
        const channelId = this.yellow?.getChannelId() ?? null;

        if (this.stateBroadcaster && channelId) {
            try {
                // Trigger full state broadcast
                await this.stateBroadcaster.broadcastCurrentState();

                // Sign the trade-specific update
                if (this.yellow?.client) {
                    const tradeState = {
                        channelId,
                        timestamp: Date.now(),
                        trade: { asset, volume: volumeRaw, isBuy },
                        vpin: vpinAfter,
                        regime: regimeInfo.regime,
                        recommendedFee,
                        oraclePrice,
                    };
                    signature = await this.yellow.client.signStateUpdate(tradeState);
                    console.log(`📊 Trade broadcast: ${asset} ${isBuy ? 'BUY' : 'SELL'} $${volumeRaw} → VPIN: ${vpinAfter.toFixed(3)}, Fee: ${recommendedFee}bps`);
                }
            } catch (err) {
                console.warn('⚠️ Yellow broadcast failed:', err);
            }
        }

        // 6. Return full response
        res.writeHead(200);
        res.end(JSON.stringify({
            trade: {
                asset,
                volume: volumeRaw,
                direction: isBuy ? 'BUY' : 'SELL',
                timestamp: Date.now(),
            },
            riskMetrics: {
                vpinBefore,
                vpinAfter,
                vpinDelta: vpinAfter - vpinBefore,
                regime: regimeInfo.regime,
                regimeMultiplier: regimeInfo.multiplier,
                recommendedFee,
                oraclePrice,
            },
            yellow: {
                channelId,
                signature,
                broadcasted: !!signature,
            },
            timestamp: Date.now(),
        }));
    }

    private getYellowRuntimeStatus(): YellowRuntimeStatus {
        const channelId = this.yellow?.getChannelId() ?? null;
        return {
            connected: this.yellow?.client.connected ?? false,
            authenticated: this.yellow?.client.authenticated ?? false,
            channelId,
        };
    }

    private regimeToId(regime: Regime): number {
        const mapping: Record<Regime, number> = {
            [Regime.CORE_SESSION]: 0,
            [Regime.SOFT_OPEN]: 1,
            [Regime.PRE_MARKET]: 2,
            [Regime.AFTER_HOURS]: 3,
            [Regime.OVERNIGHT]: 4,
            [Regime.WEEKEND]: 5,
            [Regime.HOLIDAY]: 6,
        };
        return mapping[regime];
    }

    private calculateRecommendedFee(vpin: number, regimeInfo: RegimeInfo): number {
        const baseFee = regimeInfo.baseFee;
        const vpinComponent = Math.floor(vpin * 30);
        const regimeComponent = Math.floor(regimeInfo.multiplier * vpinComponent);
        return Math.min(baseFee + vpinComponent + regimeComponent, regimeInfo.maxFee);
    }

    private getTradeSignerAddress(): string | null {
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) return null;
        try {
            return privateKeyToAccount(privateKey as `0x${string}`).address;
        } catch {
            return null;
        }
    }

    private getAutoSettleStatus() {
        return {
            enabled: this.autoSettleEnabled,
            idleSeconds: Math.floor(this.autoSettleIdleMs / 1000),
            minTrades: this.autoSettleMinTrades,
            activeChannels: this.autoSettleActivity.size,
            lastEvent: this.lastAutoSettleEvent,
            lastError: this.lastAutoSettleError,
        };
    }

    private handleYellowAutoSettleStatus(res: http.ServerResponse): void {
        res.writeHead(200);
        res.end(
            JSON.stringify({
                autoSettle: this.getAutoSettleStatus(),
                timestamp: Date.now(),
            })
        );
    }

    private scheduleAutoSettle(channelId: string, turnNum: number): void {
        if (!this.autoSettleEnabled) return;

        const current = this.autoSettleActivity.get(channelId);
        this.autoSettleActivity.set(channelId, {
            tradeCount: (current?.tradeCount ?? 0) + 1,
            lastTradeAt: Date.now(),
            lastTurnNum: turnNum,
            inFlight: current?.inFlight ?? false,
        });

        const pendingTimer = this.autoSettleTimers.get(channelId);
        if (pendingTimer) {
            clearTimeout(pendingTimer);
        }

        const timeout = setTimeout(() => {
            void this.tryAutoSettle(channelId);
        }, this.autoSettleIdleMs);
        this.autoSettleTimers.set(channelId, timeout);
    }

    private async tryAutoSettle(channelId: string): Promise<void> {
        const activity = this.autoSettleActivity.get(channelId);
        if (!activity) return;
        if (activity.inFlight) return;

        const idleFor = Date.now() - activity.lastTradeAt;
        if (idleFor < this.autoSettleIdleMs || activity.tradeCount < this.autoSettleMinTrades) {
            return;
        }
        if (!this.yellow?.client.connected || !this.yellow.client.authenticated) {
            this.lastAutoSettleError = 'Auto-settle skipped: Yellow client not connected/authenticated';
            return;
        }

        activity.inFlight = true;
        this.autoSettleActivity.set(channelId, activity);

        try {
            const closePayload = {
                channelId,
                reason: 'idle_auto_settle',
                tradeCount: activity.tradeCount,
                lastTurnNum: activity.lastTurnNum,
                settledAt: Date.now(),
            };
            const signature = await this.yellow.client.signStateUpdate(closePayload);
            await this.yellow.client.closeChannel(channelId);

            if (this.yellow.getChannelId() === channelId) {
                this.yellow.setChannelId('');
            }

            this.lastAutoSettleEvent = {
                channelId,
                closedAt: Date.now(),
                tradeCount: activity.tradeCount,
                lastTurnNum: activity.lastTurnNum,
                signature,
            };
            this.lastAutoSettleError = null;
            this.autoSettleActivity.delete(channelId);

            const timer = this.autoSettleTimers.get(channelId);
            if (timer) clearTimeout(timer);
            this.autoSettleTimers.delete(channelId);

            console.log(
                `🧾 Auto-settled channel ${channelId.slice(0, 12)}... after ${activity.tradeCount} signed trades`
            );
        } catch (error) {
            this.lastAutoSettleError =
                error instanceof Error ? error.message : 'Auto-settle failed';
            activity.inFlight = false;
            this.autoSettleActivity.set(channelId, activity);
            console.warn(`⚠️ Auto-settle failed for ${channelId}:`, error);
        }
    }

    private normalizeBytes32Hex(candidate: string, fallbackSeed: string): `0x${string}` {
        if (/^0x[a-fA-F0-9]{64}$/.test(candidate)) {
            return candidate as `0x${string}`;
        }
        return keccak256(stringToHex(fallbackSeed));
    }

    private normalizeBytes32ChannelId(
        candidate: string | null | undefined,
        poolId: string,
        asset: string
    ): `0x${string}` {
        return this.normalizeBytes32Hex(
            candidate ?? '',
            `stockshield-yellow:${candidate ?? ''}:${poolId}:${asset}`
        );
    }

    private async handleYellowSignTrade(
        res: http.ServerResponse,
        body: Record<string, unknown>
    ): Promise<void> {
        const runtime = this.getYellowRuntimeStatus();

        // Demo fallback: if Yellow is unavailable, generate mock signed data
        const yellowAvailable = this.yellow && runtime.connected && runtime.authenticated;

        let activeChannelId = runtime.channelId;
        if (yellowAvailable && !activeChannelId) {
            try {
                activeChannelId = await this.yellow!.client.createChannel();
                this.yellow!.setChannelId(activeChannelId);
            } catch (error) {
                console.warn('⚠️  Yellow channel creation failed, falling back to demo mode:', error);
            }
        }

        // If still no channel, generate a demo/mock one
        if (!activeChannelId) {
            activeChannelId = this.normalizeBytes32Hex(
                Math.random().toString(),
                `demo-channel-${Date.now()}`
            );
        }

        const relayChannelId = activeChannelId;

        const poolId = typeof body.poolId === 'string' ? body.poolId : '0x';
        const asset = typeof body.asset === 'string' ? body.asset.toUpperCase() : 'UNKNOWN';
        const amountIn = typeof body.amountIn === 'string' ? body.amountIn : String(body.amountIn ?? '0');
        const zeroForOne = typeof body.zeroForOne === 'boolean' ? body.zeroForOne : false;
        const tokenIn = typeof body.tokenIn === 'string' ? body.tokenIn : '';
        const tokenOut = typeof body.tokenOut === 'string' ? body.tokenOut : '';
        const hookAddressRaw = typeof body.hookAddress === 'string'
            ? body.hookAddress
            : (process.env.STOCK_SHIELD_HOOK_ADDRESS ?? '');
        const chainIdRaw = typeof body.chainId === 'number'
            ? body.chainId
            : Number(process.env.CHAIN_ID ?? '11155111');
        const gapAuctionBidRaw = typeof body.gapAuctionBid === 'number'
            ? body.gapAuctionBid
            : Number(body.gapAuctionBid ?? 0);
        const providedChannelId = typeof body.onChainChannelId === 'string'
            ? body.onChainChannelId
            : (typeof body.channelId === 'string' ? body.channelId : relayChannelId);

        if (!/^0x[a-fA-F0-9]{40}$/.test(hookAddressRaw)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid hookAddress for signed trade state' }));
            return;
        }
        if (!Number.isFinite(chainIdRaw) || chainIdRaw <= 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid chainId for signed trade state' }));
            return;
        }

        const poolIdBytes32 = this.normalizeBytes32Hex(
            poolId,
            `stockshield-pool:${poolId}:${tokenIn}:${tokenOut}`
        );
        const channelId = this.normalizeBytes32ChannelId(providedChannelId, poolId, asset);

        const currentVPIN = this.vpinCalc.getVPIN();
        const regimeInfo = this.regimeDetector.getCurrentRegime();
        const regimeId = this.regimeToId(regimeInfo.regime);
        const recommendedFee = this.calculateRecommendedFee(currentVPIN, regimeInfo);
        const vpinScaled = Math.max(0, Math.floor(currentVPIN * 1e18));
        const turnNum = this.yellowTurnNum++;
        const timestamp = Math.floor(Date.now() / 1000);
        const gapAuctionBid = Number.isFinite(gapAuctionBidRaw)
            ? Math.max(0, Math.floor(gapAuctionBidRaw))
            : 0;

        const stateHash = keccak256(
            encodeAbiParameters(
                [
                    { name: 'hook', type: 'address' },
                    { name: 'chainId', type: 'uint256' },
                    { name: 'poolId', type: 'bytes32' },
                    { name: 'channelId', type: 'bytes32' },
                    { name: 'vpin', type: 'uint256' },
                    { name: 'regime', type: 'uint8' },
                    { name: 'recommendedFee', type: 'uint24' },
                    { name: 'turnNum', type: 'uint256' },
                    { name: 'timestamp', type: 'uint256' },
                    { name: 'gapAuctionBid', type: 'uint256' },
                ],
                [
                    hookAddressRaw as `0x${string}`,
                    BigInt(Math.floor(chainIdRaw)),
                    poolIdBytes32,
                    channelId,
                    BigInt(vpinScaled),
                    regimeId,
                    recommendedFee,
                    BigInt(turnNum),
                    BigInt(timestamp),
                    BigInt(gapAuctionBid),
                ]
            )
        );

        let signature: string;
        try {
            const privateKey = process.env.PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('Missing PRIVATE_KEY for trade-state signing');
            }
            const signer = privateKeyToAccount(privateKey as `0x${string}`);
            signature = await signer.signMessage({
                message: { raw: stateHash },
            });
        } catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({
                error: 'Failed to sign Yellow trade state',
                message: error instanceof Error ? error.message : 'Unknown signing error',
            }));
            return;
        }

        const hookData = encodeAbiParameters(
            [
                { name: 'channelId', type: 'bytes32' },
                { name: 'vpin', type: 'uint256' },
                { name: 'regime', type: 'uint8' },
                { name: 'recommendedFee', type: 'uint24' },
                { name: 'turnNum', type: 'uint256' },
                { name: 'timestamp', type: 'uint256' },
                { name: 'gapAuctionBid', type: 'uint256' },
                { name: 'signature', type: 'bytes' },
            ],
            [
                channelId,
                BigInt(vpinScaled),
                regimeId,
                recommendedFee,
                BigInt(turnNum),
                BigInt(timestamp),
                BigInt(gapAuctionBid),
                signature as `0x${string}`,
            ]
        );

        this.scheduleAutoSettle(relayChannelId, turnNum);

        res.writeHead(200);
        res.end(JSON.stringify({
            hookData,
            debug: {
                relayChannelId,
                channelId,
                poolId: poolIdBytes32,
                asset,
                amountIn,
                zeroForOne,
                tokenIn,
                tokenOut,
                hookAddress: hookAddressRaw,
                chainId: Math.floor(chainIdRaw),
                vpin: currentVPIN,
                vpinScaled,
                regime: regimeInfo.regime,
                regimeId,
                recommendedFee,
                turnNum,
                timestamp,
                gapAuctionBid,
                stateHash,
                signature,
                signer: this.getTradeSignerAddress(),
                autoSettle: this.getAutoSettleStatus(),
            },
            timestamp: Date.now(),
        }));
    }

    private handleYellowStatus(res: http.ServerResponse): void {
        const runtime = this.getYellowRuntimeStatus();
        const response = {
            runtime,
            session: this.yellowSession,
            signer: this.getTradeSignerAddress(),
            autoSettle: this.getAutoSettleStatus(),
            timestamp: Date.now(),
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }

    private async handleYellowStartSession(
        res: http.ServerResponse,
        body: Record<string, unknown>
    ): Promise<void> {
        const runtime = this.getYellowRuntimeStatus();

        if (!this.yellow || !runtime.connected || !runtime.authenticated) {
            res.writeHead(503);
            res.end(JSON.stringify({
                error: 'Yellow client is not connected/authenticated',
                runtime,
            }));
            return;
        }

        let channelId = runtime.channelId;
        if (!channelId) {
            channelId = await this.yellow.client.createChannel();
            this.yellow.setChannelId(channelId);
        }

        const wallet = typeof body.wallet === 'string' ? body.wallet : 'anonymous';
        const allowanceRaw = typeof body.allowance === 'number' ? body.allowance : 25;
        const allowance = Number.isFinite(allowanceRaw) ? Math.max(allowanceRaw, 0) : 25;
        const now = Date.now();

        this.yellowSession = {
            sessionId: randomUUID(),
            wallet,
            status: 'ACTIVE',
            allowance,
            spent: 0,
            remaining: allowance,
            txCount: 0,
            startedAt: now,
            updatedAt: now,
            channelId,
            txLog: [],
        };

        res.writeHead(200);
        res.end(JSON.stringify({
            message: 'Yellow session started',
            runtime: this.getYellowRuntimeStatus(),
            session: this.yellowSession,
            timestamp: now,
        }));
    }

    private async handleYellowSpend(res: http.ServerResponse, body: Record<string, unknown>): Promise<void> {
        if (!this.yellowSession || this.yellowSession.status !== 'ACTIVE') {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No active Yellow session' }));
            return;
        }

        const amountRaw = typeof body.amount === 'number' ? body.amount : Number(body.amount);
        if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid spend amount' }));
            return;
        }

        if (amountRaw > this.yellowSession.remaining) {
            res.writeHead(400);
            res.end(JSON.stringify({
                error: 'Insufficient session balance',
                session: this.yellowSession,
            }));
            return;
        }

        // Update session state
        this.yellowSession.spent += amountRaw;
        this.yellowSession.remaining = this.yellowSession.allowance - this.yellowSession.spent;
        this.yellowSession.txCount += 1;
        this.yellowSession.updatedAt = Date.now();

        // Simulate a trade for VPIN calculation to show real-time risk engine
        const isBuy = Math.random() > 0.5;
        this.vpinCalc.processTrade(amountRaw * 1000, isBuy);
        const currentVPIN = this.vpinCalc.getVPIN();

        const actionLabel = typeof body.action === 'string' ? body.action : 'spend';

        // ============================================================
        // REAL YELLOW SDK INTEGRATION: Sign the state update
        // ============================================================
        let signature: string | null = null;
        const turnNumber = this.yellowSession.txCount;

        if (this.yellow?.client) {
            try {
                // Create state update payload matching Nitrolite format
                const statePayload = {
                    channelId: this.yellowSession.channelId,
                    turnNum: turnNumber,
                    timestamp: Date.now(),
                    balances: {
                        spent: this.yellowSession.spent,
                        remaining: this.yellowSession.remaining,
                    },
                    action: actionLabel,
                    amount: amountRaw,
                    vpin: currentVPIN,
                };

                // Sign with session key - this is the REAL off-chain proof
                signature = await this.yellow.client.signStateUpdate(statePayload);
                console.log(`🔐 Signed state update #${turnNumber}: ${signature.slice(0, 20)}...`);
            } catch (err) {
                console.warn('⚠️ State signing failed (continuing with unsigned):', err);
            }
        }

        // Record in transaction log with signature proof
        (this.yellowSession.txLog as Array<{
            action: string;
            amount: number;
            timestamp: number;
            vpin: number;
            signature?: string;
            turnNumber?: number;
        }>).push({
            action: actionLabel,
            amount: amountRaw,
            timestamp: Date.now(),
            vpin: currentVPIN,
            signature: signature ?? undefined,
            turnNumber,
        });

        res.writeHead(200);
        res.end(JSON.stringify({
            message: 'Off-chain spend recorded (gas-free, instant)',
            action: actionLabel,
            vpin: currentVPIN,
            signature,            // Proof of off-chain operation
            turnNumber,           // State progression
            runtime: this.getYellowRuntimeStatus(),
            session: this.yellowSession,
            timestamp: Date.now(),
        }));
    }


    private async handleYellowSettle(res: http.ServerResponse, body: Record<string, unknown>): Promise<void> {
        if (!this.yellowSession || this.yellowSession.status !== 'ACTIVE') {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No active Yellow session to settle' }));
            return;
        }

        const providedChannelId =
            typeof body.onChainChannelId === 'string' ? body.onChainChannelId : '';
        const channelIdCandidate = providedChannelId || this.yellowSession.channelId || '';
        const channelId =
            /^0x[a-fA-F0-9]{64}$/.test(channelIdCandidate) ? channelIdCandidate : null;

        // ============================================================
        // REAL YELLOW SDK INTEGRATION: Close channel with ClearNode
        // ============================================================
        let finalStateHash: string | null = null;
        let closeSignature: string | null = null;

        if (this.yellow?.client && channelId) {
            try {
                // Create final state for settlement
                const finalState = {
                    channelId,
                    finalTurnNum: this.yellowSession.txCount,
                    totalSpent: this.yellowSession.spent,
                    totalRemaining: this.yellowSession.remaining,
                    txCount: this.yellowSession.txCount,
                    settledAt: Date.now(),
                };

                // Sign final state
                closeSignature = await this.yellow.client.signStateUpdate(finalState);
                finalStateHash = `0x${Buffer.from(JSON.stringify(finalState)).toString('hex').slice(0, 64).padEnd(64, '0')}`;

                // Close channel with ClearNode
                await this.yellow.client.closeChannel(channelId);
                console.log(`📦 Channel ${channelId.slice(0, 10)}... closed with ClearNode`);

                // Clear the stored channel ID after closing
                this.yellow.setChannelId('');
                const pendingTimer = this.autoSettleTimers.get(channelId);
                if (pendingTimer) clearTimeout(pendingTimer);
                this.autoSettleTimers.delete(channelId);
                this.autoSettleActivity.delete(channelId);
            } catch (err) {
                console.warn('⚠️ ClearNode channel close failed (continuing):', err);
            }
        }

        this.yellowSession.status = 'SETTLED';
        this.yellowSession.updatedAt = Date.now();

        res.writeHead(200);
        res.end(JSON.stringify({
            message: 'Session settled off-chain. Use tx payload to finalize on-chain.',
            session: this.yellowSession,
            runtime: this.getYellowRuntimeStatus(),
            settlement: {
                finalStateHash,
                closeSignature,
                totalTxCount: this.yellowSession.txCount,
                totalSpent: this.yellowSession.spent,
                gasSaved: `${this.yellowSession.txCount * 21000} gas units (${this.yellowSession.txCount} tx × 21000)`,
            },
            onchain: channelId
                ? {
                    ready: true,
                    target: process.env.MARGIN_VAULT_ADDRESS || '0x04E3BDfa11Ae10034eEb2d1a30f42734c50A0c2C',
                    method: 'closeChannel',
                    args: [channelId],
                }
                : {
                    ready: false,
                    reason: 'Provide a valid bytes32 onChainChannelId to execute closeChannel.',
                },
            timestamp: Date.now(),
        }));
    }

    // ========================================================================
    // Gap Auction Handlers
    // ========================================================================

    private currentAuctionId: string | null = null;

    private handleGapAuctionStatus(res: http.ServerResponse): void {
        if (!this.gapAuction || !this.currentAuctionId) {
            res.writeHead(200);
            res.end(JSON.stringify({
                active: false,
                message: 'No active gap auction',
                timestamp: Date.now(),
            }));
            return;
        }

        const auction = this.gapAuction.getAuction(this.currentAuctionId);
        if (!auction) {
            res.writeHead(200);
            res.end(JSON.stringify({
                active: false,
                message: 'Auction not found',
                timestamp: Date.now(),
            }));
            return;
        }

        const winner = this.gapAuction.getWinner(this.currentAuctionId);

        res.writeHead(200);
        res.end(JSON.stringify({
            active: true,
            auctionId: auction.auctionId,
            poolId: auction.poolId,
            phase: auction.phase,
            gapPercent: auction.gapPercent,
            minBid: auction.minBid.toString(),
            commitCount: auction.commits.size,
            revealCount: auction.reveals.size,
            winner: winner ? { bidder: winner.bidder, amount: winner.amount.toString() } : null,
            settledAt: auction.settledAt,
            timestamp: Date.now(),
        }));
    }

    private async handleGapAuctionStart(
        res: http.ServerResponse,
        body: Record<string, unknown>
    ): Promise<void> {
        if (!this.gapAuction) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Gap auction service not available' }));
            return;
        }

        const poolId = (body.poolId as string) || 'pool-demo';
        const gapPercent = Number(body.gapPercent) || 5.0;
        const gapValue = BigInt(body.gapValue as string || '1000000000000000000'); // 1 ETH default

        try {
            this.currentAuctionId = this.gapAuction.startAuction(poolId, gapPercent, gapValue);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                auctionId: this.currentAuctionId,
                phase: 'COMMIT',
                gapPercent,
                message: `Gap auction started. Commit phase: 30 seconds.`,
                timestamp: Date.now(),
            }));
        } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to start auction',
            }));
        }
    }

    private async handleGapAuctionCommit(
        res: http.ServerResponse,
        body: Record<string, unknown>
    ): Promise<void> {
        if (!this.gapAuction || !this.currentAuctionId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No active auction' }));
            return;
        }

        const bidder = body.bidder as string;
        const bidHash = body.bidHash as string;

        if (!bidder || !bidHash) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing bidder or bidHash' }));
            return;
        }

        try {
            this.gapAuction.commitBid(this.currentAuctionId, bidder, bidHash);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                message: 'Bid committed (hidden)',
                auctionId: this.currentAuctionId,
                bidder,
                hashReceived: bidHash.slice(0, 16) + '...',
                timestamp: Date.now(),
            }));
        } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to commit bid',
            }));
        }
    }

    private async handleGapAuctionReveal(
        res: http.ServerResponse,
        body: Record<string, unknown>
    ): Promise<void> {
        if (!this.gapAuction || !this.currentAuctionId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No active auction' }));
            return;
        }

        const bidder = body.bidder as string;
        const amount = BigInt(body.amount as string || '0');
        const salt = body.salt as string;

        if (!bidder || !salt) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Missing bidder, amount, or salt' }));
            return;
        }

        try {
            const valid = this.gapAuction.revealBid(this.currentAuctionId, bidder, amount, salt);

            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                valid,
                message: valid ? 'Bid revealed and validated' : 'Bid reveal failed validation',
                auctionId: this.currentAuctionId,
                bidder,
                amount: amount.toString(),
                timestamp: Date.now(),
            }));
        } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({
                error: error instanceof Error ? error.message : 'Failed to reveal bid',
            }));
        }
    }
}

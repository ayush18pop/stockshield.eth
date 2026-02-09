/**
 * StockShield API Client
 * 
 * Fetches data from the backend API server.
 */

// API Configuration
const DEFAULT_API_BASE_URL =
    process.env.NODE_ENV === 'production'
        ? 'https://stockshield-eth-kmxx.onrender.com'
        : 'http://localhost:3001';
const DEFAULT_WS_URL =
    process.env.NODE_ENV === 'production'
        ? 'wss://stockshield-eth-kmxx.onrender.com/ws'
        : 'ws://localhost:3001/ws';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || DEFAULT_WS_URL;

// ============================================================================
// Types
// ============================================================================

export interface HealthResponse {
    status: string;
    uptime: number;
    services: Record<string, string>;
    timestamp: number;
}

export interface RegimeResponse {
    regime: string;
    multiplier: number;
    baseFee: number;
    maxFee: number;
    riskLevel: string;
    nextTransition: {
        regime: string;
        secondsUntil: number;
    };
    timestamp: number;
}

export interface VPINResponse {
    poolId: string;
    vpin: number;
    bucketCount: number;
    bucketSize: number;
    interpretation: string;
    description: string;
    recommendedAction: string;
    timestamp: number;
}

export interface PriceResponse {
    asset: string;
    price: number;
    priceRaw: string;
    source: string;
    confidence: number;
    timestamp: number;
    fetchedAt: number;
}

export interface FeeResponse {
    poolId: string;
    baseFee: number;
    vpinComponent: number;
    volatilityComponent: number;
    inventoryComponent: number;
    regimeMultiplier: number;
    totalFee: number;
    timestamp: number;
}

export interface PoolInfo {
    poolId: string;
    asset: string;
    liquidity: string;
    vpin: number;
    fee: number;
    regime: string;
}

export interface PoolsResponse {
    pools: PoolInfo[];
    count: number;
    timestamp: number;
}

export interface CircuitBreakerResponse {
    level: number;
    flags: string[];
    actions: string[];
    timestamp: number;
}

export interface AuctionInfo {
    id: string;
    poolId: string;
    phase: 'COMMIT' | 'REVEAL' | 'SETTLED';
    gapPercent: number;
    endTime: number;
}

export interface AuctionsResponse {
    auctions: AuctionInfo[];
    count: number;
    timestamp: number;
}

export interface YellowRuntimeStatus {
    connected: boolean;
    authenticated: boolean;
    channelId: string | null;
}

export interface YellowSession {
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
    txLog?: Array<{
        action: string;
        amount: number;
        timestamp: number;
        vpin: number;
        signature?: string;
        turnNumber?: number;
    }>;
}

export interface YellowStatusResponse {
    runtime: YellowRuntimeStatus;
    session: YellowSession | null;
    autoSession?: {
        enabled: boolean;
        intervalSeconds: number;
        durationSeconds: number;
        allowance: number;
        active: boolean;
        sessionId: string | null;
        channelId: string | null;
        scheduledAt: number | null;
        settlesAt: number | null;
        lastEvent: unknown;
        lastError: string | null;
    };
    timestamp: number;
}

export interface YellowStartSessionRequest {
    wallet: string;
    allowance?: number;
}

export interface YellowSpendRequest {
    amount: number;
    action?: string;
}

export interface YellowSettleRequest {
    onChainChannelId?: string;
}

export interface YellowSettleResponse {
    message: string;
    session: YellowSession;
    runtime: YellowRuntimeStatus;
    settlement?: {
        finalStateHash: string | null;
        closeSignature: string | null;
        totalTxCount: number;
        totalSpent: number;
        gasSaved: string;
    };
    onchain:
    | { ready: true; target: string | null; method: 'closeChannel'; args: [string] }
    | { ready: false; reason: string };
    timestamp: number;
}

// Trade simulation types for Yellow integration
export interface TradeRequest {
    asset: string;
    volume: number;
    isBuy: boolean;
}

export interface TradeResponse {
    trade: {
        asset: string;
        volume: number;
        direction: 'BUY' | 'SELL';
        timestamp: number;
    };
    riskMetrics: {
        vpinBefore: number;
        vpinAfter: number;
        vpinDelta: number;
        regime: string;
        regimeMultiplier: number;
        recommendedFee: number;
        oraclePrice?: number;
    };
    yellow: {
        channelId: string | null;
        signature: string | null;
        broadcasted: boolean;
    };
    timestamp: number;
}

export interface YellowSignTradeRequest {
    poolId: string;
    asset: string;
    amountIn: string;
    zeroForOne: boolean;
    tokenIn: string;
    tokenOut: string;
    hookAddress: string;
    chainId: number;
    gapAuctionBid?: number;
    onChainChannelId?: string;
}

export interface YellowSignTradeResponse {
    hookData: `0x${string}`;
    debug: {
        relayChannelId: string;
        channelId: string;
        poolId: string;
        asset: string;
        amountIn: string;
        zeroForOne: boolean;
        tokenIn: string;
        tokenOut: string;
        hookAddress: string;
        chainId: number;
        vpin: number;
        vpinScaled: number;
        regime: string;
        regimeId: number;
        recommendedFee: number;
        turnNum: number;
        timestamp: number;
        gapAuctionBid: number;
        stateHash: string;
        signature: string;
        signer: string | null;
        autoSettle: {
            enabled: boolean;
            idleSeconds: number;
            minTrades: number;
            activeChannels: number;
            lastEvent: unknown;
            lastError: string | null;
        };
    };
    timestamp: number;
}

// Gap Auction types
export interface GapAuctionStatus {
    active: boolean;
    auctionId?: string;
    poolId?: string;
    phase?: 'COMMIT' | 'REVEAL' | 'SETTLE';
    gapPercent?: number;
    minBid?: string;
    commitCount?: number;
    revealCount?: number;
    winner?: { bidder: string; amount: string } | null;
    settledAt?: number;
    message?: string;
    timestamp: number;
}

export interface GapAuctionStartRequest {
    poolId?: string;
    gapPercent?: number;
    gapValue?: string;
}

export interface GapAuctionCommitRequest {
    bidder: string;
    bidHash: string;
}

export interface GapAuctionRevealRequest {
    bidder: string;
    amount: string;
    salt: string;
}

// ============================================================================
// API Client
// ============================================================================

class StockShieldAPI {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async fetch<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }

    private async post<T>(endpoint: string, payload: object): Promise<T> {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const raw = await response.text();
            throw new Error(`API Error: ${response.status} ${raw || response.statusText}`);
        }
        return response.json();
    }

    /**
     * Health check
     */
    async getHealth(): Promise<HealthResponse> {
        return this.fetch<HealthResponse>('/api/health');
    }

    /**
     * Get current market regime
     */
    async getRegime(): Promise<RegimeResponse> {
        return this.fetch<RegimeResponse>('/api/regime');
    }

    /**
     * Get VPIN score for a pool
     */
    async getVPIN(poolId: string): Promise<VPINResponse> {
        return this.fetch<VPINResponse>(`/api/vpin/${poolId}`);
    }

    /**
     * Get oracle price for an asset
     */
    async getPrice(asset: string): Promise<PriceResponse> {
        return this.fetch<PriceResponse>(`/api/price/${asset}`);
    }

    /**
     * Get dynamic fee for a pool
     */
    async getFees(poolId: string): Promise<FeeResponse> {
        return this.fetch<FeeResponse>(`/api/fees/${poolId}`);
    }

    /**
     * Get all pools
     */
    async getPools(): Promise<PoolsResponse> {
        return this.fetch<PoolsResponse>('/api/pools');
    }

    /**
     * Get pool details
     */
    async getPool(poolId: string): Promise<PoolInfo & { regimeInfo: RegimeResponse }> {
        return this.fetch(`/api/pools/${poolId}`);
    }

    /**
     * Get circuit breaker status
     */
    async getCircuitBreaker(): Promise<CircuitBreakerResponse> {
        return this.fetch<CircuitBreakerResponse>('/api/circuit-breaker');
    }

    /**
     * Get active auctions
     */
    async getActiveAuctions(): Promise<AuctionsResponse> {
        return this.fetch<AuctionsResponse>('/api/auctions/active');
    }

    /**
     * Submit a trade simulation - triggers VPIN update and Yellow broadcast
     */
    async submitTrade(trade: TradeRequest): Promise<TradeResponse> {
        return this.post<TradeResponse>('/api/trade', trade);
    }

    /**
     * Request Yellow-signed hookData for a live swap
     */
    async signTradeState(payload: YellowSignTradeRequest): Promise<YellowSignTradeResponse> {
        return this.post<YellowSignTradeResponse>('/api/yellow/sign-trade', payload);
    }

    /**
     * Alias for submitTrade (used by swap page)
     */
    async simulateTrade(trade: TradeRequest): Promise<TradeResponse> {
        return this.submitTrade(trade);
    }

    /**
     * Get Yellow runtime + session state
     */
    async getYellowStatus(): Promise<YellowStatusResponse> {
        return this.fetch<YellowStatusResponse>('/api/yellow/status');
    }

    /**
     * Start an off-chain Yellow demo session
     */
    async startYellowSession(payload: YellowStartSessionRequest): Promise<YellowStatusResponse> {
        return this.post<YellowStatusResponse>('/api/yellow/session/start', payload);
    }

    /**
     * Spend from the active off-chain Yellow demo session
     */
    async spendYellowSession(payload: YellowSpendRequest): Promise<YellowStatusResponse> {
        return this.post<YellowStatusResponse>('/api/yellow/session/spend', payload);
    }

    /**
     * Finalize off-chain session and prepare on-chain settlement call
     */
    async settleYellowSession(payload: YellowSettleRequest): Promise<YellowSettleResponse> {
        return this.post<YellowSettleResponse>('/api/yellow/session/settle', payload);
    }

    // ========================================================================
    // Gap Auction API
    // ========================================================================

    /**
     * Get current gap auction status
     */
    async getGapAuctionStatus(): Promise<GapAuctionStatus> {
        return this.fetch<GapAuctionStatus>('/api/gap-auction/status');
    }

    /**
     * Start a new gap auction (for demo/testing)
     */
    async startGapAuction(payload: GapAuctionStartRequest): Promise<GapAuctionStatus> {
        return this.post<GapAuctionStatus>('/api/gap-auction/start', payload);
    }

    /**
     * Submit a hidden bid (commit phase)
     */
    async commitGapAuctionBid(payload: GapAuctionCommitRequest): Promise<{ success: boolean; message: string; timestamp: number }> {
        return this.post('/api/gap-auction/commit', payload);
    }

    /**
     * Reveal bid (reveal phase)
     */
    async revealGapAuctionBid(payload: GapAuctionRevealRequest): Promise<{ success: boolean; valid: boolean; message: string; timestamp: number }> {
        return this.post('/api/gap-auction/reveal', payload);
    }
}

// Export singleton instance
export const api = new StockShieldAPI();

// Export WebSocket URL for hooks
export { WS_URL };

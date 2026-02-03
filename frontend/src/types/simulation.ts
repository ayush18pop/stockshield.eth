export type Regime =
    | 'CORE'
    | 'SOFT_OPEN'
    | 'PRE_MARKET'
    | 'AFTER_HOURS'
    | 'OVERNIGHT'
    | 'WEEKEND'
    | 'HOLIDAY';

export interface Trade {
    timestamp: Date;
    direction: 'BUY' | 'SELL';
    amount: number;
    price: number;
    feesPaid: number;
    traderType: 'ARBITRAGEUR' | 'NOISE' | 'INFORMED';
    blocked?: boolean;
    blockReason?: string;
}

export interface SimEvent {
    timestamp: Date;
    type: 'REGIME_CHANGE' | 'NEWS' | 'ORACLE_UPDATE' | 'CIRCUIT_BREAKER' | 'GAP_AUCTION' | 'TRADE';
    description: string;
    severity: 'INFO' | 'WARNING' | 'DANGER';
}

export interface PoolState {
    token0Reserve: number;
    token1Reserve: number;
    poolPrice: number;
    inventoryImbalance: number; // -1 to +1
}

export interface ProtectionState {
    currentRegime: Regime;
    dynamicFee: number;        // basis points
    volatility: number;
    vpin: number;              // 0 to 1
    circuitBreakerLevel: 0 | 1 | 2 | 3 | 4;
    inGapAuction: boolean;
    gapAuctionEndTime?: Date;
}

export interface VisualDrivers {
    turbulence: number;   // Driven by Volatility (0-1)
    density: number;      // Driven by VPIN (0-1)
    glitchFactor: number; // Driven by Circuit Breaker (0-1)
    colorShift: number;   // Driven by Regime (0-1)
}

export interface SimulationState {
    // Time
    simulatedTime: Date;
    elapsedSeconds: number;
    speed: 1 | 5 | 10 | 60;
    isPaused: boolean;

    // Market
    oraclePrice: number;
    lastOracleUpdate: Date;

    // Pool State
    poolState: PoolState;

    // Protection State (StockShield only)
    protectionState: ProtectionState;

    // Visual Drivers
    visuals: VisualDrivers;

    // Tracking
    lpPnL: number;
    feesCollected: number;
    tradesExecuted: Trade[];
    events: SimEvent[];
}

/**
 * Yellow Network Types for StockShield
 */

// ============================================================================
// Certificate Types
// ============================================================================

/**
 * Signed certificate from Yellow ClearNode for on-chain verification
 */
export interface Certificate {
    poolId: string;
    bidder: string;
    bidAmount: bigint;
    swapParams?: SwapParams;
    validAfterBlock: bigint;
    validUntilBlock: bigint;
    nonce: bigint;
    signature: string;
}

// ============================================================================
// Swap & Quote Types  
// ============================================================================

export interface SwapParams {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    minAmountOut: bigint;
    recipient: string;
}

export interface Quote {
    quoteId: string;
    solver: string;
    bidAmount: bigint;
    expectedOutput: bigint;
    expiresAtBlock: bigint;
}

// ============================================================================
// Auction Types
// ============================================================================

export enum AuctionPhase {
    IDLE = 'IDLE',
    COMMIT = 'COMMIT',
    REVEAL = 'REVEAL',
    SETTLE = 'SETTLE',
}

export interface GapAuctionState {
    auctionId: string;
    poolId: string;
    phase: AuctionPhase;
    gapPercent: number;
    minBid: bigint;
    decayStartTime: number;
    commits: Map<string, string>; // bidder -> bidHash
    reveals: Map<string, Bid>;    // bidder -> revealed bid
    winner?: string;
    settledAt?: number;
}

export interface Bid {
    bidder: string;
    amount: bigint;
    salt: string;
    timestamp: number;
}

// ============================================================================
// Channel Types
// ============================================================================

export interface ChannelInfo {
    channelId: string;
    participant: string;
    counterparty: string;
    balance: bigint;
    status: ChannelStatus;
}

export enum ChannelStatus {
    OPEN = 'OPEN',
    FUNDED = 'FUNDED',
    CLOSING = 'CLOSING',
    CLOSED = 'CLOSED',
}

// ============================================================================
// Message Types
// ============================================================================

export type YellowMessageType =
    | 'auth_challenge'
    | 'auth_request'
    | 'auth_verify'
    | 'auth_success'
    | 'session_created'
    | 'create_channel'
    | 'resize_channel'
    | 'close_channel'
    | 'payment'
    | 'session_message'
    | 'error';

export interface YellowMessage {
    type: YellowMessageType;
    data?: unknown;
    error?: string;
    sessionId?: string;
    channelId?: string;
}

// ============================================================================
// Client Config
// ============================================================================

export interface YellowClientConfig {
    wsUrl: string;
    privateKey: string;
    rpcUrl: string;
    chainId: number;
    addresses: {
        custody: `0x${string}`;
        adjudicator: `0x${string}`;
        token: `0x${string}`;
    };
}

// Default Sepolia configuration
export const SEPOLIA_CONFIG = {
    chainId: 11155111,
    addresses: {
        custody: '0x019B65A265EB3363822f2752141b3dF16131b262' as `0x${string}`,
        adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2' as `0x${string}`,
        token: '0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb' as `0x${string}`, // ytest.usd (Corrected from sandbox logs)
    },
    wsUrl: 'wss://clearnet-sandbox.yellow.com/ws',
} as const;

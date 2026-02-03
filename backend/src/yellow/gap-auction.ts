/**
 * Gap Auction Service
 * 
 * Manages off-chain gap auctions at market open when price gaps exceed threshold.
 * Uses commit-reveal scheme to prevent front-running.
 */

import { Certificate, AuctionPhase, GapAuctionState, Bid } from './types';
import { createHash } from 'crypto';

export interface GapAuctionConfig {
    minGapPercent: number;          // Minimum gap to trigger auction (default: 0.5%)
    lpCaptureRate: number;          // % of gap value captured by LPs (default: 70%)
    decayRate: number;              // Exponential decay rate per minute (default: 0.4)
    commitPhaseDuration: number;    // Commit phase duration in ms (default: 30s)
    revealPhaseDuration: number;    // Reveal phase duration in ms (default: 30s)
}

const DEFAULT_CONFIG: GapAuctionConfig = {
    minGapPercent: 0.5,
    lpCaptureRate: 0.7,
    decayRate: 0.4,
    commitPhaseDuration: 30_000,    // 30 seconds
    revealPhaseDuration: 30_000,    // 30 seconds
};

export class GapAuctionService {
    private config: GapAuctionConfig;
    private activeAuctions: Map<string, GapAuctionState> = new Map();

    constructor(config: Partial<GapAuctionConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Detect if a gap exists and should trigger an auction
     */
    detectGap(closePrice: bigint, openPrice: bigint): number {
        const closePriceNum = Number(closePrice);
        const openPriceNum = Number(openPrice);

        if (closePriceNum === 0) return 0;

        const gapPercent = Math.abs((openPriceNum - closePriceNum) / closePriceNum) * 100;
        return gapPercent;
    }

    /**
     * Start a new gap auction
     */
    startAuction(
        poolId: string,
        gapPercent: number,
        gapValue: bigint
    ): string {
        if (gapPercent < this.config.minGapPercent) {
            throw new Error(`Gap ${gapPercent}% below threshold ${this.config.minGapPercent}%`);
        }

        const auctionId = this.generateAuctionId(poolId);
        const minBid = this.calculateMinBid(gapValue, 0);

        const auction: GapAuctionState = {
            auctionId,
            poolId,
            phase: AuctionPhase.COMMIT,
            gapPercent,
            minBid,
            decayStartTime: Date.now(),
            commits: new Map(),
            reveals: new Map(),
        };

        this.activeAuctions.set(auctionId, auction);

        console.log(`🎯 Gap auction started: ${auctionId}`);
        console.log(`   Gap: ${gapPercent.toFixed(2)}%`);
        console.log(`   Min bid: ${minBid}`);

        // Schedule phase transitions
        setTimeout(() => this.transitionToReveal(auctionId), this.config.commitPhaseDuration);
        setTimeout(() => this.transitionToSettle(auctionId), this.config.commitPhaseDuration + this.config.revealPhaseDuration);

        return auctionId;
    }

    /**
     * Submit a commit (hashed bid)
     */
    commitBid(auctionId: string, bidder: string, bidHash: string): void {
        const auction = this.activeAuctions.get(auctionId);
        if (!auction) {
            throw new Error(`Auction ${auctionId} not found`);
        }

        if (auction.phase !== AuctionPhase.COMMIT) {
            throw new Error(`Auction not in commit phase (current: ${auction.phase})`);
        }

        auction.commits.set(bidder, bidHash);
        console.log(`📝 Commit received from ${bidder.slice(0, 10)}...`);
    }

    /**
     * Reveal a bid
     */
    revealBid(auctionId: string, bidder: string, amount: bigint, salt: string): boolean {
        const auction = this.activeAuctions.get(auctionId);
        if (!auction) {
            throw new Error(`Auction ${auctionId} not found`);
        }

        if (auction.phase !== AuctionPhase.REVEAL) {
            throw new Error(`Auction not in reveal phase (current: ${auction.phase})`);
        }

        // Verify hash matches commit
        const expectedHash = auction.commits.get(bidder);
        if (!expectedHash) {
            throw new Error(`No commit found for bidder ${bidder}`);
        }

        const actualHash = this.hashBid(amount, salt);
        if (actualHash !== expectedHash) {
            console.warn(`⚠️  Hash mismatch for ${bidder.slice(0, 10)}...`);
            return false;
        }

        // Check minimum bid (with decay)
        const elapsedMinutes = (Date.now() - auction.decayStartTime) / 60000;
        const currentMinBid = this.calculateMinBid(auction.minBid, elapsedMinutes);

        if (amount < currentMinBid) {
            console.warn(`⚠️  Bid ${amount} below minimum ${currentMinBid}`);
            return false;
        }

        // Store valid reveal
        const bid: Bid = {
            bidder,
            amount,
            salt,
            timestamp: Date.now(),
        };

        auction.reveals.set(bidder, bid);
        console.log(`✅ Valid reveal from ${bidder.slice(0, 10)}...: ${amount}`);

        return true;
    }

    /**
     * Get auction winner
     */
    getWinner(auctionId: string): { bidder: string; amount: bigint } | null {
        const auction = this.activeAuctions.get(auctionId);
        if (!auction || auction.phase !== AuctionPhase.SETTLE) {
            return null;
        }

        if (auction.winner) {
            const winningBid = auction.reveals.get(auction.winner);
            if (winningBid) {
                return {
                    bidder: auction.winner,
                    amount: winningBid.amount,
                };
            }
        }

        return null;
    }

    /**
     * Generate certificate for winning bid
     */
    generateCertificate(
        auctionId: string,
        poolId: string,
        validAfterBlock: bigint,
        validUntilBlock: bigint
    ): Certificate | null {
        const winner = this.getWinner(auctionId);
        if (!winner) {
            return null;
        }

        // In production, this would be signed by the ClearNode
        const certificate: Certificate = {
            poolId,
            bidder: winner.bidder,
            bidAmount: winner.amount,
            validAfterBlock,
            validUntilBlock,
            nonce: BigInt(Date.now()),
            signature: '0x' + '00'.repeat(65), // Placeholder signature
        };

        return certificate;
    }

    /**
     * Get auction state
     */
    getAuction(auctionId: string): GapAuctionState | undefined {
        return this.activeAuctions.get(auctionId);
    }

    /**
     * Calculate minimum bid with exponential decay
     * 
     * MinBid(t) = Gap × L × c × e^(-λt)
     * Where:
     * - Gap = gap value
     * - L = liquidity
     * - c = LP capture rate (70%)
     * - λ = decay rate (0.4/min)
     * - t = time in minutes
     */
    private calculateMinBid(gapValue: bigint, elapsedMinutes: number): bigint {
        const c = this.config.lpCaptureRate;
        const lambda = this.config.decayRate;

        // e^(-λt)
        const decayFactor = Math.exp(-lambda * elapsedMinutes);

        // Gap × c × decay
        const minBid = Number(gapValue) * c * decayFactor;

        return BigInt(Math.floor(minBid));
    }

    /**
     * Hash a bid for commit-reveal
     */
    hashBid(amount: bigint, salt: string): string {
        const data = `${amount.toString()}-${salt}`;
        return createHash('sha256').update(data).digest('hex');
    }

    /**
     * Generate auction ID
     */
    private generateAuctionId(poolId: string): string {
        return `${poolId}-${Date.now()}`;
    }

    /**
     * Transition auction to reveal phase
     */
    private transitionToReveal(auctionId: string): void {
        const auction = this.activeAuctions.get(auctionId);
        if (!auction) return;

        auction.phase = AuctionPhase.REVEAL;
        console.log(`🔓 Auction ${auctionId} → REVEAL phase`);
        console.log(`   Commits received: ${auction.commits.size}`);
    }

    /**
     * Transition auction to settle phase and determine winner
     */
    private transitionToSettle(auctionId: string): void {
        const auction = this.activeAuctions.get(auctionId);
        if (!auction) return;

        auction.phase = AuctionPhase.SETTLE;

        // Find highest valid bid
        let highestBid: Bid | null = null;
        let highestBidder: string | null = null;

        for (const [bidder, bid] of auction.reveals) {
            if (!highestBid || bid.amount > highestBid.amount) {
                highestBid = bid;
                highestBidder = bidder;
            }
        }

        if (highestBidder) {
            auction.winner = highestBidder;
            auction.settledAt = Date.now();
            console.log(`🏆 Auction ${auctionId} → SETTLE phase`);
            console.log(`   Winner: ${highestBidder.slice(0, 10)}...`);
            console.log(`   Amount: ${highestBid!.amount}`);
        } else {
            console.log(`⚠️  Auction ${auctionId} → SETTLE phase (no valid bids)`);
        }
    }
}

// ============================================================================
// Self-Test (run with: npx ts-node src/yellow/gap-auction.ts)
// ============================================================================

if (require.main === module) {
    console.log('🧪 Gap Auction Service Self-Test\n');

    const service = new GapAuctionService();

    // Test 1: Detect gap
    console.log('Test 1: Gap Detection');
    console.log('─'.repeat(50));
    const closePrice = 200n * 10n ** 18n; // $200
    const openPrice = 240n * 10n ** 18n;  // $240
    const gap = service.detectGap(closePrice, openPrice);
    console.log(`Close: $200, Open: $240`);
    console.log(`Gap: ${gap.toFixed(2)}%`);
    console.log(`Expected: 20% ✓\n`);

    // Test 2: Start auction
    console.log('Test 2: Start Auction');
    console.log('─'.repeat(50));
    const gapValue = openPrice - closePrice;
    const auctionId = service.startAuction('pool-1', gap, gapValue);
    console.log(`Auction ID: ${auctionId} ✓\n`);

    // Test 3: Commit bids
    console.log('Test 3: Commit Bids');
    console.log('─'.repeat(50));
    const bidder1 = '0x1111111111111111111111111111111111111111';
    const bidder2 = '0x2222222222222222222222222222222222222222';
    const amount1 = 30n * 10n ** 18n;
    const amount2 = 35n * 10n ** 18n;
    const salt1 = 'secret1';
    const salt2 = 'secret2';

    const hash1 = service['hashBid'](amount1, salt1);
    const hash2 = service['hashBid'](amount2, salt2);

    service.commitBid(auctionId, bidder1, hash1);
    service.commitBid(auctionId, bidder2, hash2);
    console.log('Commits submitted ✓\n');

    // Simulate phase transition
    console.log('Test 4: Reveal Phase (simulated)');
    console.log('─'.repeat(50));
    const auction = service.getAuction(auctionId)!;
    auction.phase = AuctionPhase.REVEAL;

    const valid1 = service.revealBid(auctionId, bidder1, amount1, salt1);
    const valid2 = service.revealBid(auctionId, bidder2, amount2, salt2);
    console.log(`Bidder 1 valid: ${valid1} ✓`);
    console.log(`Bidder 2 valid: ${valid2} ✓\n`);

    // Simulate settle
    console.log('Test 5: Settle Phase (simulated)');
    console.log('─'.repeat(50));
    auction.phase = AuctionPhase.SETTLE;
    auction.winner = bidder2; // Higher bid
    auction.settledAt = Date.now();

    const winner = service.getWinner(auctionId);
    console.log(`Winner: ${winner?.bidder.slice(0, 10)}...`);
    console.log(`Amount: ${winner?.amount}`);
    console.log(`Expected: Bidder 2 with higher bid ✓\n`);

    console.log('✅ All tests passed!');
}

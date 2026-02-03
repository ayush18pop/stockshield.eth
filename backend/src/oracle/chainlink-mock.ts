/**
 * Chainlink Oracle Mock
 * 
 * Mock Chainlink price feeds for hackathon demo.
 * Simulates realistic latency (~20s) and returns prices similar to Pyth.
 */

export interface ChainlinkPrice {
    price: bigint;
    timestamp: number;
    roundId: bigint;
    answeredInRound: bigint;
}

export interface ChainlinkConfig {
    latencyMs: number;      // Simulated latency (default: 20000 = 20s)
    priceFeeds: Record<string, string>; // asset -> feed address (mock)
}

const DEFAULT_CONFIG: ChainlinkConfig = {
    latencyMs: 20000,       // 20 second latency
    priceFeeds: {
        'AAPL': '0x0000000000000000000000000000000000000001',
        'TSLA': '0x0000000000000000000000000000000000000002',
        'ETH': '0x0000000000000000000000000000000000000003',
    },
};

export class ChainlinkMock {
    private config: ChainlinkConfig;
    private lastPrices: Map<string, ChainlinkPrice> = new Map();
    private roundIds: Map<string, bigint> = new Map();

    constructor(config: Partial<ChainlinkConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Get latest price for an asset (with simulated latency)
     */
    async getPrice(asset: string): Promise<ChainlinkPrice | null> {
        const feedAddress = this.config.priceFeeds[asset];
        if (!feedAddress) {
            console.warn(`⚠️  No Chainlink feed for asset: ${asset}`);
            return null;
        }

        // Simulate network latency
        await this.sleep(this.config.latencyMs);

        // Get or create mock price
        let price = this.lastPrices.get(asset);
        if (!price) {
            price = this.generateMockPrice(asset);
            this.lastPrices.set(asset, price);
        }

        // Update round ID
        const currentRound = this.roundIds.get(asset) || 0n;
        const newRound = currentRound + 1n;
        this.roundIds.set(asset, newRound);

        return {
            ...price,
            roundId: newRound,
            answeredInRound: newRound,
            timestamp: Date.now() / 1000,
        };
    }

    /**
     * Set mock price for an asset
     */
    setMockPrice(asset: string, price: bigint): void {
        this.lastPrices.set(asset, {
            price,
            timestamp: Date.now() / 1000,
            roundId: this.roundIds.get(asset) || 0n,
            answeredInRound: this.roundIds.get(asset) || 0n,
        });
    }

    /**
     * Generate realistic mock price
     */
    private generateMockPrice(asset: string): ChainlinkPrice {
        // Default prices (8 decimals, Chainlink standard)
        const basePrices: Record<string, bigint> = {
            'AAPL': 20000000000n,  // $200.00
            'TSLA': 25000000000n,  // $250.00
            'ETH': 300000000000n,  // $3000.00
        };

        const basePrice = basePrices[asset] || 100000000000n; // $1000 default

        // Add small random variation (±0.5%)
        const variation = (Math.random() - 0.5) * 0.01;
        const price = BigInt(Math.floor(Number(basePrice) * (1 + variation)));

        return {
            price,
            timestamp: Date.now() / 1000,
            roundId: 1n,
            answeredInRound: 1n,
        };
    }

    /**
     * Convert Chainlink price (8 decimals) to standard format (18 decimals)
     */
    normalizePrice(chainlinkPrice: ChainlinkPrice): bigint {
        // Chainlink uses 8 decimals, convert to 18
        return chainlinkPrice.price * BigInt(10 ** 10);
    }

    /**
     * Check if price is fresh
     */
    isFresh(chainlinkPrice: ChainlinkPrice, maxAgeSeconds: number = 60): boolean {
        const now = Date.now() / 1000;
        return (now - chainlinkPrice.timestamp) < maxAgeSeconds;
    }

    /**
     * Add custom price feed
     */
    addPriceFeed(asset: string, feedAddress: string): void {
        this.config.priceFeeds[asset] = feedAddress;
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
// Self-Test (run with: npx ts-node src/oracle/chainlink-mock.ts)
// ============================================================================

if (require.main === module) {
    console.log('🧪 Chainlink Mock Self-Test\n');

    (async () => {
        const mock = new ChainlinkMock({ latencyMs: 100 }); // Fast for testing

        console.log('Test 1: Fetch Mock Price');
        console.log('─'.repeat(50));

        const start = Date.now();
        const ethPrice = await mock.getPrice('ETH');
        const elapsed = Date.now() - start;

        if (ethPrice) {
            const normalized = mock.normalizePrice(ethPrice);
            const fresh = mock.isFresh(ethPrice);

            console.log(`Price: ${ethPrice.price} (8 decimals)`);
            console.log(`Normalized: ${normalized} (18 decimals)`);
            console.log(`Fresh: ${fresh ? '✓' : '✗'}`);
            console.log(`Latency: ${elapsed}ms`);
            console.log(`Round ID: ${ethPrice.roundId}`);
        } else {
            console.log('❌ Failed to fetch price');
        }

        console.log('\n✅ Test completed!');
    })().catch(console.error);
}

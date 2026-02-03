/**
 * Pyth Network Price Feed Client
 * 
 * Fetches real-time prices for tokenized securities from Pyth Network.
 * Pyth provides sub-second price updates with confidence intervals.
 */

import { PriceServiceConnection } from '@pythnetwork/price-service-client';

export interface PythPrice {
    price: bigint;
    confidence: bigint;
    expo: number;
    timestamp: number;
    publishTime: number;
}

export interface PythConfig {
    endpoint: string;
    priceIds: Record<string, string>; // asset -> price feed ID
}

const DEFAULT_CONFIG: PythConfig = {
    endpoint: 'https://hermes.pyth.network',
    priceIds: {
        // Pyth price feed IDs for tokenized securities
        // These are examples - replace with actual feed IDs
        'AAPL': '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688', // Apple
        'TSLA': '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1', // Tesla
        'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',  // ETH/USD for testing
    },
};

export class PythClient {
    private connection: PriceServiceConnection;
    private config: PythConfig;

    constructor(config: Partial<PythConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.connection = new PriceServiceConnection(this.config.endpoint, {
            priceFeedRequestConfig: {
                binary: false,
            },
        });
    }

    /**
     * Get current price for an asset
     */
    async getPrice(asset: string): Promise<PythPrice | null> {
        const priceId = this.config.priceIds[asset];
        if (!priceId) {
            console.warn(`⚠️  No Pyth price feed ID for asset: ${asset}`);
            return null;
        }

        try {
            const priceFeeds = await this.connection.getLatestPriceFeeds([priceId]);

            if (!priceFeeds || priceFeeds.length === 0) {
                console.warn(`⚠️  No price feed data for ${asset}`);
                return null;
            }

            const priceFeed = priceFeeds[0];
            const priceData = priceFeed.getPriceUnchecked();

            return {
                price: BigInt(priceData.price),
                confidence: BigInt(priceData.conf),
                expo: priceData.expo,
                timestamp: Date.now() / 1000,
                publishTime: priceData.publishTime,
            };
        } catch (error) {
            console.error(`❌ Failed to fetch Pyth price for ${asset}:`, error);
            return null;
        }
    }

    /**
     * Get prices for multiple assets
     */
    async getPrices(assets: string[]): Promise<Map<string, PythPrice>> {
        const priceIds = assets
            .map(asset => this.config.priceIds[asset])
            .filter(id => id !== undefined);

        if (priceIds.length === 0) {
            return new Map();
        }

        try {
            const priceFeeds = await this.connection.getLatestPriceFeeds(priceIds);
            const prices = new Map<string, PythPrice>();

            for (let i = 0; i < assets.length; i++) {
                const asset = assets[i];
                const priceFeed = priceFeeds[i];

                if (priceFeed) {
                    const priceData = priceFeed.getPriceUnchecked();
                    prices.set(asset, {
                        price: BigInt(priceData.price),
                        confidence: BigInt(priceData.conf),
                        expo: priceData.expo,
                        timestamp: Date.now() / 1000,
                        publishTime: priceData.publishTime,
                    });
                }
            }

            return prices;
        } catch (error) {
            console.error('❌ Failed to fetch Pyth prices:', error);
            return new Map();
        }
    }

    /**
     * Convert Pyth price to standard format (18 decimals)
     */
    normalizePrice(pythPrice: PythPrice): bigint {
        // Pyth prices come with an exponent (usually negative)
        // Convert to 18 decimal format
        const price = pythPrice.price;
        const expo = pythPrice.expo;

        if (expo >= 0) {
            return price * BigInt(10 ** (18 + expo));
        } else {
            const divisor = BigInt(10 ** Math.abs(expo));
            const multiplier = BigInt(10 ** 18);
            return (price * multiplier) / divisor;
        }
    }

    /**
     * Check if price is fresh (published within last N seconds)
     */
    isFresh(pythPrice: PythPrice, maxAgeSeconds: number = 60): boolean {
        const now = Date.now() / 1000;
        return (now - pythPrice.publishTime) < maxAgeSeconds;
    }

    /**
     * Get confidence as percentage (0-100)
     */
    getConfidencePercent(pythPrice: PythPrice): number {
        if (pythPrice.price === 0n) return 0;

        const confidenceRatio = Number(pythPrice.confidence) / Number(pythPrice.price);
        return Math.max(0, Math.min(100, (1 - confidenceRatio) * 100));
    }

    /**
     * Add custom price feed ID
     */
    addPriceFeed(asset: string, priceId: string): void {
        this.config.priceIds[asset] = priceId;
    }
}

// ============================================================================
// Self-Test (run with: npx ts-node src/oracle/pyth-client.ts)
// ============================================================================

if (require.main === module) {
    console.log('🧪 Pyth Client Self-Test\n');

    (async () => {
        const client = new PythClient();

        console.log('Test 1: Fetch ETH/USD Price');
        console.log('─'.repeat(50));

        const ethPrice = await client.getPrice('ETH');
        if (ethPrice) {
            const normalized = client.normalizePrice(ethPrice);
            const confidence = client.getConfidencePercent(ethPrice);
            const fresh = client.isFresh(ethPrice);

            console.log(`Price: ${ethPrice.price} (expo: ${ethPrice.expo})`);
            console.log(`Normalized: ${normalized} (18 decimals)`);
            console.log(`Confidence: ${confidence.toFixed(2)}%`);
            console.log(`Fresh: ${fresh ? '✓' : '✗'}`);
            console.log(`Publish time: ${new Date(ethPrice.publishTime * 1000).toISOString()}`);
        } else {
            console.log('❌ Failed to fetch price');
        }

        console.log('\n✅ Test completed!');
    })().catch(console.error);
}

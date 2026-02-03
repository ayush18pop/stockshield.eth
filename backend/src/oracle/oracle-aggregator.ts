/**
 * Oracle Aggregator Service
 * 
 * Aggregates prices from multiple sources (Pyth, Chainlink, TWAP) and provides
 * consensus pricing with confidence scoring and staleness detection.
 */

import { PythClient, PythPrice } from './pyth-client';
import { ChainlinkMock, ChainlinkPrice } from './chainlink-mock';
import { TWAPCalculator } from './twap-calculator';

export interface OraclePrice {
    price: bigint;
    timestamp: number;
    source: 'chainlink' | 'pyth' | 'twap' | 'consensus';
    confidence: number; // 0-1
}

export interface OracleConfig {
    stalenessThreshold: number;  // Max age in seconds (default: 60)
    minSources: number;           // Minimum sources for consensus (default: 2)
    deviationThreshold: number;   // Max deviation for high confidence (default: 0.01 = 1%)
}

const DEFAULT_CONFIG: OracleConfig = {
    stalenessThreshold: 60,
    minSources: 2,
    deviationThreshold: 0.01,
};

export class OracleAggregator {
    private config: OracleConfig;
    private pythClient: PythClient;
    private chainlinkMock: ChainlinkMock;
    private twapCalc: TWAPCalculator;

    constructor(
        pythClient: PythClient,
        chainlinkMock: ChainlinkMock,
        twapCalc: TWAPCalculator,
        config: Partial<OracleConfig> = {}
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.pythClient = pythClient;
        this.chainlinkMock = chainlinkMock;
        this.twapCalc = twapCalc;
    }

    /**
     * Get consensus price from all sources
     */
    async getConsensusPrice(asset: string, poolId?: string): Promise<OraclePrice> {
        // Fetch from all sources in parallel
        const [pythPrice, chainlinkPrice, twapPrice] = await Promise.all([
            this.getPythPrice(asset),
            this.getChainlinkPrice(asset),
            this.getTWAPPrice(poolId || asset),
        ]);

        // Collect fresh prices
        const freshPrices: OraclePrice[] = [];

        if (pythPrice && this.isFresh(pythPrice.timestamp)) {
            freshPrices.push(pythPrice);
        }

        if (chainlinkPrice && this.isFresh(chainlinkPrice.timestamp)) {
            freshPrices.push(chainlinkPrice);
        }

        if (twapPrice && this.isFresh(twapPrice.timestamp)) {
            freshPrices.push(twapPrice);
        }

        // If no fresh prices, use TWAP with low confidence
        if (freshPrices.length === 0) {
            console.warn(`⚠️  No fresh prices for ${asset}, using TWAP fallback`);
            return twapPrice || {
                price: 0n,
                timestamp: Date.now() / 1000,
                source: 'twap' as const,
                confidence: 0.3,
            };
        }

        // If only one source, return it with medium confidence
        if (freshPrices.length === 1) {
            return { ...freshPrices[0]!, confidence: 0.6 };
        }

        // Calculate median and confidence
        return this.calculateConsensus(freshPrices);
    }

    /**
     * Get price from Pyth Network
     */
    private async getPythPrice(asset: string): Promise<OraclePrice | null> {
        try {
            const pythPrice = await this.pythClient.getPrice(asset);
            if (!pythPrice) return null;

            const normalized = this.pythClient.normalizePrice(pythPrice);
            const confidence = this.pythClient.getConfidencePercent(pythPrice) / 100;

            return {
                price: normalized,
                timestamp: pythPrice.publishTime,
                source: 'pyth',
                confidence,
            };
        } catch (error) {
            console.error(`Failed to fetch Pyth price for ${asset}:`, error);
            return null;
        }
    }

    /**
     * Get price from Chainlink (mock)
     */
    private async getChainlinkPrice(asset: string): Promise<OraclePrice | null> {
        try {
            const clPrice = await this.chainlinkMock.getPrice(asset);
            if (!clPrice) return null;

            const normalized = this.chainlinkMock.normalizePrice(clPrice);

            return {
                price: normalized,
                timestamp: clPrice.timestamp,
                source: 'chainlink',
                confidence: 0.9, // Mock has high confidence
            };
        } catch (error) {
            console.error(`Failed to fetch Chainlink price for ${asset}:`, error);
            return null;
        }
    }

    /**
     * Get TWAP price
     */
    private getTWAPPrice(poolId: string): OraclePrice | null {
        const twap = this.twapCalc.getTWAP(poolId);
        if (!twap) return null;

        const age = this.twapCalc.getTWAPAge(poolId);
        const obsCount = this.twapCalc.getObservationCount(poolId);

        // Confidence based on observation count and age
        let confidence = 0.7;
        if (obsCount < 5) confidence = 0.5;
        if (age > 300) confidence *= 0.8; // Reduce if >5 min old

        return {
            price: twap,
            timestamp: Date.now() / 1000 - age,
            source: 'twap',
            confidence,
        };
    }

    /**
     * Calculate consensus from multiple prices
     */
    private calculateConsensus(prices: OraclePrice[]): OraclePrice {
        // Sort by price
        const sorted = [...prices].sort((a, b) =>
            Number(a.price - b.price)
        );

        // Get median
        const median = sorted[Math.floor(sorted.length / 2)];
        if (!median) {
            throw new Error('Failed to calculate median price');
        }

        // Calculate deviation
        const deviation = this.calculateMaxDeviation(prices);

        // Confidence based on deviation and number of sources
        let confidence = 1.0;
        if (deviation > this.config.deviationThreshold) {
            confidence = 0.8;
        }
        if (deviation > 0.05) { // >5%
            confidence = 0.5;
        }
        if (prices.length < this.config.minSources) {
            confidence *= 0.8;
        }

        return {
            price: median.price,
            timestamp: Date.now() / 1000,
            source: 'consensus',
            confidence,
        };
    }

    /**
     * Calculate maximum deviation between prices
     */
    private calculateMaxDeviation(prices: OraclePrice[]): number {
        if (prices.length < 2) return 0;

        const priceValues = prices.map(p => Number(p.price));
        const min = Math.min(...priceValues);
        const max = Math.max(...priceValues);

        return (max - min) / min;
    }

    /**
     * Check if price is fresh
     */
    private isFresh(timestamp: number): boolean {
        const now = Date.now() / 1000;
        return (now - timestamp) < this.config.stalenessThreshold;
    }

    /**
     * Get price deviation between two prices
     */
    getPriceDeviation(price1: bigint, price2: bigint): number {
        const p1 = Number(price1);
        const p2 = Number(price2);

        if (p1 === 0) return Infinity;

        return Math.abs(p2 - p1) / p1;
    }

    /**
     * Check if a timestamp is stale
     */
    isStale(timestamp: number): boolean {
        return !this.isFresh(timestamp);
    }

    /**
     * Get all prices (for debugging)
     */
    async getAllPrices(asset: string, poolId?: string): Promise<{
        pyth: OraclePrice | null;
        chainlink: OraclePrice | null;
        twap: OraclePrice | null;
        consensus: OraclePrice;
    }> {
        const [pyth, chainlink, twap] = await Promise.all([
            this.getPythPrice(asset),
            this.getChainlinkPrice(asset),
            this.getTWAPPrice(poolId || asset),
        ]);

        const consensus = await this.getConsensusPrice(asset, poolId);

        return { pyth, chainlink, twap, consensus };
    }
}

// ============================================================================
// Self-Test (run with: npx ts-node src/oracle/oracle-aggregator.ts)
// ============================================================================

if (require.main === module) {
    console.log('🧪 Oracle Aggregator Self-Test\n');

    (async () => {
        const pythClient = new PythClient();
        const chainlinkMock = new ChainlinkMock({ latencyMs: 100 });
        const twapCalc = new TWAPCalculator();

        const aggregator = new OracleAggregator(
            pythClient,
            chainlinkMock,
            twapCalc
        );

        console.log('Test 1: Get Consensus Price for ETH');
        console.log('─'.repeat(50));

        // Add some TWAP observations
        twapCalc.addObservation('ETH', 1000n * 10n ** 18n, 3000000n * 10n ** 18n);
        twapCalc.addObservation('ETH', 1000n * 10n ** 18n, 3010000n * 10n ** 18n);

        const allPrices = await aggregator.getAllPrices('ETH');

        console.log('\nPyth:');
        if (allPrices.pyth) {
            console.log(`  Price: ${allPrices.pyth.price}`);
            console.log(`  Confidence: ${(allPrices.pyth.confidence * 100).toFixed(1)}%`);
            console.log(`  Fresh: ${!aggregator.isStale(allPrices.pyth.timestamp) ? '✓' : '✗'}`);
        } else {
            console.log('  Not available');
        }

        console.log('\nChainlink (Mock):');
        if (allPrices.chainlink) {
            console.log(`  Price: ${allPrices.chainlink.price}`);
            console.log(`  Confidence: ${(allPrices.chainlink.confidence * 100).toFixed(1)}%`);
        } else {
            console.log('  Not available');
        }

        console.log('\nTWAP:');
        if (allPrices.twap) {
            console.log(`  Price: ${allPrices.twap.price}`);
            console.log(`  Confidence: ${(allPrices.twap.confidence * 100).toFixed(1)}%`);
        } else {
            console.log('  Not available');
        }

        console.log('\nConsensus:');
        console.log(`  Price: ${allPrices.consensus.price}`);
        console.log(`  Source: ${allPrices.consensus.source}`);
        console.log(`  Confidence: ${(allPrices.consensus.confidence * 100).toFixed(1)}%`);

        console.log('\n✅ Test completed!');
    })().catch(console.error);
}

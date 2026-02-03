import type { Trade } from '@/types/simulation';

interface VPINBucket {
    buy: number;
    sell: number;
}

/**
 * Calculate VPIN (Volume-Synchronized Probability of Informed Trading)
 * Formula: VPIN = Σ|V_buy - V_sell| / (n × V_bucket)
 * @returns VPIN value between 0 and 1
 */
export function calculateVPIN(
    trades: Trade[],
    bucketSize: number = 10000,
    numBuckets: number = 50
): number {
    if (trades.length === 0) return 0.3; // Baseline

    const buckets: VPINBucket[] = [];
    let currentBucket: VPINBucket = { buy: 0, sell: 0 };

    for (const trade of trades) {
        const volume = trade.amount * trade.price;
        if (trade.direction === 'BUY') {
            currentBucket.buy += volume;
        } else {
            currentBucket.sell += volume;
        }

        const totalVolume = currentBucket.buy + currentBucket.sell;
        if (totalVolume >= bucketSize) {
            buckets.push({ ...currentBucket });
            currentBucket = { buy: 0, sell: 0 };
        }
    }

    if (buckets.length < numBuckets) return 0.3; // Baseline if insufficient data

    const recentBuckets = buckets.slice(-numBuckets);
    const imbalanceSum = recentBuckets.reduce(
        (sum, b) => sum + Math.abs(b.buy - b.sell),
        0
    );

    const vpin = imbalanceSum / (numBuckets * bucketSize);
    return Math.min(vpin, 1.0);
}

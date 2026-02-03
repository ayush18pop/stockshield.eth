/**
 * StockShield Backend - Main Service
 * 
 * Orchestrates all backend services:
 * - Yellow Network client
 * - Oracle Aggregator (Pyth, Chainlink, TWAP)
 * - VPIN Calculator
 * - Regime Detector
 * - State Broadcaster
 * - Gap Auction Service
 */

import dotenv from 'dotenv';
import { createYellowClient } from './yellow/yellow-client';
import { VPINCalculator } from './yellow/vpin-calculator';
import { RegimeDetector } from './yellow/regime-detector';
import { StateBroadcaster } from './yellow/state-broadcaster';
import { GapAuctionService } from './yellow/gap-auction';
import { PythClient } from './oracle/pyth-client';
import { ChainlinkMock } from './oracle/chainlink-mock';
import { TWAPCalculator } from './oracle/twap-calculator';
import { OracleAggregator } from './oracle/oracle-aggregator';

// Load environment variables
dotenv.config();

async function main() {
    console.log('🚀 Starting StockShield Backend Services\n');

    // ========================================================================
    // 1. Initialize Yellow Network Client
    // ========================================================================
    console.log('1️⃣  Initializing Yellow Network Client...');
    const yellowClient = createYellowClient();

    try {
        await yellowClient.connect();
        console.log('✅ Connected to Yellow Network\n');
    } catch (error) {
        console.error('❌ Failed to connect to Yellow Network:', error);
        process.exit(1);
    }

    // ========================================================================
    // 2. Initialize Oracle Services
    // ========================================================================
    console.log('2️⃣  Initializing Oracle Services...');

    const pythClient = new PythClient();
    const chainlinkMock = new ChainlinkMock({ latencyMs: 20000 });
    const twapCalc = new TWAPCalculator();
    const oracleAggregator = new OracleAggregator(
        pythClient,
        chainlinkMock,
        twapCalc
    );

    console.log('✅ Oracle Aggregator initialized\n');

    // ========================================================================
    // 3. Initialize VPIN Calculator
    // ========================================================================
    console.log('3️⃣  Initializing VPIN Calculator...');
    const vpinCalc = new VPINCalculator();
    console.log('✅ VPIN Calculator initialized\n');

    // ========================================================================
    // 4. Initialize Regime Detector
    // ========================================================================
    console.log('4️⃣  Initializing Regime Detector...');
    const regimeDetector = new RegimeDetector();
    const currentRegime = regimeDetector.getCurrentRegime();
    console.log(`✅ Regime Detector initialized - Current: ${currentRegime.regime}\n`);

    // ========================================================================
    // 5. Initialize Gap Auction Service
    // ========================================================================
    console.log('5️⃣  Initializing Gap Auction Service...');
    const gapAuction = new GapAuctionService();
    console.log('✅ Gap Auction Service initialized\n');

    // ========================================================================
    // 6. Create State Channel
    // ========================================================================
    console.log('6️⃣  Creating Yellow Network State Channel...');
    let channelId: string;

    try {
        channelId = await yellowClient.createChannel();
        console.log(`✅ Channel created: ${channelId}\n`);
    } catch (error) {
        console.error('❌ Failed to create channel:', error);
        process.exit(1);
    }

    // ========================================================================
    // 7. Initialize State Broadcaster
    // ========================================================================
    console.log('7️⃣  Initializing State Broadcaster...');
    const stateBroadcaster = new StateBroadcaster(
        yellowClient,
        vpinCalc,
        regimeDetector,
        oracleAggregator,
        {
            vpinUpdateInterval: 5000,      // 5 seconds
            regimeCheckInterval: 60000,    // 1 minute
            minVPINChange: 0.05,           // 5% change
        }
    );

    await stateBroadcaster.start(channelId);
    console.log('✅ State Broadcaster started\n');

    // ========================================================================
    // 8. Start Monitoring Loop
    // ========================================================================
    console.log('8️⃣  Starting monitoring loop...\n');
    console.log('═'.repeat(60));
    console.log('📊 StockShield Backend is now running');
    console.log('═'.repeat(60));
    console.log('');

    // Simulate some trading activity for demo
    let tradeCount = 0;
    const demoInterval = setInterval(async () => {
        tradeCount++;

        // Simulate random trades
        const isBuy = Math.random() > 0.5;
        const volume = Math.random() * 10000 + 1000; // $1k - $11k

        vpinCalc.processTrade(volume, isBuy);

        // Get oracle price
        try {
            const oraclePrice = await oracleAggregator.getConsensusPrice('ETH');
            const priceFormatted = Number(oraclePrice.price) / 1e18;

            console.log(`[${new Date().toISOString()}]`);
            console.log(`  Trade: ${isBuy ? 'BUY' : 'SELL'} $${volume.toFixed(2)}`);
            console.log(`  Oracle: $${priceFormatted.toFixed(2)} (${(oraclePrice.confidence * 100).toFixed(1)}% confidence)`);
            console.log(`  VPIN: ${vpinCalc.getVPIN().toFixed(3)}`);
            console.log(`  Regime: ${regimeDetector.getCurrentRegime().regime}`);
            console.log('');
        } catch (error) {
            console.error('Error fetching oracle price:', error);
        }

        // Stop after 20 trades for demo
        if (tradeCount >= 20) {
            console.log('\n🎉 Demo completed! Stopping services...\n');
            clearInterval(demoInterval);
            await cleanup();
        }
    }, 10000); // Every 10 seconds

    // ========================================================================
    // 9. Graceful Shutdown
    // ========================================================================
    async function cleanup() {
        console.log('🧹 Cleaning up...');

        try {
            await stateBroadcaster.stop();
            console.log('✅ State broadcaster stopped');

            await yellowClient.disconnect();
            console.log('✅ Yellow Network disconnected');

            console.log('\n👋 Goodbye!');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            process.exit(1);
        }
    }

    // Handle shutdown signals
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

// Run main service
main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});

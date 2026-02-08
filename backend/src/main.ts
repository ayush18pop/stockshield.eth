/**
 * StockShield Backend - Main Service
 * 
 * Orchestrates all backend services:
 * - API Server (REST endpoints)
 * - WebSocket Server (real-time updates)
 * - Yellow Network client
 * - Oracle Aggregator (Pyth, Chainlink, TWAP)
 * - VPIN Calculator
 * - Regime Detector
 * - State Broadcaster
 * - Gap Auction Service
 * 
 * Usage:
 *   npm run start         - Start API server (for frontend integration)
 *   npm run start:demo    - Run demo simulation
 */

import dotenv from 'dotenv';
import http from 'http';
import { createYellowClient } from './yellow/yellow-client';
import { VPINCalculator } from './yellow/vpin-calculator';
import { RegimeDetector } from './yellow/regime-detector';
import { StateBroadcaster } from './yellow/state-broadcaster';
import { GapAuctionService } from './yellow/gap-auction';
import { PythClient } from './oracle/pyth-client';
import { ChainlinkMock } from './oracle/chainlink-mock';
import { TWAPCalculator } from './oracle/twap-calculator';
import { OracleAggregator } from './oracle/oracle-aggregator';
import { APIServer } from './api/api-server';
import { WSServer } from './api/ws-server';

// Load environment variables
dotenv.config();

// Configuration
const API_PORT = parseInt(process.env.API_PORT || '3001', 10);
const RUN_MODE = process.env.RUN_MODE || 'api'; // 'api' or 'demo'

async function main() {
    console.log('🚀 Starting StockShield Backend Services\n');
    console.log(`📋 Mode: ${RUN_MODE.toUpperCase()}`);
    console.log(`📋 API Port: ${API_PORT}\n`);

    // ========================================================================
    // 1. Initialize Core Services
    // ========================================================================
    console.log('1️⃣  Initializing Core Services...');

    const pythClient = new PythClient();
    const chainlinkMock = new ChainlinkMock({ latencyMs: 20000 });
    const twapCalc = new TWAPCalculator();
    const oracleAggregator = new OracleAggregator(pythClient, chainlinkMock, twapCalc);
    const vpinCalc = new VPINCalculator();
    const regimeDetector = new RegimeDetector();
    const gapAuction = new GapAuctionService();

    console.log('✅ Core services initialized\n');

    // ========================================================================
    // 2. Initialize Yellow Network Client (optional - can fail gracefully)
    // ========================================================================
    // ========================================================================
    // 2. Initialize Yellow Network Client (with reconnection logic)
    // ========================================================================
    console.log('2️⃣  Initializing Yellow Network Client...');
    const yellowClient = createYellowClient();
    let channelId: string | null = null;
    let stateBroadcaster: StateBroadcaster | null = null;
    let isReconnecting = false;

    // Initialize state broadcaster early
    stateBroadcaster = new StateBroadcaster(
        yellowClient,
        vpinCalc,
        regimeDetector,
        oracleAggregator,
        {
            vpinUpdateInterval: 5000,
            regimeCheckInterval: 60000,
            minVPINChange: 0.05,
        }
    );

    const initializeYellow = async () => {
        try {
            if (yellowClient.connected) return;

            console.log('🔌 Connecting to Yellow Network...');
            await yellowClient.connect();
            await yellowClient.authenticate();
            const newChannelId = await yellowClient.createChannel();

            channelId = newChannelId; // Update global channel ID
            console.log(`✅ Yellow Network connected, channel: ${channelId}\n`);

            // Restart state broadcaster with new channel
            if (stateBroadcaster) {
                stateBroadcaster.stop();
                await stateBroadcaster.start(channelId);
            }

            isReconnecting = false;
        } catch (error) {
            console.warn('⚠️  Yellow Network connection failed');
            console.warn(`   Reason: ${error instanceof Error ? error.message : error}\n`);

            // Schedule retry if not already reconnecting
            if (!isReconnecting) {
                isReconnecting = true;
                console.log('🔄 Scheduling reconnection in 5s...');
                setTimeout(initializeYellow, 5000);
            }
        }
    };

    // Handle connection loss
    yellowClient.onConnectionLost(() => {
        console.log('⚠️  Connection lost - attempting reconnect...');
        stateBroadcaster?.stop();
        setTimeout(initializeYellow, 1000);
    });

    // Initial connection attempt
    initializeYellow();

    // ========================================================================
    // 3. Start API Server
    // ========================================================================
    console.log('3️⃣  Starting API Server...');

    const apiServer = new APIServer(
        vpinCalc,
        regimeDetector,
        oracleAggregator,
        {
            client: yellowClient,
            getChannelId: () => channelId,
            setChannelId: (nextChannelId: string) => {
                channelId = nextChannelId;
            },
        },
        stateBroadcaster,  // Pass broadcaster for trade→Yellow flow
        gapAuction         // Pass gap auction service
    );
    const httpServer = http.createServer((req, res) => {
        // @ts-ignore - access private method for now
        apiServer['handleRequest'](req, res);
    });

    // ========================================================================
    // 4. Start WebSocket Server
    // ========================================================================
    console.log('4️⃣  Starting WebSocket Server...');

    const wsServer = new WSServer(vpinCalc, regimeDetector, oracleAggregator);
    wsServer.start(httpServer);

    // Start HTTP server
    httpServer.listen(API_PORT, () => {
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`📡 API Server: http://localhost:${API_PORT}/api`);
        console.log(`🔌 WebSocket:  ws://localhost:${API_PORT}/ws`);
        console.log(`${'═'.repeat(60)}\n`);
    });

    // ========================================================================
    // 5. Run Demo Mode (if enabled)
    // ========================================================================
    if (RUN_MODE === 'demo') {
        console.log('📊 Running in DEMO mode - simulating trades...\n');

        let tradeCount = 0;
        const demoInterval = setInterval(async () => {
            tradeCount++;

            // Simulate random trades
            const isBuy = Math.random() > 0.5;
            const volume = Math.random() * 10000 + 1000;

            const metrics = vpinCalc.processTrade(volume, isBuy);

            // Broadcast VPIN update via WebSocket
            wsServer.broadcastVPINUpdate('0xdemo');

            try {
                const oraclePrice = await oracleAggregator.getConsensusPrice('ETH');
                const priceFormatted = Number(oraclePrice.price) / 1e18;

                console.log(`[Trade ${tradeCount}] ${isBuy ? 'BUY' : 'SELL'} $${volume.toFixed(0)} | VPIN: ${metrics.vpin.toFixed(3)} | ETH: $${priceFormatted.toFixed(2)}`);
            } catch (error) {
                console.log(`[Trade ${tradeCount}] ${isBuy ? 'BUY' : 'SELL'} $${volume.toFixed(0)} | VPIN: ${metrics.vpin.toFixed(3)}`);
            }

            // Stop after 100 trades in demo mode
            if (tradeCount >= 100) {
                console.log('\n🎉 Demo completed!');
                clearInterval(demoInterval);
            }
        }, 3000);
    } else {
        console.log('📡 Running in API mode - waiting for frontend connections...\n');
        console.log('Available endpoints:');
        console.log('  GET /api/health          - Service health check');
        console.log('  GET /api/regime          - Current market regime');
        console.log('  GET /api/vpin/:poolId    - VPIN score for pool');
        console.log('  GET /api/price/:asset    - Oracle price for asset');
        console.log('  GET /api/fees/:poolId    - Dynamic fee calculation');
        console.log('  GET /api/pools           - List all pools');
        console.log('  GET /api/pools/:poolId   - Pool details');
        console.log('  GET /api/circuit-breaker - Circuit breaker status');
        console.log('  GET /api/auctions/active - Active gap auctions');
        console.log('');
    }

    // ========================================================================
    // 6. Graceful Shutdown
    // ========================================================================
    async function cleanup() {
        console.log('\n🧹 Shutting down...');

        try {
            wsServer.stop();
            httpServer.close();
            console.log('✅ API/WS servers stopped');

            if (stateBroadcaster) {
                await stateBroadcaster.stop();
                console.log('✅ State broadcaster stopped');
            }

            await yellowClient.disconnect();
            console.log('✅ Yellow Network disconnected');

            console.log('\n👋 Goodbye!');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error during cleanup:', error);
            process.exit(1);
        }
    }

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

// Run main service
main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});

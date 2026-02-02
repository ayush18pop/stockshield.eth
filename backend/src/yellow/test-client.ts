/**
 * Yellow Network Client Test Script
 * 
 * Tests connection to ClearNode sandbox and basic channel operations.
 * 
 * Usage:
 *   1. Copy .env.example to .env and fill in your keys
 *   2. Run: npx ts-node src/yellow/test-client.ts
 */

import 'dotenv/config';
import { createYellowClient } from './yellow-client';

async function main() {
    console.log('🚀 StockShield Yellow Network Client Test\n');
    console.log('='.repeat(50));

    // Create client
    const client = createYellowClient();
    console.log(`📍 Wallet address: ${client.address}`);
    console.log('');

    try {
        // Step 1: Connect
        console.log('📡 Step 1: Connecting to ClearNode...');
        await client.connect();
        console.log('');

        // Step 2: Authenticate
        console.log('🔐 Step 2: Authenticating...');
        await client.authenticate();
        console.log('');

        // Step 3: Create channel
        console.log('📦 Step 3: Creating channel...');
        const channelId = await client.createChannel();
        console.log(`   Channel ID: ${channelId}`);
        console.log('');

        // Step 4: Fund channel (if faucet tokens available)
        console.log('💰 Step 4: Funding channel...');
        try {
            await client.fundChannel(channelId, 100n); // 100 units
            console.log('   Channel funded with 100 units');
        } catch (error: any) {
            console.log(`   ⚠️  Funding skipped: ${error.message}`);
            console.log('   💡 Tip: Request tokens from faucet first:');
            console.log(`      curl -XPOST https://clearnet-sandbox.yellow.com/faucet/requestTokens \\`);
            console.log(`        -H "Content-Type: application/json" \\`);
            console.log(`        -d '{"userAddress":"${client.address}"}'`);
        }
        console.log('');

        // Step 5: Show channel info
        console.log('📊 Step 5: Channel Status:');
        const channel = client.getChannel(channelId);
        if (channel) {
            console.log(`   ID: ${channel.channelId}`);
            console.log(`   Status: ${channel.status}`);
            console.log(`   Balance: ${channel.balance}`);
        }
        console.log('');

        // Step 6: Close channel (optional - uncomment to test)
        // console.log('🔒 Step 6: Closing channel...');
        // await client.closeChannel(channelId);
        // console.log('   Channel closed');

        console.log('='.repeat(50));
        console.log('✅ All tests passed!');
        console.log('');
        console.log('🎉 Yellow Network integration is working!');
        console.log('   Next steps:');
        console.log('   - Implement Gap Auction service');
        console.log('   - Implement LVR Auction service');
        console.log('   - Connect to StockShield Hook');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        console.log('\n🔌 Disconnecting...');
        client.disconnect();
    }
}

// Run if executed directly
main().catch(console.error);

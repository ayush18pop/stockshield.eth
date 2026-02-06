/**
 * WebSocket Server for Real-time Updates
 * 
 * Broadcasts live updates for VPIN, regime changes, prices, and alerts.
 */

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { VPINCalculator } from '../yellow/vpin-calculator';
import { RegimeDetector, Regime } from '../yellow/regime-detector';
import { OracleAggregator } from '../oracle/oracle-aggregator';

// ============================================================================
// Types
// ============================================================================

interface WSMessage {
    type: string;
    data: unknown;
    timestamp: number;
}

interface ClientSubscription {
    vpin: boolean;
    regime: boolean;
    price: boolean;
    circuitBreaker: boolean;
    auctions: boolean;
}

interface ConnectedClient {
    ws: WebSocket;
    subscriptions: ClientSubscription;
}

// ============================================================================
// WebSocket Server
// ============================================================================

export class WSServer {
    private wss: WebSocketServer | null = null;
    private clients: Set<ConnectedClient> = new Set();
    private vpinCalc: VPINCalculator;
    private regimeDetector: RegimeDetector;
    private oracleAggregator: OracleAggregator;

    // Intervals for periodic broadcasts
    private vpinInterval: NodeJS.Timeout | null = null;
    private priceInterval: NodeJS.Timeout | null = null;
    private regimeCheckInterval: NodeJS.Timeout | null = null;

    // Track last values for change detection
    private lastVPIN: number = 0;
    private lastRegime: Regime = Regime.CORE_SESSION;
    private lastCircuitBreakerLevel: number = 0;

    constructor(
        vpinCalc: VPINCalculator,
        regimeDetector: RegimeDetector,
        oracleAggregator: OracleAggregator
    ) {
        this.vpinCalc = vpinCalc;
        this.regimeDetector = regimeDetector;
        this.oracleAggregator = oracleAggregator;
    }

    /**
     * Start WebSocket server attached to HTTP server
     */
    start(server: http.Server): void {
        this.wss = new WebSocketServer({ server, path: '/ws' });

        this.wss.on('connection', (ws: WebSocket) => {
            console.log('🔌 New WebSocket client connected');

            const client: ConnectedClient = {
                ws,
                subscriptions: {
                    vpin: true,
                    regime: true,
                    price: true,
                    circuitBreaker: true,
                    auctions: false,
                },
            };

            this.clients.add(client);

            // Send welcome message
            this.sendToClient(client, {
                type: 'connected',
                data: { message: 'Connected to StockShield WebSocket' },
                timestamp: Date.now(),
            });

            // Handle incoming messages
            ws.on('message', (data: Buffer) => {
                this.handleClientMessage(client, data.toString());
            });

            // Handle disconnect
            ws.on('close', () => {
                console.log('🔌 WebSocket client disconnected');
                this.clients.delete(client);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(client);
            });
        });

        // Start broadcast intervals
        this.startBroadcastIntervals();

        console.log('🔌 WebSocket Server started on /ws');
    }

    /**
     * Stop WebSocket server
     */
    stop(): void {
        if (this.vpinInterval) clearInterval(this.vpinInterval);
        if (this.priceInterval) clearInterval(this.priceInterval);
        if (this.regimeCheckInterval) clearInterval(this.regimeCheckInterval);

        this.clients.forEach(client => {
            client.ws.close();
        });
        this.clients.clear();

        if (this.wss) {
            this.wss.close();
            console.log('🔌 WebSocket Server stopped');
        }
    }

    /**
     * Handle incoming client messages
     */
    private handleClientMessage(client: ConnectedClient, message: string): void {
        try {
            const parsed = JSON.parse(message);

            if (parsed.type === 'subscribe') {
                // Update subscriptions
                const channels = parsed.channels as string[];
                if (channels.includes('vpin')) client.subscriptions.vpin = true;
                if (channels.includes('regime')) client.subscriptions.regime = true;
                if (channels.includes('price')) client.subscriptions.price = true;
                if (channels.includes('circuitBreaker')) client.subscriptions.circuitBreaker = true;
                if (channels.includes('auctions')) client.subscriptions.auctions = true;

                this.sendToClient(client, {
                    type: 'subscribed',
                    data: { channels },
                    timestamp: Date.now(),
                });
            }

            if (parsed.type === 'unsubscribe') {
                const channels = parsed.channels as string[];
                if (channels.includes('vpin')) client.subscriptions.vpin = false;
                if (channels.includes('regime')) client.subscriptions.regime = false;
                if (channels.includes('price')) client.subscriptions.price = false;
                if (channels.includes('circuitBreaker')) client.subscriptions.circuitBreaker = false;
                if (channels.includes('auctions')) client.subscriptions.auctions = false;

                this.sendToClient(client, {
                    type: 'unsubscribed',
                    data: { channels },
                    timestamp: Date.now(),
                });
            }

            if (parsed.type === 'ping') {
                this.sendToClient(client, {
                    type: 'pong',
                    data: {},
                    timestamp: Date.now(),
                });
            }

        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    }

    /**
     * Start periodic broadcast intervals
     */
    private startBroadcastIntervals(): void {
        // VPIN updates every 5 seconds (only if changed significantly)
        this.vpinInterval = setInterval(() => {
            const currentVPIN = this.vpinCalc.getVPIN();
            const change = Math.abs(currentVPIN - this.lastVPIN);

            if (change > 0.02) { // 2% change threshold
                this.lastVPIN = currentVPIN;
                this.broadcastVPINUpdate();
            }
        }, 5000);

        // Price updates every 10 seconds
        this.priceInterval = setInterval(() => {
            this.broadcastPriceUpdate();
        }, 10000);

        // Regime check every 30 seconds
        this.regimeCheckInterval = setInterval(() => {
            const currentRegime = this.regimeDetector.getCurrentRegime().regime;

            if (currentRegime !== this.lastRegime) {
                const prevRegime = this.lastRegime;
                this.lastRegime = currentRegime;
                this.broadcastRegimeChange(prevRegime, currentRegime);
            }

            // Check circuit breaker
            this.checkCircuitBreaker();
        }, 30000);
    }

    /**
     * Broadcast VPIN update
     */
    broadcastVPINUpdate(poolId: string = '0xdefault'): void {
        const metrics = this.vpinCalc.getMetrics();
        const interpretation = this.vpinCalc.getInterpretation(metrics.vpin);

        const message: WSMessage = {
            type: 'vpin:update',
            data: {
                poolId,
                vpin: metrics.vpin,
                bucketCount: metrics.bucketsFilled,
                level: interpretation.level,
                trend: this.lastVPIN < metrics.vpin ? 'rising' : 'falling',
            },
            timestamp: Date.now(),
        };

        this.broadcast(message, 'vpin');
    }

    /**
     * Broadcast regime change
     */
    broadcastRegimeChange(from: Regime, to: Regime): void {
        const regimeInfo = this.regimeDetector.getCurrentRegime();

        const message: WSMessage = {
            type: 'regime:change',
            data: {
                from,
                to,
                multiplier: regimeInfo.multiplier,
                riskLevel: regimeInfo.riskLevel,
            },
            timestamp: Date.now(),
        };

        this.broadcast(message, 'regime');
        console.log(`📢 Regime changed: ${from} → ${to}`);
    }

    /**
     * Broadcast price update
     */
    private async broadcastPriceUpdate(): Promise<void> {
        try {
            const ethPrice = await this.oracleAggregator.getConsensusPrice('ETH');

            const message: WSMessage = {
                type: 'price:update',
                data: {
                    asset: 'ETH',
                    price: Number(ethPrice.price) / 1e18,
                    source: ethPrice.source,
                    confidence: ethPrice.confidence,
                },
                timestamp: Date.now(),
            };

            this.broadcast(message, 'price');
        } catch (error) {
            // Silently fail price updates
        }
    }

    /**
     * Broadcast fee update
     */
    broadcastFeeUpdate(poolId: string, fee: number, components: Record<string, number>): void {
        const message: WSMessage = {
            type: 'fee:update',
            data: {
                poolId,
                fee,
                components,
            },
            timestamp: Date.now(),
        };

        this.broadcast(message, 'vpin'); // Fee updates go to VPIN subscribers
    }

    /**
     * Broadcast auction event
     */
    broadcastAuctionEvent(event: 'started' | 'ended', auctionData: unknown): void {
        const message: WSMessage = {
            type: `auction:${event}`,
            data: auctionData,
            timestamp: Date.now(),
        };

        this.broadcast(message, 'auctions');
    }

    /**
     * Check and broadcast circuit breaker changes
     */
    private checkCircuitBreaker(): void {
        const vpin = this.vpinCalc.getVPIN();

        let level = 0;
        const flags: string[] = [];

        if (vpin > 0.7) {
            level = 1;
            flags.push('HIGH_VPIN');
        }
        if (vpin > 0.8) {
            level = 2;
            flags.push('EXTREME_VPIN');
        }
        if (vpin > 0.9) {
            level = 3;
            flags.push('CRITICAL_VPIN');
        }

        if (level !== this.lastCircuitBreakerLevel) {
            const previousLevel = this.lastCircuitBreakerLevel;
            this.lastCircuitBreakerLevel = level;

            const message: WSMessage = {
                type: 'circuitBreaker:trigger',
                data: {
                    level,
                    flags,
                    previousLevel,
                },
                timestamp: Date.now(),
            };

            this.broadcast(message, 'circuitBreaker');
            console.log(`⚠️ Circuit breaker level changed to ${level}`);
        }
    }

    /**
     * Send message to a specific client
     */
    private sendToClient(client: ConnectedClient, message: WSMessage): void {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Broadcast message to all subscribed clients
     */
    private broadcast(message: WSMessage, channel: keyof ClientSubscription): void {
        this.clients.forEach(client => {
            if (client.subscriptions[channel] && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }

    /**
     * Get connected client count
     */
    getClientCount(): number {
        return this.clients.size;
    }
}

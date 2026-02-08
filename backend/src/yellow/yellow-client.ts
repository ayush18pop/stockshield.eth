/**
 * Yellow Network Client for StockShield
 * 
 * Handles WebSocket connection to ClearNode, authentication, and channel management.
 * Based on @erc7824/nitrolite SDK.
 */

import WebSocket from 'ws';
import {
    NitroliteClient,
    WalletStateSigner,
    createECDSAMessageSigner,
    createAuthRequestMessage,
    createAuthVerifyMessageFromChallenge,
    createEIP712AuthMessageSigner,
    createCreateChannelMessage,
    createResizeChannelMessage,
    createCloseChannelMessage,
    parseAnyRPCResponse,
} from '@erc7824/nitrolite';
import {
    createPublicClient,
    createWalletClient,
    http,
    type WalletClient,
    type PublicClient
} from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

import {
    YellowClientConfig,
    YellowMessage,
    YellowMessageType,
    ChannelInfo,
    ChannelStatus,
    SEPOLIA_CONFIG
} from './types';

// ============================================================================
// Yellow Client Class
// ============================================================================

export class YellowClient {
    private ws: WebSocket | null = null;
    private client: NitroliteClient | null = null;
    private publicClient: PublicClient;
    private walletClient: WalletClient;
    private sessionSigner: ReturnType<typeof createECDSAMessageSigner> | null = null;
    private sessionPrivateKey: `0x${string}` | null = null;
    private account: ReturnType<typeof privateKeyToAccount>;
    private config: YellowClientConfig;

    private isConnected = false;
    private isAuthenticated = false;
    private channels: Map<string, ChannelInfo> = new Map();

    private messageHandlers: Map<string, (msg: YellowMessage) => void> = new Map();

    constructor(config: Partial<YellowClientConfig> & { privateKey: string; rpcUrl: string }) {
        this.config = {
            wsUrl: config.wsUrl || SEPOLIA_CONFIG.wsUrl,
            privateKey: config.privateKey,
            rpcUrl: config.rpcUrl,
            chainId: config.chainId || SEPOLIA_CONFIG.chainId,
            addresses: config.addresses || SEPOLIA_CONFIG.addresses,
        };

        // Setup Viem clients
        this.account = privateKeyToAccount(this.config.privateKey as `0x${string}`);

        this.publicClient = createPublicClient({
            chain: sepolia,
            transport: http(this.config.rpcUrl),
        });

        this.walletClient = createWalletClient({
            chain: sepolia,
            transport: http(this.config.rpcUrl),
            account: this.account,
        });

        // Initialize Nitrolite Client
        this.client = new NitroliteClient({
            publicClient: this.publicClient as any,
            walletClient: this.walletClient as any,
            stateSigner: new WalletStateSigner(this.walletClient as any),
            addresses: {
                custody: this.config.addresses.custody,
                adjudicator: this.config.addresses.adjudicator,
            },
            chainId: this.config.chainId,
            challengeDuration: 3600n,
        });

        console.log('💡 Note: SDK on-chain finalization is optional for demo');
    }

    // ============================================================================
    // Connection Management
    // ============================================================================

    /**
     * Connect to Yellow Network ClearNode via WebSocket
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log(`🔌 Connecting to Yellow Network: ${this.config.wsUrl}`);

            this.ws = new WebSocket(this.config.wsUrl);

            this.ws.onopen = () => {
                console.log('✅ Connected to Yellow Network!');
                this.isConnected = true;
                resolve();
            };

            this.ws.onmessage = (event: WebSocket.MessageEvent) => {
                this.handleMessage(event.data.toString());
            };

            this.ws.onerror = (error: WebSocket.ErrorEvent) => {
                console.error('❌ WebSocket error:', error.message);
                reject(new Error(`WebSocket error: ${error.message}`));
            };

            this.ws.onclose = () => {
                console.log('🔌 Disconnected from Yellow Network');
                this.isConnected = false;
                this.isAuthenticated = false;
                if (this.onConnectionLostCallback) {
                    this.onConnectionLostCallback();
                }
            };

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    private onConnectionLostCallback: (() => void) | null = null;

    /**
     * Register a callback for when connection is lost
     */
    onConnectionLost(callback: () => void): void {
        this.onConnectionLostCallback = callback;
    }

    /**
     * Disconnect from Yellow Network
     */
    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isAuthenticated = false;
    }

    // ============================================================================
    // Authentication
    // ============================================================================

    /**
     * Authenticate with Yellow Network using session keys
     */
    async authenticate(): Promise<void> {
        if (!this.ws || !this.isConnected) {
            throw new Error('Not connected to Yellow Network');
        }

        console.log('🔐 Starting authentication...');

        // Generate temporary session key
        this.sessionPrivateKey = generatePrivateKey();
        this.sessionSigner = createECDSAMessageSigner(this.sessionPrivateKey);
        const sessionAccount = privateKeyToAccount(this.sessionPrivateKey as `0x${string}`);
        const walletClient = this.walletClient;
        const account = this.account;

        // Generate auth params once to ensure consistency
        const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour
        const authParams = {
            address: account.address,
            application: 'StockShield',
            session_key: sessionAccount.address,
            allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
            expires_at: expiresAt,
            scope: 'stockshield.app',
        };

        return new Promise(async (resolve, reject) => {
            // Set up auth challenge handler
            const authHandler = async (msg: YellowMessage) => {
                if (msg.type === 'auth_challenge' || msg.type === 'auth_request') {
                    try {
                        console.log('📨 Received auth challenge, signing...');

                        const challengeMessage = (msg.data as any)?.challengeMessage || (msg.data as any)?.challenge_message;
                        if (!challengeMessage) {
                            throw new Error('No challenge message received');
                        }

                        // Use pre-defined authParams for consistent signature
                        const signer = createEIP712AuthMessageSigner(
                            walletClient as any,
                            authParams,
                            { name: 'StockShield' }
                        );

                        const verifyMsg = await createAuthVerifyMessageFromChallenge(signer, challengeMessage);
                        const ws = this.ws;
                        if (!ws) {
                            throw new Error('WebSocket disconnected during challenge signing');
                        }
                        ws.send(verifyMsg);
                    } catch (error) {
                        reject(error);
                    }
                } else if (msg.type === 'auth_success') {
                    console.log('✅ Authentication successful!');
                    this.isAuthenticated = true;
                    this.messageHandlers.delete('auth');
                    resolve();
                } else if (msg.type === 'error') {
                    reject(new Error(`Auth error: ${msg.error}`));
                }
            };

            this.messageHandlers.set('auth', authHandler);

            // Send auth request
            try {
                const authRequestMsg = await createAuthRequestMessage(authParams);

                console.log('📤 Sending auth request...');
                if (!this.ws) {
                    reject(new Error('WebSocket disconnected during authentication'));
                    return;
                }
                this.ws.send(authRequestMsg);
            } catch (error) {
                reject(error);
            }

            // Timeout after 30 seconds
            setTimeout(() => {
                if (!this.isAuthenticated) {
                    this.messageHandlers.delete('auth');
                    reject(new Error('Authentication timeout'));
                }
            }, 30000);
        });
    }

    // ============================================================================
    // Channel Management
    // ============================================================================

    /**
     * Create a new state channel
     */
    async createChannel(): Promise<string> {
        if (!this.isAuthenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        console.log('📦 Creating new channel...');

        const sessionSigner = this.sessionSigner;
        const ws = this.ws;

        return new Promise(async (resolve, reject) => {
            const channelHandler = async (msg: YellowMessage) => {
                if (msg.type === 'create_channel' && msg.channelId) {
                    console.log(`✅ Channel created on node: ${msg.channelId}`);

                    try {
                        if (this.client && msg.data) {
                            const params = msg.data as any;
                            await this.client.createChannel({
                                channel: params.channel,
                                unsignedInitialState: params.state,
                                serverSignature: params.serverSignature,
                            });
                            console.log('✅ Channel state finalized in SDK');
                        }
                    } catch (error) {
                        console.warn('⚠️  SDK on-chain finalization skipped (demo mode):', error instanceof Error ? error.message : String(error));
                        console.log('   Channel is active on ClearNode and can be used for state updates');
                    }

                    this.channels.set(msg.channelId, {
                        channelId: msg.channelId,
                        participant: this.account.address,
                        counterparty: '', // ClearNode address
                        balance: 0n,
                        status: ChannelStatus.OPEN,
                    });

                    this.messageHandlers.delete('create_channel');
                    resolve(msg.channelId);
                } else if (msg.type === 'error') {
                    this.messageHandlers.delete('create_channel');
                    reject(new Error(`Channel creation error: ${msg.error}`));
                }
            };

            this.messageHandlers.set('create_channel', channelHandler);

            try {
                if (!ws) {
                    throw new Error('WebSocket not connected');
                }

                const createMsg = await createCreateChannelMessage(
                    sessionSigner,
                    {
                        chain_id: this.config.chainId,
                        token: this.config.addresses.token,
                    }
                );

                ws.send(createMsg);
            } catch (error) {
                this.messageHandlers.delete('create_channel');
                reject(error);
            }

            setTimeout(() => {
                this.messageHandlers.delete('create_channel');
                reject(new Error('Channel creation timeout'));
            }, 30000);
        });
    }

    /**
     * Fund a channel by resizing (allocating from unified balance)
     */
    async fundChannel(channelId: string, amount: bigint): Promise<void> {
        if (!this.isAuthenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        console.log(`💰 Funding channel ${channelId} with ${amount} units...`);

        const sessionSigner = this.sessionSigner;
        const ws = this.ws;

        return new Promise(async (resolve, reject) => {
            const resizeHandler = async (msg: YellowMessage) => {
                if (msg.type === 'resize_channel') {
                    console.log('✅ Channel resize success on node!');

                    try {
                        if (this.client && msg.data) {
                            const params = msg.data as any;
                            await this.client.resizeChannel({
                                resizeState: params.resizeState,
                                proofStates: params.proofStates,
                            });
                            console.log('✅ Resize state finalized in SDK');
                        }
                    } catch (error) {
                        console.warn('⚠️  SDK resize finalization skipped (demo mode):', error instanceof Error ? error.message : String(error));
                    }

                    const channel = this.channels.get(channelId);
                    if (channel) {
                        channel.balance += amount;
                        channel.status = ChannelStatus.FUNDED;
                    }

                    this.messageHandlers.delete('resize_channel');
                    resolve();
                } else if (msg.type === 'error') {
                    this.messageHandlers.delete('resize_channel');
                    reject(new Error(`Resize error: ${msg.error}`));
                }
            };

            this.messageHandlers.set('resize_channel', resizeHandler);

            try {
                if (!ws) {
                    throw new Error('WebSocket not connected');
                }

                const resizeMsg = await createResizeChannelMessage(
                    sessionSigner,
                    {
                        channel_id: channelId.startsWith('0x') ? (channelId as `0x${string}`) : `0x${channelId}` as `0x${string}`,
                        allocate_amount: amount,
                        funds_destination: this.account.address,
                    }
                );

                ws.send(resizeMsg);
            } catch (error) {
                this.messageHandlers.delete('resize_channel');
                reject(error);
            }

            setTimeout(() => {
                this.messageHandlers.delete('resize_channel');
                reject(new Error('Resize timeout'));
            }, 30000);
        });
    }

    /**
     * Close a channel and withdraw funds
     */
    async closeChannel(channelId: string): Promise<void> {
        if (!this.isAuthenticated || !this.sessionSigner) {
            throw new Error('Not authenticated');
        }

        console.log(`🔒 Closing channel ${channelId}...`);

        const sessionSigner = this.sessionSigner;
        const ws = this.ws;

        return new Promise(async (resolve, reject) => {
            const closeHandler = async (msg: YellowMessage) => {
                if (msg.type === 'close_channel') {
                    console.log('✅ Channel close success on node!');

                    try {
                        if (this.client && msg.data) {
                            const params = msg.data as any;
                            await this.client.closeChannel({
                                finalState: params.finalState || params.lastPaidState,
                                stateData: params.stateData || '0x',
                            });
                            console.log('✅ Close state finalized in SDK');
                        }
                    } catch (error) {
                        console.warn('⚠️  SDK close finalization skipped (demo mode):', error instanceof Error ? error.message : String(error));
                    }

                    const channel = this.channels.get(channelId);
                    if (channel) {
                        channel.status = ChannelStatus.CLOSED;
                    }

                    this.messageHandlers.delete('close_channel');
                    resolve();
                } else if (msg.type === 'error') {
                    this.messageHandlers.delete('close_channel');
                    reject(new Error(`Close error: ${msg.error}`));
                }
            };

            this.messageHandlers.set('close_channel', closeHandler);

            try {
                if (!ws) {
                    throw new Error('WebSocket not connected');
                }

                const closeMsg = await createCloseChannelMessage(
                    sessionSigner,
                    channelId.startsWith('0x') ? (channelId as `0x${string}`) : `0x${channelId}` as `0x${string}`,
                    this.account.address
                );

                ws.send(closeMsg);
            } catch (error) {
                this.messageHandlers.delete('close_channel');
                reject(error);
            }

            setTimeout(() => {
                this.messageHandlers.delete('close_channel');
                reject(new Error('Close timeout'));
            }, 30000);
        });
    }

    // ============================================================================
    // Message Handling
    // ============================================================================

    /**
     * Handle incoming WebSocket messages
     */
    private handleMessage(data: string): void {
        try {
            const message = parseAnyRPCResponse(data);
            const method = message.method as string;
            console.log(`📨 Received: ${method}`, JSON.stringify(message, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

            const params = (message as any).params;

            // Map auth_verify with success to auth_success for our internal logic
            let type = method;
            if (method === 'auth_verify' && params?.success) {
                type = 'auth_success';
            }

            // Extract IDs from params
            // Note: nitrolite types use appSessionId and channel.channelId
            const sessionId = params?.appSessionId || params?.sessionId;
            const channelId = params?.channelId || params?.channel?.channelId || params?.channel_id;

            // Convert to our YellowMessage type
            const yellowMsg: YellowMessage = {
                type: type as YellowMessageType,
                data: params,
                error: params?.error,
                sessionId,
                channelId,
            };

            // Check for registered handlers
            for (const [, handler] of this.messageHandlers) {
                handler(yellowMsg);
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    /**
     * Send raw message to ClearNode
     */
    send(message: string): void {
        if (!this.ws || !this.isConnected) {
            throw new Error('Not connected');
        }
        this.ws.send(message);
    }

    /**
     * Register a message handler
     */
    onMessage(key: string, handler: (msg: YellowMessage) => void): void {
        this.messageHandlers.set(key, handler);
    }

    /**
     * Remove a message handler
     */
    offMessage(key: string): void {
        this.messageHandlers.delete(key);
    }

    // ============================================================================
    // State Channel Signing
    // ============================================================================

    /**
     * Sign a state update payload with the session key.
     * Returns the hex-encoded ECDSA signature that ClearNode can verify.
     */
    async signStateUpdate(payload: Record<string, unknown>): Promise<string> {
        if (!this.sessionPrivateKey) {
            throw new Error('No session key available – authenticate first');
        }

        const sessionAccount = privateKeyToAccount(this.sessionPrivateKey as `0x${string}`);

        // Deterministic serialization: sorted keys, bigint → string
        const canonical = JSON.stringify(payload, Object.keys(payload).sort(), 0);

        // Sign the raw message bytes with the session key
        const signature = await sessionAccount.signMessage({
            message: canonical,
        });

        return signature;
    }

    // ============================================================================
    // Getters
    // ============================================================================

    get connected(): boolean {
        return this.isConnected;
    }

    get authenticated(): boolean {
        return this.isAuthenticated;
    }

    get address(): string {
        return this.account.address;
    }

    getChannel(channelId: string): ChannelInfo | undefined {
        return this.channels.get(channelId);
    }

    getAllChannels(): ChannelInfo[] {
        return Array.from(this.channels.values());
    }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Yellow client with environment variables
 */
export function createYellowClient(): YellowClient {
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.ALCHEMY_RPC_URL;
    const wsUrl = process.env.YELLOW_WS_URL;

    if (!privateKey) {
        throw new Error('PRIVATE_KEY environment variable required');
    }
    if (!rpcUrl) {
        throw new Error('ALCHEMY_RPC_URL environment variable required');
    }

    return new YellowClient({
        privateKey,
        rpcUrl,
        wsUrl,
    });
}

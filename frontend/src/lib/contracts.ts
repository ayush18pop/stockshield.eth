/**
 * StockShield Contract Addresses and ABIs (Sepolia Testnet)
 * 
 * Deployed: February 6, 2026
 * Chain ID: 11155111
 */

// =============================================================================
// Contract Addresses (Sepolia)
// =============================================================================

export const CONTRACTS = {
    // Core Protocol
    POOL_MANAGER: '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543' as const,
    REGIME_ORACLE: '0xCC46a9e6FFB834a7a1C126f9D4e803bF418CccA6' as const,
    STOCK_SHIELD_HOOK: '0x98B8158Bd631E9dDC14650284b38CcB1a16F3Ac0' as const,
    GAP_AUCTION: '0xeB16ccCf2fA0494F8C714Ac377Eb817944b8EDe2' as const,
    MARGIN_VAULT: '0x6bd916aD8bA4E0f28B61aA915e198f31F8bb9FAb' as const,
    DYNAMIC_FEE_SETUP: '0xbBF2E3871c7899e9798093823d3A766EAd326f16' as const,
    // Uniswap v4 Periphery (Official Sepolia)
    UNIVERSAL_ROUTER: '0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b' as const,
    POSITION_MANAGER: '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4' as const,
    PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const,
    STATE_VIEW: '0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c' as const,

    // Config
    TICK_SPACING: 60,
    LP_FEE: 0x800000, // Dynamic Fee Flag
} as const;

/**
 * Deployed Token Addresses (Sepolia Testnet)
 * All tokens have a public faucet() function for testing
 */
export const SEPOLIA_TOKENS = {
    USDC: '0xE7963ce0b7EFEAF47b64B06545304f10Ff24Fe70' as const,
    tAAPL: '0x7D5A3d5C66a4422E3AFf7860e3bE709585068298' as const,
    tTSLA: '0x9935de3B97C2154e5dF32C9D2FEcA276e9f30896' as const,
    tNVDA: '0xC836831e6e72D9C98e46799C830C2Ac75daC2471' as const,
    tGOOGL: '0x21Fbe2d4f6c87315381176B14B99a36276DE971f' as const,
    tMSFT: '0x4BefeAeBba1EefA79748146eCc9c2204613e3CbB' as const,
} as const;

/** @deprecated Use SEPOLIA_TOKENS instead */
export const MOCK_TOKENS = SEPOLIA_TOKENS;

// =============================================================================
// Token Metadata
// =============================================================================

export const TOKEN_INFO = {
    [SEPOLIA_TOKENS.USDC]: { symbol: 'USDC', name: 'Mock USDC', decimals: 6, logo: '💵' },
    [SEPOLIA_TOKENS.tAAPL]: { symbol: 'tAAPL', name: 'Tokenized Apple', decimals: 18, logo: '🍎' },
    [SEPOLIA_TOKENS.tTSLA]: { symbol: 'tTSLA', name: 'Tokenized Tesla', decimals: 18, logo: '🚗' },
    [SEPOLIA_TOKENS.tNVDA]: { symbol: 'tNVDA', name: 'Tokenized NVIDIA', decimals: 18, logo: '🎮' },
    [SEPOLIA_TOKENS.tGOOGL]: { symbol: 'tGOOGL', name: 'Tokenized Google', decimals: 18, logo: '🔍' },
    [SEPOLIA_TOKENS.tMSFT]: { symbol: 'tMSFT', name: 'Tokenized Microsoft', decimals: 18, logo: '💻' },
} as const;

// =============================================================================
// ABIs (Simplified for Demo)
// =============================================================================

export const PERMIT2_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
        ],
        outputs: [],
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
            { name: 'nonce', type: 'uint48' },
        ],
    },
] as const;

export const REGIME_ORACLE_ABI = [
    {
        name: 'getCurrentRegime',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        name: 'getRegimeString',
        type: 'function',
        stateMutability: 'pure',
        inputs: [{ name: 'regime', type: 'uint8' }],
        outputs: [{ name: '', type: 'string' }],
    },
    {
        name: 'isHoliday',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'timestamp', type: 'uint256' }],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'getNextTransition',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            { name: 'timeUntil', type: 'uint256' },
            { name: 'nextRegime', type: 'uint8' },
        ],
    },
] as const;

export const STOCK_SHIELD_HOOK_ABI = [
    {
        name: 'markets',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'poolId', type: 'bytes32' }],
        outputs: [
            { name: 'currentRegime', type: 'uint8' },
            { name: 'regimeStartTime', type: 'uint40' },
            { name: 'lastOraclePrice', type: 'uint128' },
            { name: 'lastOracleUpdate', type: 'uint40' },
            { name: 'realizedVolatility', type: 'uint128' },
            { name: 'vpinScore', type: 'uint64' },
            { name: 'inventoryImbalance', type: 'int128' },
            { name: 'circuitBreakerLevel', type: 'uint8' },
            { name: 'inGapAuction', type: 'bool' },
            { name: 'gapAuctionEndTime', type: 'uint40' },
        ],
    },
    {
        name: 'regimeOracle',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
    },
] as const;

export const MARGIN_VAULT_ABI = [
    {
        name: 'getVaultInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [
            { name: 'collateralAmount', type: 'uint256' },
            { name: 'lockedUntil', type: 'uint256' },
            { name: 'hasActiveChannel', type: 'bool' },
            { name: 'activeChannelId', type: 'bytes32' },
            { name: 'lastWithdrawal', type: 'uint256' },
        ],
    },
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'openChannel',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'ensNode', type: 'bytes32' }],
        outputs: [{ name: 'channelId', type: 'bytes32' }],
    },
    {
        name: 'closeChannel',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'channelId', type: 'bytes32' }],
        outputs: [],
    },
] as const;

export const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
] as const;

export const POOL_MANAGER_ABI = [
    {
        name: 'swap',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'key',
                type: 'tuple',
                components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' },
                ],
            },
            {
                name: 'params',
                type: 'tuple',
                components: [
                    { name: 'zeroForOne', type: 'bool' },
                    { name: 'amountSpecified', type: 'int256' },
                    { name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
            },
            { name: 'hookData', type: 'bytes' },
        ],
        outputs: [{ name: 'delta', type: 'int256' }],
    },
    {
        name: 'unlock',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'data', type: 'bytes' }],
        outputs: [{ name: '', type: 'bytes' }],
    },
    {
        name: 'modifyLiquidity',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            {
                name: 'key',
                type: 'tuple',
                components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' },
                ],
            },
            {
                name: 'params',
                type: 'tuple',
                components: [
                    { name: 'tickLower', type: 'int24' },
                    { name: 'tickUpper', type: 'int24' },
                    { name: 'liquidityDelta', type: 'int256' },
                    { name: 'salt', type: 'bytes32' },
                ],
            },
            { name: 'hookData', type: 'bytes' },
        ],
        outputs: [{ name: 'delta', type: 'int256' }],
    },
] as const;

export const GAP_AUCTION_ABI = [
    {
        name: 'auctionCount',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'commit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'auctionId', type: 'bytes32' },
            { name: 'commitment', type: 'bytes32' },
        ],
        outputs: [],
    },
    {
        name: 'reveal',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'auctionId', type: 'bytes32' },
            { name: 'bidAmount', type: 'uint256' },
            { name: 'salt', type: 'bytes32' },
        ],
        outputs: [],
    },
    {
        name: 'getMinBid',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'auctionId', type: 'bytes32' }],
        outputs: [{ name: '', type: 'uint256' }],
    }
] as const;

// =============================================================================
// Uniswap v4 Periphery ABIs
// =============================================================================

export const UNIVERSAL_ROUTER_ABI = [
    {
        name: 'execute',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'commands', type: 'bytes' },
            { name: 'inputs', type: 'bytes[]' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'execute',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'commands', type: 'bytes' },
            { name: 'inputs', type: 'bytes[]' },
        ],
        outputs: [],
    },
] as const;

export const POSITION_MANAGER_ABI = [
    {
        name: 'initializePool',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            {
                name: 'key', type: 'tuple', components: [
                    { name: 'currency0', type: 'address' },
                    { name: 'currency1', type: 'address' },
                    { name: 'fee', type: 'uint24' },
                    { name: 'tickSpacing', type: 'int24' },
                    { name: 'hooks', type: 'address' },
                ]
            },
            { name: 'sqrtPriceX96', type: 'uint160' },
        ],
        outputs: [{ name: 'tick', type: 'int24' }],
    },
    {
        name: 'mint',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            {
                name: 'params',
                type: 'tuple',
                components: [
                    {
                        name: 'poolKey', type: 'tuple', components: [
                            { name: 'currency0', type: 'address' },
                            { name: 'currency1', type: 'address' },
                            { name: 'fee', type: 'uint24' },
                            { name: 'tickSpacing', type: 'int24' },
                            { name: 'hooks', type: 'address' },
                        ]
                    },
                    { name: 'tickLower', type: 'int24' },
                    { name: 'tickUpper', type: 'int24' },
                    { name: 'liquidity', type: 'uint128' },
                    { name: 'amount0Max', type: 'uint256' },
                    { name: 'amount1Max', type: 'uint256' },
                    { name: 'recipient', type: 'address' },
                    { name: 'hookData', type: 'bytes' },
                ],
            },
        ],
        outputs: [
            { name: 'tokenId', type: 'uint256' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'amount0', type: 'uint256' },
            { name: 'amount1', type: 'uint256' },
        ],
    },
    {
        name: 'modifyLiquidities',
        type: 'function',
        stateMutability: 'payable',
        inputs: [
            { name: 'unlockData', type: 'bytes' },
            { name: 'deadline', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'tokenOfOwnerByIndex',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'index', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'positions',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tokenId', type: 'uint256' }],
        outputs: [
            { name: 'nonce', type: 'uint96' },
            { name: 'operator', type: 'address' },
            { name: 'poolId', type: 'bytes32' },
            { name: 'tickLower', type: 'int24' },
            { name: 'tickUpper', type: 'int24' },
            { name: 'liquidity', type: 'uint128' },
            { name: 'feeGrowthInside0LastX128', type: 'uint256' },
            { name: 'feeGrowthInside1LastX128', type: 'uint256' },
            { name: 'tokensOwed0', type: 'uint128' },
            { name: 'tokensOwed1', type: 'uint128' },
        ],
    },
] as const;

// Command constants for Universal Router
export const ROUTER_COMMANDS = {
    V4_SWAP: 0x00,
    PERMIT2_TRANSFER_FROM: 0x07,
    SWEEP: 0x04,
    PAY_PORTION: 0x06,
} as const;

// =============================================================================
// StateView ABI (for on-chain pool discovery)
// =============================================================================

export const STATE_VIEW_ABI = [
    {
        name: 'getSlot0',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'poolId', type: 'bytes32' }],
        outputs: [
            { name: 'sqrtPriceX96', type: 'uint160' },
            { name: 'tick', type: 'int24' },
            { name: 'protocolFee', type: 'uint24' },
            { name: 'lpFee', type: 'uint24' },
        ],
    },
    {
        name: 'getLiquidity',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'poolId', type: 'bytes32' }],
        outputs: [{ name: 'liquidity', type: 'uint128' }],
    },
] as const;

// =============================================================================
// Pool ID Computation
// =============================================================================

import { keccak256, encodeAbiParameters } from 'viem';

/**
 * Compute the Uniswap v4 PoolId from a PoolKey.
 * PoolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
 */
export function computePoolId(
    currency0: string,
    currency1: string,
    fee: number,
    tickSpacing: number,
    hooks: string
): `0x${string}` {
    // Ensure currency0 < currency1
    let c0 = currency0;
    let c1 = currency1;
    if (c0.toLowerCase() > c1.toLowerCase()) {
        [c0, c1] = [c1, c0];
    }
    return keccak256(
        encodeAbiParameters(
            [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' },
            ],
            [
                c0 as `0x${string}`,
                c1 as `0x${string}`,
                fee,
                tickSpacing,
                hooks as `0x${string}`,
            ]
        )
    );
}

// =============================================================================
// Etherscan Links
// =============================================================================

export const ETHERSCAN_BASE = 'https://sepolia.etherscan.io';

export function getEtherscanLink(type: 'address' | 'tx', value: string): string {
    return `${ETHERSCAN_BASE}/${type}/${value}`;
}

export function getContractLink(contract: keyof typeof CONTRACTS): string {
    const value = CONTRACTS[contract];
    if (typeof value === 'string') {
        return getEtherscanLink('address', value);
    }
    return ''; // Return empty for non-address values like TICK_SPACING
}

export function getTokenLink(token: keyof typeof MOCK_TOKENS): string {
    return getEtherscanLink('address', MOCK_TOKENS[token]);
}

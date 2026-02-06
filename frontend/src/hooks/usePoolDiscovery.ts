'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import {
    CONTRACTS,
    MOCK_TOKENS,
    POSITION_MANAGER_ABI,
    STATE_VIEW_ABI,
    computePoolId,
} from '@/lib/contracts';

// ============================================================================
// Types
// ============================================================================

export interface PoolInfo {
    /** Unique pool key hash (bytes32) */
    poolId: `0x${string}`;
    /** Stock token symbol (e.g. "tAAPL") */
    tokenSymbol: string;
    /** Display name (e.g. "AAPL/USDC") */
    name: string;
    /** Currency0 address (lower) */
    currency0: string;
    /** Currency1 address (upper) */
    currency1: string;
    /** On-chain liquidity (from StateView) */
    liquidity: bigint;
    /** sqrtPriceX96 from slot0 */
    sqrtPriceX96: bigint;
    /** Current tick */
    tick: number;
    /** Whether the pool exists on-chain (slot0 != 0) */
    existsOnChain: boolean;
    /** Unix timestamp when pool was added locally */
    createdAt: number;
    /** Position token IDs owned by user in this pool */
    positionTokenIds: bigint[];
}

// ============================================================================
// LocalStorage helpers
// ============================================================================

const STORAGE_KEY = 'stockshield_pools';

interface StoredPool {
    poolId: `0x${string}`;
    tokenSymbol: string;
    currency0: string;
    currency1: string;
    createdAt: number;
}


// ============================================================================
// Known pools — pre-computed from token addresses
// ============================================================================

/** All possible StockShield pool keys (token/USDC pairs) */
function getKnownPoolKeys(): StoredPool[] {
    const usdcAddr = MOCK_TOKENS.USDC;
    const tokens = [
        { key: 'tAAPL' as const, addr: MOCK_TOKENS.tAAPL },
        { key: 'tTSLA' as const, addr: MOCK_TOKENS.tTSLA },
        { key: 'tNVDA' as const, addr: MOCK_TOKENS.tNVDA },
        { key: 'tGOOGL' as const, addr: MOCK_TOKENS.tGOOGL },
        { key: 'tMSFT' as const, addr: MOCK_TOKENS.tMSFT },
    ];

    return tokens.map(({ key, addr }) => {
        const [c0, c1] =
            addr.toLowerCase() < usdcAddr.toLowerCase()
                ? [addr, usdcAddr]
                : [usdcAddr, addr];

        const poolId = computePoolId(
            c0,
            c1,
            CONTRACTS.LP_FEE,
            CONTRACTS.TICK_SPACING,
            CONTRACTS.STOCK_SHIELD_HOOK
        );

        return {
            poolId,
            tokenSymbol: key,
            currency0: c0,
            currency1: c1,
            createdAt: 0,
        };
    });
}

// ============================================================================
// Hook
// ============================================================================

// ============================================================================
// Hook
// ============================================================================

export function usePoolDiscovery() {
    const { address, isConnected } = useAccount();
    const [pools, setPools] = useState<PoolInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [storedPools, setStoredPools] = useState<StoredPool[]>([]);

    // Load stored pools on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                setStoredPools(JSON.parse(raw) as StoredPool[]);
            }
        } catch (error) {
            console.error('Failed to load stored pools:', error);
        }
    }, []);

    const saveStoredPools = (newPools: StoredPool[]) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newPools));
            setStoredPools(newPools);
        } catch (error) {
            console.error('Failed to save stored pools:', error);
        }
    };

    // Combine known pool keys with any localStorage-saved ones
    const allPoolKeys = getKnownPoolKeys();

    // Merge: stored pools override known pool createdAt
    const mergedKeys = allPoolKeys.map((known) => {
        const stored = storedPools.find(
            (s) => s.poolId.toLowerCase() === known.poolId.toLowerCase()
        );
        return stored ? { ...known, createdAt: stored.createdAt } : known;
    });

    // ── Read slot0 for ALL possible pools to check which exist ──────────────
    const slot0Contracts = mergedKeys.map((pool) => ({
        address: CONTRACTS.STATE_VIEW as `0x${string}`,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0' as const,
        args: [pool.poolId] as const,
        chainId: 11155111 as const,
    }));

    const { data: slot0Results, refetch: refetchSlot0 } = useReadContracts({
        contracts: slot0Contracts,
    });

    // ── Read liquidity for ALL possible pools ───────────────────────────────
    const liquidityContracts = mergedKeys.map((pool) => ({
        address: CONTRACTS.STATE_VIEW as `0x${string}`,
        abi: STATE_VIEW_ABI,
        functionName: 'getLiquidity' as const,
        args: [pool.poolId] as const,
        chainId: 11155111 as const,
    }));

    const { data: liquidityResults, refetch: refetchLiquidity } = useReadContracts({
        contracts: liquidityContracts,
    });

    // ── Read user's position count from PositionManager ─────────────────────
    const { data: positionCount } = useReadContract({
        address: CONTRACTS.POSITION_MANAGER as `0x${string}`,
        abi: POSITION_MANAGER_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        chainId: 11155111,
        query: { enabled: !!address },
    });

    // ── Build pool list from on-chain data ──────────────────────────────────
    useEffect(() => {
        if (!slot0Results || !liquidityResults) return;

        const discoveredPools: PoolInfo[] = [];

        for (let i = 0; i < mergedKeys.length; i++) {
            const key = mergedKeys[i]!;
            const slot0 = slot0Results[i];
            const liq = liquidityResults[i];

            // Check if pool exists on-chain (sqrtPriceX96 != 0)
            let sqrtPriceX96 = BigInt(0);
            let tick = 0;
            let existsOnChain = false;

            if (slot0?.status === 'success' && slot0.result) {
                const result = slot0.result as readonly [bigint, number, number, number];
                sqrtPriceX96 = result[0];
                tick = result[1];
                existsOnChain = sqrtPriceX96 > BigInt(0);
            }

            let liquidity = BigInt(0);
            if (liq?.status === 'success' && liq.result) {
                liquidity = liq.result as bigint;
            }

            // Only include pools that exist on-chain
            if (existsOnChain) {
                const displaySymbol = key.tokenSymbol.replace('t', '');
                discoveredPools.push({
                    poolId: key.poolId,
                    tokenSymbol: key.tokenSymbol,
                    name: `${displaySymbol}/USDC`,
                    currency0: key.currency0,
                    currency1: key.currency1,
                    liquidity,
                    sqrtPriceX96,
                    tick,
                    existsOnChain,
                    createdAt: key.createdAt || Date.now(),
                    positionTokenIds: [],
                });
            }
        }

        setPools(discoveredPools);
        setIsLoading(false);
    }, [slot0Results, liquidityResults]);

    // ── Save a newly created pool to localStorage ───────────────────────────
    const savePool = useCallback(
        (tokenSymbol: string, currency0: string, currency1: string) => {
            const poolId = computePoolId(
                currency0,
                currency1,
                CONTRACTS.LP_FEE,
                CONTRACTS.TICK_SPACING,
                CONTRACTS.STOCK_SHIELD_HOOK
            );

            const newPool: StoredPool = {
                poolId,
                tokenSymbol,
                currency0,
                currency1,
                createdAt: Date.now(),
            };

            const existing = storedPools;
            if (!existing.find((p) => p.poolId.toLowerCase() === poolId.toLowerCase())) {
                saveStoredPools([...existing, newPool]);
            }
        },
        [storedPools]
    );

    // ── Refetch on-chain data ───────────────────────────────────────────────
    const refetch = useCallback(() => {
        refetchSlot0();
        refetchLiquidity();
    }, [refetchSlot0, refetchLiquidity]);

    return {
        pools,
        isLoading,
        positionCount: positionCount ? Number(positionCount) : 0,
        savePool,
        refetch,
    };
}

'use client';

/**
 * Pool ENS Name Hook
 * 
 * Provides ENS name resolution specifically for StockShield pools.
 * Resolves pool token symbols to ENS names like "aapl.stockshield.eth".
 * 
 * Uses real wagmi hooks (useEnsAddress, useEnsText) — NOT hardcoded.
 */

import { useState, useEffect } from 'react';
import {
    getPoolENSName,
    usePoolENSData,
    truncateAddress,
    POOL_ENS_NAMES,
    type ENSNameInfo,
    type PoolENSData,
} from './useENS';

// ============================================================================
// Types
// ============================================================================

export interface PoolENSInfo extends ENSNameInfo {
    /** Pool ID (bytes32 hash) */
    poolId: string;
    /** Whether the data is from cache */
    fromCache: boolean;
    /** Full ENS resolution data including text records */
    ensData: PoolENSData | null;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get ENS name for a single pool.
 * Uses real wagmi ENS hooks to resolve the name and read text records.
 */
export function usePoolENS(poolId: string | undefined, tokenSymbol: string | undefined): PoolENSInfo | null {
    // Use real ENS resolution via wagmi hooks
    const ensData = usePoolENSData(tokenSymbol);

    if (!poolId || !tokenSymbol) return null;

    const ensName = getPoolENSName(tokenSymbol);

    return {
        name: ensName,
        displayName: ensName,
        isVerified: ensData.isRegistered,
        namespace: 'POOLS',
        poolId,
        fromCache: false,
        ensData,
    };
}

/**
 * Hook to get ENS names for multiple pools.
 * Each pool resolves independently via wagmi hooks.
 */
export function usePoolsENS(pools: Array<{ poolId: string; tokenSymbol: string }>): Map<string, PoolENSInfo> {
    const [ensMap, setEnsMap] = useState<Map<string, PoolENSInfo>>(new Map());

    useEffect(() => {
        if (pools.length === 0) {
            setEnsMap(new Map());
            return;
        }

        const newMap = new Map<string, PoolENSInfo>();

        for (const { poolId, tokenSymbol } of pools) {
            const ensName = getPoolENSName(tokenSymbol);
            newMap.set(poolId, {
                name: ensName,
                displayName: ensName,
                isVerified: tokenSymbol in POOL_ENS_NAMES,
                namespace: 'POOLS',
                poolId,
                fromCache: false,
                ensData: null,
            });
        }

        setEnsMap(newMap);
    }, [pools]);

    return ensMap;
}

/**
 * Get formatted display name for a pool — always the ENS name.
 */
export function getPoolDisplayName(
    poolId: string,
    tokenSymbol: string,
): string {
    if (tokenSymbol) {
        return getPoolENSName(tokenSymbol);
    }
    return truncateAddress(poolId);
}

/**
 * Clear the pool ENS cache (legacy — cache removed in favor of live resolution)
 */
export function clearPoolENSCache(): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem('stockshield_pool_ens_cache');
    } catch (error) {
        console.error('Failed to clear pool ENS cache:', error);
    }
}

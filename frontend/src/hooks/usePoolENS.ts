'use client';

/**
 * Pool ENS Name Hook
 * 
 * Provides ENS name resolution specifically for StockShield pools.
 * Resolves pool addresses to names like "aapl.pools.stockshield.eth".
 */

import { useState, useEffect, useCallback } from 'react';
import { generatePoolENSName, parseENSName, truncateAddress, ENS_NAMESPACES, type ENSNameInfo } from './useENS';

// ============================================================================
// Constants
// ============================================================================

const POOL_ENS_CACHE_KEY = 'stockshield_pool_ens_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// Types
// ============================================================================

interface CachedPoolENS {
    poolId: string;
    ensName: string;
    displayName: string;
    isVerified: boolean;
    cachedAt: number;
}

interface PoolENSCache {
    [poolId: string]: CachedPoolENS;
}

export interface PoolENSInfo extends ENSNameInfo {
    /** Pool ID (bytes32 hash) */
    poolId: string;
    /** Whether the name is from cache */
    fromCache: boolean;
}

// ============================================================================
// Cache Helpers
// ============================================================================

function loadCache(): PoolENSCache {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(POOL_ENS_CACHE_KEY);
        if (!raw) return {};
        const cache = JSON.parse(raw) as PoolENSCache;

        // Filter out expired entries
        const now = Date.now();
        const validCache: PoolENSCache = {};
        for (const [poolId, entry] of Object.entries(cache)) {
            if (now - entry.cachedAt < CACHE_TTL_MS) {
                validCache[poolId] = entry;
            }
        }
        return validCache;
    } catch {
        return {};
    }
}

function saveCache(cache: PoolENSCache): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(POOL_ENS_CACHE_KEY, JSON.stringify(cache));
    } catch (error) {
        console.error('Failed to save pool ENS cache:', error);
    }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to get ENS name for a single pool
 */
export function usePoolENS(poolId: string | undefined, tokenSymbol: string | undefined): PoolENSInfo | null {
    const [info, setInfo] = useState<PoolENSInfo | null>(null);

    useEffect(() => {
        if (!poolId || !tokenSymbol) {
            setInfo(null);
            return;
        }

        // Check cache first
        const cache = loadCache();
        const cached = cache[poolId];

        if (cached) {
            setInfo({
                name: cached.ensName,
                displayName: cached.displayName,
                isVerified: cached.isVerified,
                namespace: 'POOLS',
                poolId,
                fromCache: true,
            });
            return;
        }

        // Generate ENS name from token symbol
        const ensName = generatePoolENSName(tokenSymbol);
        const parsed = parseENSName(ensName);

        // For now, we mark as verified if it follows our naming convention
        // In production, this would check on-chain registration
        const isVerified = true;

        const newInfo: PoolENSInfo = {
            name: ensName,
            displayName: parsed.displayName,
            isVerified,
            namespace: 'POOLS',
            poolId,
            fromCache: false,
        };

        // Cache the result
        cache[poolId] = {
            poolId,
            ensName,
            displayName: parsed.displayName,
            isVerified,
            cachedAt: Date.now(),
        };
        saveCache(cache);

        setInfo(newInfo);
    }, [poolId, tokenSymbol]);

    return info;
}

/**
 * Hook to get ENS names for multiple pools
 */
export function usePoolsENS(pools: Array<{ poolId: string; tokenSymbol: string }>): Map<string, PoolENSInfo> {
    const [ensMap, setEnsMap] = useState<Map<string, PoolENSInfo>>(new Map());

    useEffect(() => {
        if (pools.length === 0) {
            setEnsMap(new Map());
            return;
        }

        const cache = loadCache();
        const newMap = new Map<string, PoolENSInfo>();
        let cacheUpdated = false;

        for (const pool of pools) {
            const { poolId, tokenSymbol } = pool;

            // Check cache
            const cached = cache[poolId];
            if (cached) {
                newMap.set(poolId, {
                    name: cached.ensName,
                    displayName: cached.displayName,
                    isVerified: cached.isVerified,
                    namespace: 'POOLS',
                    poolId,
                    fromCache: true,
                });
                continue;
            }

            // Generate ENS name
            const ensName = generatePoolENSName(tokenSymbol);
            const parsed = parseENSName(ensName);
            const isVerified = true;

            newMap.set(poolId, {
                name: ensName,
                displayName: parsed.displayName,
                isVerified,
                namespace: 'POOLS',
                poolId,
                fromCache: false,
            });

            // Cache it
            cache[poolId] = {
                poolId,
                ensName,
                displayName: parsed.displayName,
                isVerified,
                cachedAt: Date.now(),
            };
            cacheUpdated = true;
        }

        if (cacheUpdated) {
            saveCache(cache);
        }

        setEnsMap(newMap);
    }, [pools]);

    return ensMap;
}

/**
 * Get formatted display name for a pool
 * Returns ENS name if available, otherwise truncated address
 */
export function getPoolDisplayName(
    poolId: string,
    tokenSymbol: string,
    preferENS = true
): string {
    if (preferENS && tokenSymbol) {
        const ensName = generatePoolENSName(tokenSymbol);
        const parsed = parseENSName(ensName);
        return parsed.displayName;
    }
    return truncateAddress(poolId);
}

/**
 * Clear the pool ENS cache
 */
export function clearPoolENSCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(POOL_ENS_CACHE_KEY);
}

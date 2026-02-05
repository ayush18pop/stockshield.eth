'use client';

/**
 * StockShield API Hooks
 * 
 * React hooks for fetching data from the StockShield backend.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    api,
    WS_URL,
    RegimeResponse,
    VPINResponse,
    PriceResponse,
    FeeResponse,
    PoolsResponse,
    CircuitBreakerResponse,
    AuctionsResponse,
    HealthResponse
} from '@/lib/api';

// ============================================================================
// Generic Fetch Hook
// ============================================================================

interface UseFetchState<T> {
    data: T | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => void;
}

function useFetch<T>(
    fetcher: () => Promise<T>,
    deps: unknown[] = [],
    pollInterval?: number
): UseFetchState<T> {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const fetch = useCallback(async () => {
        try {
            setError(null);
            const result = await fetcher();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [fetcher]);

    useEffect(() => {
        fetch();

        if (pollInterval) {
            const interval = setInterval(fetch, pollInterval);
            return () => clearInterval(interval);
        }
        return undefined;
    }, [...deps, fetch, pollInterval]); // eslint-disable-line react-hooks/exhaustive-deps

    return { data, isLoading, error, refetch: fetch };
}

// ============================================================================
// Specific Hooks
// ============================================================================

/**
 * Hook for current market regime
 */
export function useRegime(pollInterval: number = 30000) {
    return useFetch<RegimeResponse>(() => api.getRegime(), [], pollInterval);
}

/**
 * Hook for VPIN score
 */
export function useVPIN(poolId: string, pollInterval: number = 5000) {
    return useFetch<VPINResponse>(() => api.getVPIN(poolId), [poolId], pollInterval);
}

/**
 * Hook for oracle price
 */
export function usePrice(asset: string, pollInterval: number = 10000) {
    return useFetch<PriceResponse>(() => api.getPrice(asset), [asset], pollInterval);
}

/**
 * Hook for dynamic fee
 */
export function useFee(poolId: string, pollInterval: number = 5000) {
    return useFetch<FeeResponse>(() => api.getFees(poolId), [poolId], pollInterval);
}

/**
 * Hook for all pools
 */
export function usePools(pollInterval: number = 30000) {
    return useFetch<PoolsResponse>(() => api.getPools(), [], pollInterval);
}

/**
 * Hook for circuit breaker status
 */
export function useCircuitBreaker(pollInterval: number = 10000) {
    return useFetch<CircuitBreakerResponse>(() => api.getCircuitBreaker(), [], pollInterval);
}

/**
 * Hook for active auctions
 */
export function useActiveAuctions(pollInterval: number = 5000) {
    return useFetch<AuctionsResponse>(() => api.getActiveAuctions(), [], pollInterval);
}

/**
 * Hook for checking API health
 */
export function useHealth() {
    return useFetch<HealthResponse>(() => api.getHealth(), [], 60000);
}

// ============================================================================
// WebSocket Hook for Real-Time Updates
// ============================================================================

interface WebSocketMessage {
    type: string;
    data?: unknown;
    poolId?: string;
    vpin?: number;
    regime?: string;
    level?: number;
    from?: string;
    to?: string;
}

export function useWebSocket(channels: string[] = ['vpin', 'regime', 'prices']) {
    const [connected, setConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
    const [vpinUpdates, setVpinUpdates] = useState<Map<string, number>>(new Map());
    const [currentRegime, setCurrentRegime] = useState<string | null>(null);

    useEffect(() => {
        let socket: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connect = () => {
            try {
                socket = new WebSocket(WS_URL);

                socket.onopen = () => {
                    setConnected(true);
                    // Subscribe to channels
                    socket?.send(JSON.stringify({
                        type: 'subscribe',
                        channels,
                    }));
                };

                socket.onmessage = (event) => {
                    try {
                        const message: WebSocketMessage = JSON.parse(event.data);
                        setLastMessage(message);

                        // Handle specific message types
                        if (message.type === 'vpin:update' && message.poolId && message.vpin !== undefined) {
                            setVpinUpdates(prev => new Map(prev).set(message.poolId!, message.vpin!));
                        }
                        if (message.type === 'regime:change' && message.to) {
                            setCurrentRegime(message.to);
                        }
                    } catch {
                        console.warn('Failed to parse WebSocket message');
                    }
                };

                socket.onclose = () => {
                    setConnected(false);
                    // Reconnect after 3 seconds
                    reconnectTimeout = setTimeout(connect, 3000);
                };

                socket.onerror = () => {
                    socket?.close();
                };

            } catch {
                // Retry connection
                reconnectTimeout = setTimeout(connect, 3000);
            }
        };

        connect();

        return () => {
            clearTimeout(reconnectTimeout);
            socket?.close();
        };
    }, [channels.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        connected,
        lastMessage,
        vpinUpdates,
        currentRegime,
    };
}

// ============================================================================
// Combined Hook for Dashboard
// ============================================================================

export interface DashboardData {
    regime: RegimeResponse | null;
    vpin: VPINResponse | null;
    circuitBreaker: CircuitBreakerResponse | null;
    pools: PoolsResponse | null;
    isLoading: boolean;
    error: Error | null;
}

export function useDashboard(poolId: string = '0xdefault'): DashboardData {
    const regime = useRegime();
    const vpin = useVPIN(poolId);
    const circuitBreaker = useCircuitBreaker();
    const pools = usePools();

    return {
        regime: regime.data,
        vpin: vpin.data,
        circuitBreaker: circuitBreaker.data,
        pools: pools.data,
        isLoading: regime.isLoading || vpin.isLoading || circuitBreaker.isLoading || pools.isLoading,
        error: regime.error || vpin.error || circuitBreaker.error || pools.error,
    };
}


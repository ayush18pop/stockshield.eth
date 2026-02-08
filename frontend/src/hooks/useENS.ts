'use client';

/**
 * ENS Resolution Hook
 * 
 * Provides ENS name resolution and reverse lookup functionality.
 * Integrates with StockShield's ENS domain structure.
 */

import { useEffect, useState, useCallback } from 'react';
import { useEnsName, useEnsAddress } from 'wagmi';
import { normalize } from 'viem/ens';

// ============================================================================
// Constants
// ============================================================================

/** StockShield ENS root domain */
export const ENS_ROOT = 'stockshield.eth';

/** Subdomains for different namespaces */
export const ENS_NAMESPACES = {
    POOLS: `pools.${ENS_ROOT}`,
    VAULTS: `vaults.${ENS_ROOT}`,
    TRADERS: `traders.${ENS_ROOT}`,
    REGISTRY: `registry.${ENS_ROOT}`,
    ORACLES: `oracles.${ENS_ROOT}`,
} as const;

// ============================================================================
// Types
// ============================================================================

export interface ENSNameInfo {
    /** Full ENS name (e.g., "aapl.pools.stockshield.eth") */
    name: string;
    /** Short display name (e.g., "AAPL Pool") */
    displayName: string;
    /** Whether the name is verified/registered */
    isVerified: boolean;
    /** Namespace (pools, vaults, traders) */
    namespace: keyof typeof ENS_NAMESPACES | null;
}

export interface UseENSOptions {
    /** Enable automatic resolution */
    enabled?: boolean;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to resolve an address to its ENS name
 */
export function useENSName(address: `0x${string}` | undefined, options: UseENSOptions = {}) {
    const { enabled = true } = options;

    const { data: ensName, isLoading, error } = useEnsName({
        address,
        chainId: 1, // ENS is on mainnet
        query: {
            enabled: enabled && !!address,
        },
    });

    return {
        name: ensName || null,
        isLoading,
        error,
    };
}

/**
 * Hook to resolve an ENS name to an address
 */
export function useENSAddress(name: string | undefined, options: UseENSOptions = {}) {
    const { enabled = true } = options;

    const normalizedName = name ? normalize(name) : undefined;

    const { data: address, isLoading, error } = useEnsAddress({
        name: normalizedName,
        chainId: 1, // ENS is on mainnet
        query: {
            enabled: enabled && !!normalizedName,
        },
    });

    return {
        address: address || null,
        isLoading,
        error,
    };
}

/**
 * Parse an ENS name to extract namespace and identifier
 */
export function parseENSName(fullName: string): ENSNameInfo {
    const normalized = fullName.toLowerCase();

    // Check which namespace this belongs to
    let namespace: keyof typeof ENS_NAMESPACES | null = null;
    let identifier = '';

    for (const [key, suffix] of Object.entries(ENS_NAMESPACES)) {
        if (normalized.endsWith(`.${suffix.toLowerCase()}`)) {
            namespace = key as keyof typeof ENS_NAMESPACES;
            identifier = normalized.replace(`.${suffix.toLowerCase()}`, '');
            break;
        }
    }

    // Generate display name based on namespace
    let displayName = fullName;
    if (namespace === 'POOLS' && identifier) {
        displayName = `${identifier.toUpperCase()} Pool`;
    } else if (namespace === 'VAULTS' && identifier) {
        displayName = `Vault ${identifier}`;
    } else if (namespace === 'TRADERS' && identifier) {
        displayName = identifier;
    }

    return {
        name: fullName,
        displayName,
        isVerified: namespace !== null,
        namespace,
    };
}

/**
 * Generate a StockShield ENS name for a given namespace and identifier
 */
export function generateENSName(
    namespace: keyof typeof ENS_NAMESPACES,
    identifier: string
): string {
    const suffix = ENS_NAMESPACES[namespace];
    const normalizedId = identifier.toLowerCase().replace(/[^a-z0-9-]/g, '');
    return `${normalizedId}.${suffix}`;
}

/**
 * Truncate an address for display (e.g., "0x1234...5678")
 */
export function truncateAddress(address: string, chars = 4): string {
    if (!address) return '';
    if (address.length <= chars * 2 + 2) return address;
    return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format a pool identifier for ENS (e.g., "tAAPL" → "aapl")
 */
export function formatPoolIdentifier(tokenSymbol: string): string {
    return tokenSymbol
        .toLowerCase()
        .replace(/^t/, '') // Remove leading 't' from tokenized symbols
        .replace(/[^a-z0-9]/g, ''); // Remove special characters
}

/**
 * Generate pool ENS name from token symbol
 */
export function generatePoolENSName(tokenSymbol: string): string {
    const identifier = formatPoolIdentifier(tokenSymbol);
    return generateENSName('POOLS', identifier);
}

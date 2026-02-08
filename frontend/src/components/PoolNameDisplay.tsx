'use client';

/**
 * Pool Name Display Component
 * 
 * Displays pool ENS name instead of address, with fallback to truncated address.
 * Includes copy-to-clipboard functionality and ENS verification badge.
 */

import { useState, useCallback } from 'react';
import { Check, Copy, ExternalLink, Shield } from 'lucide-react';
import { usePoolENS, getPoolDisplayName } from '@/hooks/usePoolENS';
import { truncateAddress, ENS_ROOT } from '@/hooks/useENS';

// ============================================================================
// Types
// ============================================================================

interface PoolNameDisplayProps {
    /** Pool ID (bytes32 hash) */
    poolId: string;
    /** Token symbol (e.g., "tAAPL") */
    tokenSymbol: string;
    /** Show full ENS name or just display name */
    showFullName?: boolean;
    /** Show the pool address on hover */
    showAddressOnHover?: boolean;
    /** Show copy button */
    showCopy?: boolean;
    /** Show verified badge */
    showBadge?: boolean;
    /** Custom className */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Component
// ============================================================================

export function PoolNameDisplay({
    poolId,
    tokenSymbol,
    showFullName = false,
    showAddressOnHover = true,
    showCopy = true,
    showBadge = true,
    className = '',
    size = 'md',
}: PoolNameDisplayProps) {
    const [copied, setCopied] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const poolENS = usePoolENS(poolId, tokenSymbol);

    const handleCopy = useCallback(async () => {
        const textToCopy = poolENS?.name || poolId;
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }, [poolENS?.name, poolId]);

    // Size classes
    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    const iconSizes = {
        sm: 12,
        md: 14,
        lg: 16,
    };

    const displayText = showFullName
        ? (poolENS?.name || truncateAddress(poolId))
        : (poolENS?.displayName || getPoolDisplayName(poolId, tokenSymbol));

    return (
        <div
            className={`inline-flex items-center gap-1.5 group ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* ENS Badge */}
            {showBadge && poolENS?.isVerified && (
                <div
                    className="flex-shrink-0"
                    title="Verified StockShield Pool"
                >
                    <Shield
                        size={iconSizes[size]}
                        className="text-[#FF6B00] fill-[#FF6B00]/20"
                    />
                </div>
            )}

            {/* Name Display */}
            <span className={`font-mono ${sizeClasses[size]} text-white`}>
                {displayText}
            </span>

            {/* Address on Hover */}
            {showAddressOnHover && isHovered && (
                <span className={`${sizeClasses[size]} text-gray-500 transition-opacity`}>
                    ({truncateAddress(poolId, 4)})
                </span>
            )}

            {/* Copy Button */}
            {showCopy && (
                <button
                    onClick={handleCopy}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                    title={copied ? 'Copied!' : 'Copy ENS name'}
                >
                    {copied ? (
                        <Check size={iconSizes[size]} className="text-green-500" />
                    ) : (
                        <Copy size={iconSizes[size]} className="text-gray-400" />
                    )}
                </button>
            )}
        </div>
    );
}

// ============================================================================
// Compact Variant
// ============================================================================

interface PoolNameBadgeProps {
    /** Pool ID (bytes32 hash) */
    poolId: string;
    /** Token symbol (e.g., "tAAPL") */
    tokenSymbol: string;
    /** Custom className */
    className?: string;
}

/**
 * Compact badge-style pool name display
 */
export function PoolNameBadge({
    poolId,
    tokenSymbol,
    className = '',
}: PoolNameBadgeProps) {
    const poolENS = usePoolENS(poolId, tokenSymbol);

    return (
        <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 bg-[#FF6B00]/10 
                        border border-[#FF6B00]/30 rounded-full ${className}`}
            title={poolENS?.name || poolId}
        >
            <Shield size={10} className="text-[#FF6B00]" />
            <span className="text-xs font-mono text-[#FF6B00]">
                {poolENS?.displayName || truncateAddress(poolId, 3)}
            </span>
        </div>
    );
}

// ============================================================================
// Pool Link Variant
// ============================================================================

interface PoolNameLinkProps {
    /** Pool ID (bytes32 hash) */
    poolId: string;
    /** Token symbol (e.g., "tAAPL") */
    tokenSymbol: string;
    /** Click handler */
    onClick?: () => void;
    /** Custom className */
    className?: string;
}

/**
 * Clickable pool name with link styling
 */
export function PoolNameLink({
    poolId,
    tokenSymbol,
    onClick,
    className = '',
}: PoolNameLinkProps) {
    const poolENS = usePoolENS(poolId, tokenSymbol);

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 text-[#FF6B00] hover:text-[#FF8533] 
                        transition-colors group ${className}`}
        >
            <Shield size={14} className="text-[#FF6B00]" />
            <span className="font-mono text-sm underline-offset-2 group-hover:underline">
                {poolENS?.name || truncateAddress(poolId)}
            </span>
            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
}

export default PoolNameDisplay;

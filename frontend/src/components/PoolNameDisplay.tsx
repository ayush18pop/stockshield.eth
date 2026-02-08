'use client';

/**
 * Pool Name Display Component
 * 
 * Displays pool ENS name (e.g. "aapl.stockshield.eth") with verification badge.
 * Uses real wagmi ENS hooks for live resolution — not hardcoded.
 */

import { useState, useCallback } from 'react';
import { Check, Copy, ExternalLink, Shield, Loader2, Globe } from 'lucide-react';
import { usePoolENS, getPoolDisplayName } from '@/hooks/usePoolENS';
import { truncateAddress, usePoolENSData } from '@/hooks/useENS';

// ============================================================================
// Types
// ============================================================================

interface PoolNameDisplayProps {
    /** Pool ID (bytes32 hash) */
    poolId: string;
    /** Token symbol (e.g., "tAAPL") */
    tokenSymbol: string;
    /** Show the pool address on hover */
    showAddressOnHover?: boolean;
    /** Show copy button */
    showCopy?: boolean;
    /** Show verified badge */
    showBadge?: boolean;
    /** Show ENS text records tooltip */
    showTextRecords?: boolean;
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
    showAddressOnHover = true,
    showCopy = true,
    showBadge = true,
    showTextRecords = false,
    className = '',
    size = 'md',
}: PoolNameDisplayProps) {
    const [copied, setCopied] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const poolENS = usePoolENS(poolId, tokenSymbol);
    const ensData = usePoolENSData(tokenSymbol);

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

    // Always show ENS name (e.g. "aapl.stockshield.eth")
    const displayText = poolENS?.name || getPoolDisplayName(poolId, tokenSymbol);

    return (
        <div
            className={`inline-flex items-center gap-1.5 group ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* ENS Badge */}
            {showBadge && (
                <div
                    className="flex-shrink-0"
                    title={ensData.isRegistered
                        ? 'Verified on ENS — click to view records'
                        : 'StockShield Pool (ENS pending)'
                    }
                >
                    {ensData.isLoading ? (
                        <Loader2 size={iconSizes[size]} className="text-neutral-500 animate-spin" />
                    ) : ensData.isRegistered ? (
                        <Globe size={iconSizes[size]} className="text-[#5298FF]" />
                    ) : (
                        <Shield size={iconSizes[size]} className="text-[#FF6B00] fill-[#FF6B00]/20" />
                    )}
                </div>
            )}

            {/* ENS Name Display */}
            <span className={`font-mono ${sizeClasses[size]} ${ensData.isRegistered ? 'text-[#5298FF]' : 'text-white'}`}>
                {displayText}
            </span>

            {/* Address on Hover */}
            {showAddressOnHover && isHovered && (
                <span className={`${sizeClasses[size]} text-gray-500 transition-opacity`}>
                    ({truncateAddress(poolId, 4)})
                </span>
            )}

            {/* Text Records Tooltip */}
            {showTextRecords && isHovered && ensData.isRegistered && (
                <div className="absolute z-50 mt-1 top-full left-0 bg-[#0a0a0a] border border-white/10 rounded-lg p-3 text-xs space-y-1 min-w-[250px] shadow-xl">
                    <div className="text-neutral-500 font-medium mb-2">ENS Text Records</div>
                    {ensData.textRecords.ticker && (
                        <div className="flex justify-between">
                            <span className="text-neutral-500">pool.ticker</span>
                            <span className="text-white font-mono">{ensData.textRecords.ticker}</span>
                        </div>
                    )}
                    {ensData.textRecords.exchange && (
                        <div className="flex justify-between">
                            <span className="text-neutral-500">pool.exchange</span>
                            <span className="text-white font-mono">{ensData.textRecords.exchange}</span>
                        </div>
                    )}
                    {ensData.textRecords.hook && (
                        <div className="flex justify-between">
                            <span className="text-neutral-500">pool.hook</span>
                            <span className="text-white font-mono">{truncateAddress(ensData.textRecords.hook)}</span>
                        </div>
                    )}
                </div>
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
// Compact Badge Variant — shows ENS name in a styled badge
// ============================================================================

interface PoolNameBadgeProps {
    poolId: string;
    tokenSymbol: string;
    className?: string;
}

/**
 * Compact badge showing pool ENS name (e.g. "aapl.stockshield.eth")
 */
export function PoolNameBadge({
    poolId,
    tokenSymbol,
    className = '',
}: PoolNameBadgeProps) {
    const poolENS = usePoolENS(poolId, tokenSymbol);
    const ensData = usePoolENSData(tokenSymbol);

    return (
        <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 
                        ${ensData.isRegistered
                    ? 'bg-[#5298FF]/10 border border-[#5298FF]/30'
                    : 'bg-[#FF6B00]/10 border border-[#FF6B00]/30'
                }
                        rounded-full ${className}`}
            title={poolENS?.name || poolId}
        >
            {ensData.isLoading ? (
                <Loader2 size={10} className="text-neutral-500 animate-spin" />
            ) : ensData.isRegistered ? (
                <Globe size={10} className="text-[#5298FF]" />
            ) : (
                <Shield size={10} className="text-[#FF6B00]" />
            )}
            <span className={`text-xs font-mono ${ensData.isRegistered ? 'text-[#5298FF]' : 'text-[#FF6B00]'}`}>
                {poolENS?.name || truncateAddress(poolId, 3)}
            </span>
        </div>
    );
}

// ============================================================================
// Pool Link Variant
// ============================================================================

interface PoolNameLinkProps {
    poolId: string;
    tokenSymbol: string;
    onClick?: () => void;
    className?: string;
}

/**
 * Clickable pool name with link styling — shows ENS name
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
            className={`inline-flex items-center gap-1.5 text-[#5298FF] hover:text-[#7BB3FF] 
                        transition-colors group ${className}`}
        >
            <Globe size={14} className="text-[#5298FF]" />
            <span className="font-mono text-sm underline-offset-2 group-hover:underline">
                {poolENS?.name || truncateAddress(poolId)}
            </span>
            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
}

export default PoolNameDisplay;

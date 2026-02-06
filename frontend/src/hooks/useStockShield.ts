
import { useReadContract } from 'wagmi';
import { CONTRACTS, REGIME_ORACLE_ABI, STOCK_SHIELD_HOOK_ABI, GAP_AUCTION_ABI, MOCK_TOKENS, computePoolId } from '@/lib/contracts';
import { Address } from 'viem';

/**
 * Compute real pool IDs from token addresses.
 * PoolId = keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
 */
function getPoolId(tokenSymbol: string): `0x${string}` {
    const tokenKey = `t${tokenSymbol}` as keyof typeof MOCK_TOKENS;
    const stockAddr = MOCK_TOKENS[tokenKey] || MOCK_TOKENS[tokenSymbol as keyof typeof MOCK_TOKENS];
    if (!stockAddr) {
        // Fallback: return zero bytes32
        return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    const usdcAddr = MOCK_TOKENS.USDC;

    return computePoolId(
        stockAddr,
        usdcAddr,
        CONTRACTS.LP_FEE,
        CONTRACTS.TICK_SPACING,
        CONTRACTS.STOCK_SHIELD_HOOK
    );
}

export type Regime = 'Core Session' | 'Soft Open' | 'Pre-Market' | 'After Hours' | 'Overnight' | 'Weekend' | 'Holiday';

const REGIME_LABELS: Record<number, Regime> = {
    0: 'Core Session',
    1: 'Soft Open',
    2: 'Pre-Market',
    3: 'After Hours',
    4: 'Overnight',
    5: 'Weekend',
    6: 'Holiday',
};

export function useStockShield(tokenSymbol: string = 'tAAPL') {
    // 1. Read Regime from Oracle
    const { data: regimeId, refetch: refetchRegime } = useReadContract({
        address: CONTRACTS.REGIME_ORACLE,
        abi: REGIME_ORACLE_ABI,
        functionName: 'getCurrentRegime',
        chainId: 11155111,
    });

    const { data: nextTransition } = useReadContract({
        address: CONTRACTS.REGIME_ORACLE,
        abi: REGIME_ORACLE_ABI,
        functionName: 'getNextTransition',
        chainId: 11155111,
    });

    // 2. Read Market State from Hook
    // Compute real PoolId from token addresses
    const poolId = getPoolId(tokenSymbol);

    const { data: marketState, refetch: refetchState } = useReadContract({
        address: CONTRACTS.STOCK_SHIELD_HOOK,
        abi: STOCK_SHIELD_HOOK_ABI,
        functionName: 'markets',
        args: [poolId],
        chainId: 11155111,
    });

    // Read Auction Count to infer ID
    const { data: auctionCount } = useReadContract({
        address: CONTRACTS.GAP_AUCTION,
        abi: GAP_AUCTION_ABI,
        functionName: 'auctionCount',
        chainId: 11155111,
    });

    // Derived State
    const regime = REGIME_LABELS[Number(regimeId)] || 'Core Session';

    // Default values if hook read fails (or pool doesn't exist yet)
    const volatility = marketState ? Number(marketState[4]) : 0; // realizedVolatility
    const vpinScore = marketState ? Number(marketState[5]) : 0; // vpinScore
    const circuitBreakerLevel = marketState ? Number(marketState[7]) : 0;
    const isGapAuction = marketState ? Boolean(marketState[8]) : false;

    // Infer active auction ID (if count > 0, it's count - 1, simplified)
    // In production we'd want a more robust way or event indexing
    const activeAuctionId = auctionCount ? String(Number(auctionCount) - 1) : null;

    return {
        regime,
        regimeId: Number(regimeId),
        nextTransition,
        marketState: {
            volatility,
            vpinScore,
            circuitBreakerLevel,
            isGapAuction,
        },
        activeAuctionId,
        refetch: () => {
            refetchRegime();
            refetchState();
        }
    };
}

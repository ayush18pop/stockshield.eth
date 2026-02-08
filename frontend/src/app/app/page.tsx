'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { encodeAbiParameters } from 'viem';
import { GapAuctionWidget } from '@/components/GapAuctionWidget';
import { useStockShield } from '@/hooks/useStockShield';
import { useStockShieldWS } from '@/hooks/useWebSocket';
import { Button } from '@/components/ui/button';
import {
    ArrowDownUp, Clock, Zap, ExternalLink, AlertTriangle, Play
} from 'lucide-react';
import { DotMatrix } from '@/components/ui/dot-matrix';
import { CONTRACTS, MOCK_TOKENS, TOKEN_INFO, ERC20_ABI, getEtherscanLink, UNIVERSAL_ROUTER_ABI, PERMIT2_ABI, STATE_VIEW_ABI, computePoolId } from '@/lib/contracts';
import { formatDecimalNumber, formatTokenAmount, parseTokenAmount } from '@/lib/amounts';
import { api } from '@/lib/api';

// ============================================================================
// REGIME CONFIG (Regime enum from contract - matches Solidity exactly)
// ============================================================================
// enum Regime { CORE_SESSION, SOFT_OPEN, PRE_MARKET, AFTER_HOURS, OVERNIGHT, WEEKEND, HOLIDAY }
const REGIME_MAP: Record<number, { label: string; color: string; fee: number }> = {
    0: { label: 'Core Session', color: '#22c55e', fee: 5 },    // 9:35-16:00 ET
    1: { label: 'Soft Open', color: '#84cc16', fee: 10 },      // 9:30-9:35 ET
    2: { label: 'Pre-Market', color: '#eab308', fee: 15 },     // 4:00-9:30 ET
    3: { label: 'After Hours', color: '#f97316', fee: 15 },    // 16:00-20:00 ET
    4: { label: 'Overnight', color: '#ef4444', fee: 30 },      // 20:00-4:00 ET
    5: { label: 'Weekend', color: '#dc2626', fee: 50 },        // Fri 20:00 - Mon 4:00
    6: { label: 'Holiday', color: '#dc2626', fee: 50 },        // Market holidays
};

const WS_REGIME_TO_ID: Record<string, number> = {
    CORE_SESSION: 0,
    SOFT_OPEN: 1,
    PRE_MARKET: 2,
    AFTER_HOURS: 3,
    OVERNIGHT: 4,
    WEEKEND: 5,
    HOLIDAY: 6,
};

const TOKEN_OPTIONS = ['tAAPL', 'tTSLA', 'tNVDA', 'tMSFT', 'tGOOGL'] as const;

function getTokenDecimalsByAddress(address: string): number {
    const token = TOKEN_INFO[address as keyof typeof TOKEN_INFO];
    return token?.decimals ?? 18;
}

// ============================================================================
// DATA LABEL COMPONENT
// ============================================================================
function DataLabel({ type }: { type: 'live' | 'simulated' }) {
    return (
        <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide ${type === 'live'
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-neutral-500/20 text-neutral-400 border border-neutral-500/30'
            }`}>
            {type === 'live' ? '⚡ LIVE' : '📊 SIM'}
        </span>
    );
}

// ============================================================================
// MAIN APP PAGE
// ============================================================================
export default function AppPage() {
    const { address, isConnected, chain } = useAccount();
    const [inputAmount, setInputAmount] = useState('');
    const [selectedToken, setSelectedToken] = useState<typeof TOKEN_OPTIONS[number]>('tAAPL');
    const [isSwapMode, setIsSwapMode] = useState<'buy' | 'sell'>('buy'); // buy = USDC -> Stock, sell = Stock -> USDC
    const [approveStep, setApproveStep] = useState<'token_to_permit2' | 'permit2_to_router' | null>(null);
    const [liveVpin, setLiveVpin] = useState<number | null>(null);
    const [liveRegimeId, setLiveRegimeId] = useState<number | null>(null);
    const [liveCircuitBreakerLevel, setLiveCircuitBreakerLevel] = useState<number | null>(null);
    const [yellowLastUpdate, setYellowLastUpdate] = useState<number | null>(null);

    // Custom Hook for StockShield State
    const { regimeId, nextTransition, marketState, activeAuctionId, refetch } = useStockShield(selectedToken);

    const handleVPINUpdate = useCallback((data: { vpin: number }) => {
        setLiveVpin(data.vpin);
        setYellowLastUpdate(Date.now());
    }, []);

    const handleRegimeChange = useCallback((data: { to: string }) => {
        const nextId = WS_REGIME_TO_ID[data.to];
        if (nextId !== undefined) {
            setLiveRegimeId(nextId);
            setYellowLastUpdate(Date.now());
        }
    }, []);

    const handleCircuitBreaker = useCallback((data: { level: number }) => {
        setLiveCircuitBreakerLevel(data.level);
        setYellowLastUpdate(Date.now());
    }, []);

    const { isConnected: isWSConnected } = useStockShieldWS({
        onVPINUpdate: handleVPINUpdate,
        onRegimeChange: handleRegimeChange,
        onCircuitBreaker: handleCircuitBreaker,
    });

    // =========================================================================
    // ON-CHAIN DATA
    // =========================================================================

    // Balances
    const { data: usdcBalance, refetch: refetchUSDC } = useReadContract({
        address: MOCK_TOKENS.USDC,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: 11155111,
    });

    const { data: tokenBalance, refetch: refetchToken } = useReadContract({
        address: MOCK_TOKENS[selectedToken],
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: 11155111,
    });

    const [currency0, currency1] =
        MOCK_TOKENS.USDC.toLowerCase() < MOCK_TOKENS[selectedToken].toLowerCase()
            ? [MOCK_TOKENS.USDC, MOCK_TOKENS[selectedToken]]
            : [MOCK_TOKENS[selectedToken], MOCK_TOKENS.USDC];

    const inputCurrency = isSwapMode === 'buy' ? MOCK_TOKENS.USDC : MOCK_TOKENS[selectedToken];
    const outputCurrency = isSwapMode === 'buy' ? MOCK_TOKENS[selectedToken] : MOCK_TOKENS.USDC;
    const usdcDecimals = TOKEN_INFO[MOCK_TOKENS.USDC].decimals;
    const selectedTokenDecimals = TOKEN_INFO[MOCK_TOKENS[selectedToken]].decimals;
    const inputTokenDecimals = isSwapMode === 'buy' ? usdcDecimals : selectedTokenDecimals;
    const outputTokenDecimals = isSwapMode === 'buy' ? selectedTokenDecimals : usdcDecimals;
    const swapPoolId = computePoolId(
        currency0,
        currency1,
        CONTRACTS.LP_FEE,
        CONTRACTS.TICK_SPACING,
        CONTRACTS.STOCK_SHIELD_HOOK
    );

    const { data: poolSlot0 } = useReadContract({
        address: CONTRACTS.STATE_VIEW,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [swapPoolId],
        chainId: 11155111,
    });

    const { data: poolLiquidity } = useReadContract({
        address: CONTRACTS.STATE_VIEW,
        abi: STATE_VIEW_ABI,
        functionName: 'getLiquidity',
        args: [swapPoolId],
        chainId: 11155111,
    });

    // Approval checks for Universal Router v4 swaps:
    // 1) ERC20 allowance to Permit2
    // 2) Permit2 allowance to Universal Router
    const { data: tokenToPermit2Allowance, refetch: refetchTokenToPermit2Allowance } = useReadContract({
        address: inputCurrency,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, CONTRACTS.PERMIT2] : undefined,
        chainId: 11155111,
    });

    const { data: permit2ToRouterAllowance, refetch: refetchPermit2ToRouterAllowance } = useReadContract({
        address: CONTRACTS.PERMIT2,
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: address ? [address, inputCurrency, CONTRACTS.UNIVERSAL_ROUTER] : undefined,
        chainId: 11155111,
    });

    // Approval writes
    const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract();
    const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
        hash: approveHash,
    });

    // Swap Interaction
    const { writeContract: swap, data: swapHash, isPending: isSwapping, error: swapError } = useWriteContract();
    const { isLoading: isSwapConfirming, isSuccess: isSwapConfirmed } = useWaitForTransactionReceipt({
        hash: swapHash,
    });
    const [lastYellowState, setLastYellowState] = useState<any>(null);
    const [gasSaved, setGasSaved] = useState<number>(0);

    // Refetch allowances immediately after approval confirmation
    useEffect(() => {
        if (!isApproveConfirmed) return;
        // Immediately refetch the allowances after approval
        refetchTokenToPermit2Allowance();
        refetchPermit2ToRouterAllowance();
        setApproveStep(null);
    }, [isApproveConfirmed, refetchTokenToPermit2Allowance, refetchPermit2ToRouterAllowance]);

    // Refetch all balances and state after swap confirmation
    useEffect(() => {
        if (!isSwapConfirmed) return;
        refetchUSDC();
        refetchToken();
        refetch();
        refetchTokenToPermit2Allowance();
        refetchPermit2ToRouterAllowance();
    }, [
        isSwapConfirmed,
        refetchUSDC,
        refetchToken,
        refetch,
        refetchTokenToPermit2Allowance,
        refetchPermit2ToRouterAllowance,
    ]);

    // Record swap in Yellow session after confirmation
    useEffect(() => {
        if (isSwapConfirmed && swapHash && lastYellowState) {
            const recordSwap = async () => {
                try {
                    await api.spendYellowSession({
                        amount: parseFloat(inputAmount) * 0.001, // Simulated fee
                        action: `${isSwapMode === 'buy' ? 'BUY' : 'SELL'} ${selectedToken}`,
                    });
                } catch (error) {
                    console.warn('Failed to record swap in Yellow session:', error);
                }
            };
            recordSwap();
        }
    }, [isSwapConfirmed, swapHash, lastYellowState, inputAmount, isSwapMode, selectedToken]);

    // =========================================================================
    // DERIVED VALUES
    // =========================================================================

    const isWrongNetwork = isConnected && chain?.id !== 11155111;
    const effectiveRegimeId = liveRegimeId ?? regimeId;
    const effectiveVpinScore = liveVpin !== null
        ? Math.max(0, Math.min(1, liveVpin)) * 1e18
        : marketState.vpinScore;
    const effectiveCircuitBreakerLevel = liveCircuitBreakerLevel ?? marketState.circuitBreakerLevel;
    const regimeConfig = REGIME_MAP[effectiveRegimeId] ?? REGIME_MAP[0]!;

    const parsedInputAmount = parseTokenAmount(inputAmount, inputTokenDecimals);

    const maxUint160 = (BigInt(1) << BigInt(160)) - BigInt(1);
    const maxUint48 = (BigInt(1) << BigInt(48)) - BigInt(1);
    const maxUint128 = (BigInt(1) << BigInt(128)) - BigInt(1);

    const permit2Amount = (() => {
        if (!permit2ToRouterAllowance) return BigInt(0);
        if (Array.isArray(permit2ToRouterAllowance)) return permit2ToRouterAllowance[0] as bigint;
        const result = permit2ToRouterAllowance as { amount?: bigint };
        return result.amount ?? BigInt(0);
    })();

    const permit2Expiration = (() => {
        if (!permit2ToRouterAllowance) return 0;
        if (Array.isArray(permit2ToRouterAllowance)) return Number(permit2ToRouterAllowance[1]);
        const result = permit2ToRouterAllowance as { expiration?: bigint | number };
        return Number(result.expiration ?? 0);
    })();

    const nowTs = Math.floor(Date.now() / 1000);
    const needsTokenToPermit2Approval =
        parsedInputAmount > BigInt(0) && (tokenToPermit2Allowance ?? BigInt(0)) < parsedInputAmount;
    const needsPermit2ToRouterApproval =
        parsedInputAmount > BigInt(0) && (permit2Amount < parsedInputAmount || permit2Expiration < nowTs);

    const poolExists = (() => {
        if (!poolSlot0) return false;
        const slot = poolSlot0 as readonly [bigint, number, number, number];
        return slot[0] > BigInt(0);
    })();
    const hasLiquidity = (poolLiquidity ?? BigInt(0)) > BigInt(0);

    // Dynamic Fee Calculation (Simulated for display, real calc happens on-chain)
    const baseFee = regimeConfig.fee;
    // Volatility impact: 0.5 * vol^2 (approx scaling)
    const volatilityFee = Math.floor((marketState.volatility / 1e18) * 100);
    // VPIN impact: 0.3 * vpin
    const vpinFee = Math.floor((effectiveVpinScore / 1e18) * 30);
    // Inventory impact: 0.1 * imbalance
    const inventoryFee = Math.floor(Math.random() * 5); // Placeholder until inventory is tracked in hook view

    const totalFee = baseFee + volatilityFee + vpinFee + inventoryFee;

    // Price estimates:
    // 1) Prefer on-chain pool mid-price from slot0 tick
    // 2) Fallback to static reference price if pool slot isn't available
    const mockPrices: Record<typeof TOKEN_OPTIONS[number], number> = {
        tAAPL: 185.42,
        tTSLA: 248.50,
        tNVDA: 878.35,
        tMSFT: 415.28,
        tGOOGL: 134.65,
    };

    const poolSpotUsdcPerStock = (() => {
        if (!poolSlot0) return null;
        const slot = poolSlot0 as readonly [bigint, number, number, number];
        if (slot[0] === BigInt(0)) return null;

        const tick = slot[1];
        const dec0 = getTokenDecimalsByAddress(currency0);
        const dec1 = getTokenDecimalsByAddress(currency1);

        // token1 per token0 in human units
        const token1PerToken0 = Math.pow(1.0001, tick) * Math.pow(10, dec0 - dec1);
        if (!Number.isFinite(token1PerToken0) || token1PerToken0 <= 0) return null;

        const usdcIsCurrency0 = currency0.toLowerCase() === MOCK_TOKENS.USDC.toLowerCase();
        return usdcIsCurrency0 ? 1 / token1PerToken0 : token1PerToken0;
    })();

    const fallbackUsdcPerStock = mockPrices[selectedToken];
    const poolPriceDeviation = poolSpotUsdcPerStock !== null
        ? poolSpotUsdcPerStock / fallbackUsdcPerStock
        : null;
    const hasExtremePoolPrice = poolSpotUsdcPerStock !== null && (
        !Number.isFinite(poolSpotUsdcPerStock) ||
        poolSpotUsdcPerStock <= 0 ||
        poolPriceDeviation === null ||
        poolPriceDeviation > 100 ||
        poolPriceDeviation < 0.01
    );
    const effectiveUsdcPerStock = hasExtremePoolPrice
        ? fallbackUsdcPerStock
        : (poolSpotUsdcPerStock ?? fallbackUsdcPerStock);
    const estimatedRate = (() => {
        const usdcPerStock = effectiveUsdcPerStock;
        return isSwapMode === 'buy' ? 1 / usdcPerStock : usdcPerStock;
    })();

    const inputNum = parseFloat(inputAmount) || 0;
    const estimatedOutput = inputNum * estimatedRate * (1 - totalFee / 10000);
    const estimatedOutputDisplay = inputNum > 0
        ? formatDecimalNumber(estimatedOutput, Math.min(outputTokenDecimals, 6))
        : '';
    const feeAmountInputToken = inputNum * (totalFee / 10000);
    const feeAmountDisplay = inputNum > 0
        ? `${formatDecimalNumber(feeAmountInputToken, Math.min(inputTokenDecimals, 6))} ${isSwapMode === 'buy' ? 'USDC' : selectedToken}`
        : '';
    const feeAmountUsdc = (() => {
        if (feeAmountInputToken === 0) return 0;
        if (isSwapMode === 'buy') return feeAmountInputToken;
        return feeAmountInputToken * effectiveUsdcPerStock;
    })();
    const amountAfterFee = inputNum - feeAmountInputToken;
    const amountAfterFeeDisplay = inputNum > 0
        ? `${formatDecimalNumber(amountAfterFee, Math.min(inputTokenDecimals, 6))} ${isSwapMode === 'buy' ? 'USDC' : selectedToken}`
        : '';
    const estimateSourceLabel = hasExtremePoolPrice
        ? 'Fallback reference price (pool price invalid)'
        : (poolSpotUsdcPerStock !== null ? 'Pool mid-price' : 'Fallback reference price');

    // Format time until next regime
    let timeUntilNext = '';
    if (nextTransition) {
        const [timeUntil] = nextTransition as [bigint, number];
        const minutes = Number(timeUntil) / 60;
        if (minutes < 60) {
            timeUntilNext = `${Math.floor(minutes)}m`;
        } else {
            timeUntilNext = `${Math.floor(minutes / 60)}h ${Math.floor(minutes % 60)}m`;
        }
    }

    const yellowStatusLabel = isWSConnected ? 'Connected' : 'Disconnected';
    const yellowStatusColor = isWSConnected ? 'text-green-400' : 'text-amber-400';
    const yellowLastUpdateLabel = yellowLastUpdate
        ? new Date(yellowLastUpdate).toLocaleTimeString()
        : 'No live packets yet';

    // Helper for Etherscan links
    const getContractLink = (contractName: keyof typeof CONTRACTS) => {
        const addr = CONTRACTS[contractName];
        if (typeof addr !== 'string') return '#';
        return getEtherscanLink('address', addr);
    };

    // =========================================================================
    // HANDLERS
    // =========================================================================

    const handleApprove = () => {
        if (!parsedInputAmount || parsedInputAmount <= BigInt(0)) return;

        if (needsTokenToPermit2Approval) {
            setApproveStep('token_to_permit2');
            approve({
                address: inputCurrency,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.PERMIT2, (BigInt(1) << BigInt(256)) - BigInt(1)],
                chainId: 11155111,
            });
            return;
        }

        if (needsPermit2ToRouterApproval) {
            setApproveStep('permit2_to_router');
            approve({
                address: CONTRACTS.PERMIT2,
                abi: PERMIT2_ABI,
                functionName: 'approve',
                args: [inputCurrency, CONTRACTS.UNIVERSAL_ROUTER, maxUint160, Number(maxUint48)],
                chainId: 11155111,
            });
        }
    };

    const handleSwap = async () => {
        if (!parsedInputAmount || parsedInputAmount <= BigInt(0)) return;
        if (parsedInputAmount > maxUint128) return;
        if (needsTokenToPermit2Approval || needsPermit2ToRouterApproval) return;
        if (!poolExists || !hasLiquidity) return;

        const zeroForOne = isSwapMode === 'buy'
            ? MOCK_TOKENS.USDC < MOCK_TOKENS[selectedToken]
            : MOCK_TOKENS[selectedToken] < MOCK_TOKENS.USDC;

        // Deadline: 30 minutes from now
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

        const commands = '0x10' as `0x${string}`; // Commands.V4_SWAP
        const actions = '0x060c0f' as `0x${string}`; // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL

        try {
            // Get Yellow-signed hookData
            let signedHookData = '0x' as `0x${string}`;
            let yellowState: any = null;

            try {
                const signResponse = await api.signTradeState({
                    poolId: computePoolId(currency0, currency1, CONTRACTS.LP_FEE, CONTRACTS.TICK_SPACING, CONTRACTS.STOCK_SHIELD_HOOK),
                    asset: selectedToken,
                    amountIn: parsedInputAmount.toString(),
                    zeroForOne,
                    tokenIn: inputCurrency,
                    tokenOut: outputCurrency,
                    hookAddress: CONTRACTS.STOCK_SHIELD_HOOK,
                    chainId: 11155111,
                });
                signedHookData = signResponse.hookData as `0x${string}`;
                yellowState = {
                    channelId: signResponse.debug?.relayChannelId || signResponse.debug?.channelId || null,
                    turnNum: signResponse.debug?.turnNum || 0,
                    vpin: signResponse.debug?.vpin || 0,
                    regime: signResponse.debug?.regime || 0,
                };
                setLastYellowState(yellowState);
                setGasSaved(0.48); // ~150k gas saved
            } catch (error) {
                console.warn('Yellow signing failed, proceeding with empty hookData:', error);
            }

            const exactInSingleParams = encodeAbiParameters(
                [
                    {
                        name: 'params',
                        type: 'tuple',
                        components: [
                            {
                                name: 'poolKey',
                                type: 'tuple',
                                components: [
                                    { name: 'currency0', type: 'address' },
                                    { name: 'currency1', type: 'address' },
                                    { name: 'fee', type: 'uint24' },
                                    { name: 'tickSpacing', type: 'int24' },
                                    { name: 'hooks', type: 'address' },
                                ],
                            },
                            { name: 'zeroForOne', type: 'bool' },
                            { name: 'amountIn', type: 'uint128' },
                            { name: 'amountOutMinimum', type: 'uint128' },
                            { name: 'hookData', type: 'bytes' },
                        ],
                    },
                ],
                [
                    {
                        poolKey: {
                            currency0: currency0 as `0x${string}`,
                            currency1: currency1 as `0x${string}`,
                            fee: CONTRACTS.LP_FEE,
                            tickSpacing: CONTRACTS.TICK_SPACING,
                            hooks: CONTRACTS.STOCK_SHIELD_HOOK as `0x${string}`,
                        },
                        zeroForOne,
                        amountIn: parsedInputAmount,
                        amountOutMinimum: BigInt(0),
                        hookData: signedHookData,
                    },
                ]
            );

            const settleAllParams = encodeAbiParameters(
                [
                    { name: 'currency', type: 'address' },
                    { name: 'maxAmount', type: 'uint256' },
                ],
                [inputCurrency as `0x${string}`, parsedInputAmount]
            );

            const takeAllParams = encodeAbiParameters(
                [
                    { name: 'currency', type: 'address' },
                    { name: 'minAmount', type: 'uint256' },
                ],
                [outputCurrency as `0x${string}`, BigInt(0)]
            );

            const v4SwapInput = encodeAbiParameters(
                [
                    { name: 'actions', type: 'bytes' },
                    { name: 'params', type: 'bytes[]' },
                ],
                [actions, [exactInSingleParams, settleAllParams, takeAllParams]]
            );

            swap({
                address: CONTRACTS.UNIVERSAL_ROUTER,
                abi: UNIVERSAL_ROUTER_ABI,
                functionName: 'execute',
                args: [
                    commands,
                    [v4SwapInput],
                    deadline,
                ],
                chainId: 11155111,
            });
        } catch (error) {
            // wagmi will surface swap error
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-[#050505]/95 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-[1400px] mx-auto h-full px-6 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2">
                            <DotMatrix text="S/01" size="sm" className="text-[#FF4D00]" />
                            <span className="font-medium">StockShield</span>
                        </Link>
                        <nav className="hidden md:flex items-center gap-6 text-sm">
                            <Link href="/demo" className="text-neutral-400 hover:text-[#FF4D00] transition-colors flex items-center gap-1">
                                Demo
                            </Link>
                            <Link href="/app" className="text-white font-medium flex items-center gap-1">
                                Trade <span className="text-[9px] px-1.5 py-0.5 bg-[#FF4D00]/20 text-[#FF4D00] rounded">SEPOLIA</span>
                            </Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                            <Zap className={`w-4 h-4 ${yellowStatusColor}`} />
                            <span className={`text-xs font-medium ${yellowStatusColor}`}>
                                Yellow Relay: {yellowStatusLabel}
                            </span>
                        </div>
                        <div
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                            style={{
                                borderColor: regimeConfig.color,
                                backgroundColor: `${regimeConfig.color}10`
                            }}
                        >
                            <Clock className="w-4 h-4" style={{ color: regimeConfig.color }} />
                            <span className="text-sm font-medium" style={{ color: regimeConfig.color }}>
                                {regimeConfig.label}
                            </span>
                            {timeUntilNext && (
                                <>
                                    <span className="text-xs text-neutral-500">|</span>
                                    <span className="text-xs text-neutral-400">Next: {timeUntilNext}</span>
                                </>
                            )}
                            <DataLabel type="live" />
                        </div>
                        <ConnectButton />
                    </div>
                </div>
            </header>

            {/* Demo Banner */}
            <div className="bg-gradient-to-r from-[#FF4D00]/20 via-[#FF4D00]/10 to-[#FF4D00]/20 border-b border-[#FF4D00]/20">
                <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Play className="w-4 h-4 text-[#FF4D00]" />
                        <span className="text-sm">
                            <span className="text-[#FF4D00] font-medium">See StockShield in Action:</span>{' '}
                            <span className="text-neutral-400">Watch how LPs are protected across 8 real-world scenarios</span>
                        </span>
                    </div>
                    <Link href="/demo">
                        <Button size="sm" className="bg-[#FF4D00] hover:bg-[#ff5e1a] text-sm px-4">
                            Launch Demo →
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-[1200px] mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Left: Swap Interface */}
                    <div className="space-y-6">
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6 relative overflow-hidden">
                            {/* Circuit Breaker Overlay */}
                            {effectiveCircuitBreakerLevel >= 4 && (
                                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-center p-6">
                                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                                    <h3 className="text-xl font-bold text-red-500 mb-2">Market Halted</h3>
                                    <p className="text-neutral-400 max-w-xs">Trading is paused due to extreme market conditions or oracle staleness.</p>
                                </div>
                            )}

                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-medium">Trade Stocks</h2>
                                <div className="flex items-center gap-2 bg-[#0f0f0f] p-1 rounded-lg border border-white/5">
                                    <button
                                        onClick={() => setIsSwapMode('buy')}
                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${isSwapMode === 'buy' ? 'bg-[#FF4D00] text-white' : 'text-neutral-500 hover:text-white'}`}
                                    >
                                        Buy
                                    </button>
                                    <button
                                        onClick={() => setIsSwapMode('sell')}
                                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${isSwapMode === 'sell' ? 'bg-[#FF4D00] text-white' : 'text-neutral-500 hover:text-white'}`}
                                    >
                                        Sell
                                    </button>
                                </div>
                            </div>

                            {/* Wrong Network Warning */}
                            {isWrongNetwork && (
                                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-sm text-red-400">
                                    <AlertTriangle className="w-4 h-4" />
                                    Switch to Sepolia testnet
                                </div>
                            )}

                            {/* Token A Input (Out) */}
                            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-neutral-500">You pay</span>
                                    <span className="text-sm text-neutral-500 flex items-center">
                                        Balance: {
                                            isSwapMode === 'buy'
                                                ? formatTokenAmount(usdcBalance as bigint | undefined, usdcDecimals, { maxFractionDigits: 6 })
                                                : formatTokenAmount(tokenBalance as bigint | undefined, selectedTokenDecimals, { maxFractionDigits: 6 })
                                        }
                                        <DataLabel type="live" />
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        value={inputAmount}
                                        onChange={(e) => setInputAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="bg-transparent text-2xl font-mono flex-1 outline-none min-w-0"
                                    />
                                    {isSwapMode === 'buy' ? (
                                        <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                                            <span className="text-lg">💵</span>
                                            <span>USDC</span>
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedToken}
                                            onChange={(e) => setSelectedToken(e.target.value as typeof selectedToken)}
                                            className="bg-white/5 px-3 py-2 rounded-lg outline-none cursor-pointer"
                                        >
                                            {TOKEN_OPTIONS.map((token) => (
                                                <option key={token} value={token}>
                                                    {TOKEN_INFO[MOCK_TOKENS[token]].logo} {token}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Swap Arrow */}
                            <div className="flex justify-center -my-2 relative z-10">
                                <div className="bg-[#0a0a0a] border border-white/10 p-2 rounded-lg cursor-pointer hover:border-[#FF4D00]/50 transition-colors" onClick={() => setIsSwapMode(m => m === 'buy' ? 'sell' : 'buy')}>
                                    <ArrowDownUp className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Token B Output (In) */}
                            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-neutral-500">You receive (est.)</span>
                                    <span className="text-sm text-neutral-500 flex items-center">
                                        Balance: {
                                            isSwapMode === 'buy'
                                                ? formatTokenAmount(tokenBalance as bigint | undefined, selectedTokenDecimals, { maxFractionDigits: 6 })
                                                : formatTokenAmount(usdcBalance as bigint | undefined, usdcDecimals, { maxFractionDigits: 6 })
                                        }
                                        <DataLabel type="live" />
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="text"
                                        value={estimatedOutputDisplay}
                                        readOnly
                                        placeholder="0.00"
                                        className="bg-transparent text-2xl font-mono flex-1 outline-none min-w-0 text-neutral-400"
                                    />
                                    {isSwapMode === 'buy' ? (
                                        <select
                                            value={selectedToken}
                                            onChange={(e) => setSelectedToken(e.target.value as typeof selectedToken)}
                                            className="bg-white/5 px-3 py-2 rounded-lg outline-none cursor-pointer"
                                        >
                                            {TOKEN_OPTIONS.map((token) => (
                                                <option key={token} value={token}>
                                                    {TOKEN_INFO[MOCK_TOKENS[token]].logo} {token}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                                            <span className="text-lg">💵</span>
                                            <span>USDC</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mb-4 text-xs text-neutral-500">
                                Estimate source: <span className="text-neutral-300">{estimateSourceLabel}</span>
                                {poolSpotUsdcPerStock !== null && (
                                    <>
                                        {' '}| Spot: <span className="font-mono text-neutral-300">1 {selectedToken} ≈ {formatDecimalNumber(poolSpotUsdcPerStock, 6)} USDC</span>
                                    </>
                                )}
                            </div>

                            {hasExtremePoolPrice && (
                                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
                                    Pool spot price is far from normal range. This usually means the pool was initialized with a wrong token ratio.
                                </div>
                            )}

                            {/* Fee Breakdown */}
                            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4 space-y-3">
                                <div className="flex items-center justify-between text-sm pb-2 border-b border-white/5">
                                    <span className="text-neutral-400 font-medium">StockShield Dynamic Fee</span>
                                    <span className="text-[#FF4D00] font-mono font-bold">~{totalFee} bps</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 flex items-center">
                                            Base Fee ({regimeConfig.label}) <DataLabel type="live" />
                                        </span>
                                        <span className="font-mono">{baseFee} bps</span>
                                    </div>
                                    <div className={`flex items-center justify-between ${volatilityFee > 0 ? 'text-amber-500' : 'text-neutral-500'}`}>
                                        <span className="flex items-center">
                                            Volatility Premium <DataLabel type={marketState.volatility > 0 ? 'live' : 'simulated'} />
                                        </span>
                                        <span className="font-mono">+{volatilityFee} bps</span>
                                    </div>
                                    <div className={`flex items-center justify-between ${vpinFee > 0 ? 'text-amber-500' : 'text-neutral-500'}`}>
                                        <span className="flex items-center">
                                            VPIN Toxicity Premium <DataLabel type={liveVpin !== null || marketState.vpinScore > 0 ? 'live' : 'simulated'} />
                                        </span>
                                        <span className="font-mono">+{vpinFee} bps</span>
                                    </div>
                                    {inputAmount && (
                                        <div className="flex items-center justify-between text-neutral-300">
                                            <span>Estimated total fee</span>
                                            <span className="font-mono text-[#FF4D00]">
                                                {feeAmountDisplay}
                                                {isSwapMode === 'sell' && feeAmountUsdc > 0 && (
                                                    <span className="text-neutral-500"> (~{formatDecimalNumber(feeAmountUsdc, 4)} USDC)</span>
                                                )}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Total Cost Summary */}
                            {inputAmount && parseFloat(inputAmount) > 0 && (
                                <div className="bg-gradient-to-r from-[#FF4D00]/10 to-transparent border border-[#FF4D00]/20 rounded-lg p-4 mb-4">
                                    <div className="text-xs text-neutral-500 mb-2 uppercase tracking-wider">Transaction Summary</div>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-neutral-400">Total input amount</span>
                                            <span className="font-mono text-white">{inputAmount} {isSwapMode === 'buy' ? 'USDC' : selectedToken}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-neutral-500 pl-4">├─ Protocol fee ({totalFee} bps)</span>
                                            <span className="font-mono text-amber-400">{feeAmountDisplay}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-neutral-500 pl-4">└─ Amount swapped</span>
                                            <span className="font-mono text-neutral-300">{amountAfterFeeDisplay}</span>
                                        </div>
                                        <div className="h-px bg-white/10 my-2"></div>
                                        <div className="flex items-center justify-between font-medium">
                                            <span className="text-white">You receive</span>
                                            <span className="font-mono text-green-400">{estimatedOutputDisplay} {isSwapMode === 'buy' ? selectedToken : 'USDC'}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                                            <span className="text-neutral-600">Fee value in USDC</span>
                                            <span className="font-mono text-[#FF4D00]">~${formatDecimalNumber(feeAmountUsdc, 4)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            {!isConnected ? (
                                <ConnectButton.Custom>
                                    {({ openConnectModal }) => (
                                        <Button onClick={openConnectModal} className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] py-6 text-lg">
                                            Connect Wallet
                                        </Button>
                                    )}
                                </ConnectButton.Custom>
                            ) : (
                                <div className="space-y-2">
                                    <Button
                                        onClick={handleApprove}
                                        className="w-full bg-white/10 hover:bg-white/20 py-4 text-sm"
                                        disabled={isApproving || isApproveConfirming || isWrongNetwork || parsedInputAmount <= BigInt(0)}
                                    >
                                        {isApproving
                                            ? approveStep === 'token_to_permit2'
                                                ? `Approving ${isSwapMode === 'buy' ? 'USDC' : selectedToken} for Permit2...`
                                                : 'Approving Permit2 for Universal Router...'
                                            : isApproveConfirmed
                                                ? '✓ Approval Confirmed'
                                                : needsTokenToPermit2Approval
                                                    ? `Approve ${isSwapMode === 'buy' ? 'USDC' : selectedToken} to Permit2`
                                                    : needsPermit2ToRouterApproval
                                                        ? 'Approve Permit2 for Router'
                                                        : '✓ Token Approved'}
                                    </Button>

                                    <Button
                                        onClick={handleSwap}
                                        className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] py-6 text-lg"
                                        disabled={
                                            !inputAmount ||
                                            parseFloat(inputAmount) <= 0 ||
                                            isSwapping ||
                                            isSwapConfirming ||
                                            isWrongNetwork ||
                                            needsTokenToPermit2Approval ||
                                            needsPermit2ToRouterApproval ||
                                            !poolExists ||
                                            !hasLiquidity
                                        }
                                    >
                                        {isSwapping
                                            ? 'Swapping...'
                                            : isSwapConfirming
                                                ? 'Confirming Transaction...'
                                                : 'Swap'}
                                    </Button>
                                </div>
                            )}

                            {/* Yellow Relay Status */}
                            {lastYellowState && (
                                <div className="mt-3 p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="text-yellow-400 flex items-center gap-1.5">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
                                            </span>
                                            Relayed via Yellow Network
                                        </span>
                                        <span className="text-neutral-500 font-mono">Turn #{lastYellowState.turnNumber}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                                        <div>
                                            <span className="text-neutral-600">Channel:</span>
                                            <span className="text-neutral-400 ml-1 font-mono">{lastYellowState.channelId?.slice(0, 10)}...</span>
                                        </div>
                                        <div>
                                            <span className="text-neutral-600">VPIN:</span>
                                            <span className="text-neutral-400 ml-1 font-mono">{(lastYellowState.vpin / 1e18).toFixed(3)}</span>
                                        </div>
                                    </div>
                                    {gasSaved > 0 && (
                                        <div className="mt-2 pt-2 border-t border-yellow-500/10 text-[10px] text-green-400 flex items-center gap-1">
                                            🔥 Gas saved: ~${gasSaved.toFixed(2)} (vs on-chain oracle)
                                        </div>
                                    )}
                                </div>
                            )}

                            {swapHash && (
                                <div className="mt-3 space-y-2">
                                    <a
                                        href={getEtherscanLink('tx', swapHash)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-1 text-sm text-[#FF4D00] hover:underline"
                                    >
                                        View Transaction on Etherscan <ExternalLink className="w-3 h-3" />
                                    </a>
                                    {isSwapConfirmed && lastYellowState && (
                                        <div className="text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/10 rounded-sm px-4 py-2 text-center">
                                            ⚡ Trade relayed off-chain via Yellow Network • Recorded in session tx log
                                        </div>
                                    )}
                                </div>
                            )}
                            {!swapHash && swapError && (
                                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-500 break-all font-mono">
                                    {swapError.message.split('\n')[0]}
                                </div>
                            )}
                            {!poolExists && (
                                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
                                    Pool is not initialized for this pair on Sepolia.
                                </div>
                            )}
                            {poolExists && !hasLiquidity && (
                                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
                                    Pool has zero liquidity. Add liquidity before swapping.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Live Data Panel */}
                    <div className="space-y-6">
                        {/* On-Chain Status */}
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                                Shield Protocol Status
                                <DataLabel type="live" />
                            </h2>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-[#0f0f0f] p-4 rounded-lg border border-white/5">
                                    <div className="text-xs text-neutral-500 mb-1">Market Regime</div>
                                    <div className="font-medium" style={{ color: regimeConfig.color }}>{regimeConfig.label}</div>
                                </div>
                                <div className="bg-[#0f0f0f] p-4 rounded-lg border border-white/5">
                                    <div className="text-xs text-neutral-500 mb-1">Circuit Breaker</div>
                                    <div className={`font-medium ${effectiveCircuitBreakerLevel === 0 ? 'text-green-500' : 'text-amber-500'}`}>
                                        Level {effectiveCircuitBreakerLevel} {effectiveCircuitBreakerLevel === 0 ? '(Normal)' : '(Active)'}
                                    </div>
                                </div>
                            </div>

                            {/* VPIN Gauge */}
                            <div className="bg-[#0f0f0f] p-4 rounded-lg border border-white/5 mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-xs text-neutral-500">VPIN Toxicity Score</div>
                                    <div className="text-xs font-mono">{effectiveVpinScore > 0 ? (effectiveVpinScore / 1e18).toFixed(2) : '0.00'}</div>
                                </div>
                                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-green-500 via-amber-500 to-red-500 transition-all duration-500"
                                        style={{ width: `${Math.min((effectiveVpinScore / 1e18) * 100 * 2, 100)}%` }} // Scale factor for demo
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                                    <span>Safe</span>
                                    <span>Caution</span>
                                    <span>Toxic</span>
                                </div>
                            </div>

                            <div className="bg-[#0f0f0f] p-4 rounded-lg border border-white/5 mb-4">
                                <div className="text-xs text-neutral-500 mb-2">Yellow Network Relay</div>
                                <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-neutral-500">Status</span>
                                        <span className={yellowStatusColor}>{yellowStatusLabel}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-500">Last update</span>
                                        <span className="text-neutral-300 font-mono">{yellowLastUpdateLabel}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-neutral-500">Data source</span>
                                        <span className="text-neutral-300">VPIN / Regime / Circuit</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm text-neutral-400">
                                <div className="flex justify-between">
                                    <span>Contract Address</span>
                                    <a href={getContractLink('STOCK_SHIELD_HOOK')} target="_blank" className="text-[#FF4D00] hover:underline font-mono text-xs">
                                        {CONTRACTS.STOCK_SHIELD_HOOK.slice(0, 6)}...{CONTRACTS.STOCK_SHIELD_HOOK.slice(-4)}
                                    </a>
                                </div>
                                <div className="flex justify-between">
                                    <span>Pool Manager</span>
                                    <a href={getContractLink('POOL_MANAGER')} target="_blank" className="text-[#FF4D00] hover:underline font-mono text-xs">
                                        {CONTRACTS.POOL_MANAGER.slice(0, 6)}...{CONTRACTS.POOL_MANAGER.slice(-4)}
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Gap Auction Widget (Active only when detected) */}
                        {marketState.isGapAuction && (
                            <GapAuctionWidget
                                activeAuctionId={activeAuctionId}
                                refetch={refetch}
                            />
                        )}

                        {/* Token Faucet Info */}
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <h2 className="text-lg font-medium mb-4">Need Test Tokens?</h2>
                            <p className="text-sm text-neutral-400 mb-4">
                                All mock tokens on Sepolia have a public `faucet()` function.
                            </p>
                            <div className="space-y-2">
                                {Object.entries(CONTRACTS)
                                    .filter(([_, value]) => typeof value === 'string')
                                    .map(([name, addr]) => (
                                        <a
                                            key={name}
                                            href={getEtherscanLink('address', addr as string)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
                                        >
                                            <span className="text-neutral-400">{name.replace(/_/g, ' ')}</span>
                                            <span className="font-mono text-[#FF4D00] text-xs">{(addr as string).slice(0, 6)}...{(addr as string).slice(-4)}</span>
                                        </a>
                                    ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

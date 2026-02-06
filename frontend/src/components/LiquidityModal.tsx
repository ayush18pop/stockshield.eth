'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, maxUint256, encodeAbiParameters } from 'viem';
import { CONTRACTS, ERC20_ABI, POSITION_MANAGER_ABI, PERMIT2_ABI, MOCK_TOKENS, STATE_VIEW_ABI } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, CheckCircle, Loader2, Info } from 'lucide-react';

interface LiquidityModalProps {
    isOpen: boolean;
    onClose: () => void;
    poolId: `0x${string}`;
    tokenA: string;
    tokenB: string;
    regime: string;
}

type Step =
    | 'input'
    | 'approving_usdc_permit2'
    | 'approving_usdc_posm'
    | 'approving_stock_permit2'
    | 'approving_stock_posm'
    | 'modifying'
    | 'success';

export function LiquidityModal({ isOpen, onClose, poolId, tokenA, tokenB, regime }: LiquidityModalProps) {
    const { address } = useAccount();
    const [amount, setAmount] = useState('');
    const [amountB, setAmountB] = useState('');
    const [action, setAction] = useState<'add' | 'remove'>('add');
    const [step, setStep] = useState<Step>('input');

    // Contract Addresses - USDC is always tokenB
    const stockTokenAddress = MOCK_TOKENS[`t${tokenA}` as keyof typeof MOCK_TOKENS] || MOCK_TOKENS.tAAPL;
    const usdcAddress = MOCK_TOKENS.USDC;

    // Sort currencies for v4
    const [currency0, currency1] = stockTokenAddress.toLowerCase() < usdcAddress.toLowerCase()
        ? [stockTokenAddress, usdcAddress]
        : [usdcAddress, stockTokenAddress];

    const isHighRisk = regime === 'OVERNIGHT' || regime === 'WEEKEND';

    // --- Reads ---

    // Pool existence check (slot0)
    const { data: slot0 } = useReadContract({
        address: CONTRACTS.STATE_VIEW as `0x${string}`,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolId],
        chainId: 11155111,
    });

    // USDC Allowance to Permit2
    const { data: usdcToPermit2, refetch: refetchUsdcToPermit2 } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, CONTRACTS.PERMIT2],
        chainId: 11155111,
    });

    // Stock Allowance to Permit2
    const { data: stockToPermit2, refetch: refetchStockToPermit2 } = useReadContract({
        address: stockTokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, CONTRACTS.PERMIT2],
        chainId: 11155111,
    });

    // Permit2 Allowance for PosM (USDC)
    const { data: usdcPermit2Allowance, refetch: refetchUsdcPermit2Allowance } = useReadContract({
        address: CONTRACTS.PERMIT2,
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, usdcAddress, CONTRACTS.POSITION_MANAGER],
        chainId: 11155111,
    });

    // Permit2 Allowance for PosM (Stock)
    const { data: stockPermit2Allowance, refetch: refetchStockPermit2Allowance } = useReadContract({
        address: CONTRACTS.PERMIT2,
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: [address as `0x${string}`, stockTokenAddress, CONTRACTS.POSITION_MANAGER],
        chainId: 11155111,
    });

    // Balances
    const { data: usdcBalance } = useReadContract({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        chainId: 11155111,
    });

    const { data: stockBalance } = useReadContract({
        address: stockTokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
        chainId: 11155111,
    });


    // --- Writes ---

    // Approve Token -> Permit2
    const { writeContract: approveToken, data: approveTokenHash, isPending: isApprovingToken } = useWriteContract();
    const { isLoading: isTokenApproveConfirming, isSuccess: isTokenApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTokenHash });

    // Approve Permit2 -> PosM
    const { writeContract: approvePermit2, data: approvePermit2Hash, isPending: isApprovingPermit2 } = useWriteContract();
    const { isLoading: isPermit2ApproveConfirming, isSuccess: isPermit2ApproveConfirmed } = useWaitForTransactionReceipt({ hash: approvePermit2Hash });

    // Position Manager Mint
    const { writeContract: mintPosition, data: mintHash, isPending: isMinting, error: mintError } = useWriteContract();
    const { isLoading: isMintConfirming, isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({ hash: mintHash });

    // --- Effects ---

    // Handle Token Approval Confirmation
    useEffect(() => {
        if (isTokenApproveConfirmed) {
            if (step === 'approving_usdc_permit2') {
                refetchUsdcToPermit2().then(() => setTimeout(() => checkUsdcPosmApproval(), 300));
            } else if (step === 'approving_stock_permit2') {
                refetchStockToPermit2().then(() => setTimeout(() => checkStockPosmApproval(), 300));
            }
        }
    }, [isTokenApproveConfirmed]);

    // Handle Permit2 Approval Confirmation
    useEffect(() => {
        if (isPermit2ApproveConfirmed) {
            if (step === 'approving_usdc_posm') {
                refetchUsdcPermit2Allowance().then(() => setTimeout(() => continueFlow(), 300));
            } else if (step === 'approving_stock_posm') {
                refetchStockPermit2Allowance().then(() => setTimeout(() => executeMint(), 300));
            }
        }
    }, [isPermit2ApproveConfirmed]);

    // Handle mint confirmation
    useEffect(() => {
        if (isMintConfirmed) {
            setStep('success');
        }
    }, [isMintConfirmed]);

    // --- Actions ---

    const continueFlow = () => {
        if (!amount || !address) return;

        const usdcAmount = parseUnits(amount, 6);

        // Check USDC -> Permit2
        if (!usdcToPermit2 || usdcToPermit2 < usdcAmount) {
            setStep('approving_usdc_permit2');
            approveToken({
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.PERMIT2, maxUint256],
                chainId: 11155111,
            });
            return;
        }

        checkUsdcPosmApproval();
    };

    const checkUsdcPosmApproval = () => {
        const usdcAmount = parseUnits(amount, 6);

        let allowed = BigInt(0);
        let expiration = 0;

        if (usdcPermit2Allowance) {
            // @ts-ignore
            if (Array.isArray(usdcPermit2Allowance)) {
                // @ts-ignore
                allowed = usdcPermit2Allowance[0];
                // @ts-ignore
                expiration = usdcPermit2Allowance[1];
            } else if (typeof usdcPermit2Allowance === 'object') {
                // @ts-ignore
                allowed = usdcPermit2Allowance.amount;
                // @ts-ignore
                expiration = usdcPermit2Allowance.expiration;
            }
        }

        const now = Math.floor(Date.now() / 1000);

        if (allowed < usdcAmount || expiration < now) {
            setStep('approving_usdc_posm');
            approvePermit2({
                address: CONTRACTS.PERMIT2,
                abi: PERMIT2_ABI,
                functionName: 'approve',
                args: [usdcAddress, CONTRACTS.POSITION_MANAGER, BigInt(2) ** BigInt(160) - BigInt(1), 281474976710655],
                chainId: 11155111,
            });
        } else {
            checkStockFlow();
        }
    };

    const checkStockFlow = () => {
        const stockNeeded = parseUnits(amountB || '100', 18);

        if (!stockToPermit2 || stockToPermit2 < stockNeeded) {
            setStep('approving_stock_permit2');
            approveToken({
                address: stockTokenAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.PERMIT2, maxUint256],
                chainId: 11155111,
            });
            return;
        }

        checkStockPosmApproval();
    };

    const checkStockPosmApproval = () => {
        const stockNeeded = parseUnits(amountB || '100', 18);

        let allowed = BigInt(0);
        let expiration = 0;

        if (stockPermit2Allowance) {
            // @ts-ignore
            if (Array.isArray(stockPermit2Allowance)) {
                // @ts-ignore
                allowed = stockPermit2Allowance[0];
                // @ts-ignore
                expiration = stockPermit2Allowance[1];
            } else if (typeof stockPermit2Allowance === 'object') {
                // @ts-ignore
                allowed = stockPermit2Allowance.amount;
                // @ts-ignore
                expiration = stockPermit2Allowance.expiration;
            }
        }

        const now = Math.floor(Date.now() / 1000);

        if (allowed < stockNeeded || expiration < now) {
            setStep('approving_stock_posm');
            approvePermit2({
                address: CONTRACTS.PERMIT2,
                abi: PERMIT2_ABI,
                functionName: 'approve',
                args: [stockTokenAddress, CONTRACTS.POSITION_MANAGER, BigInt(2) ** BigInt(160) - BigInt(1), 281474976710655],
                chainId: 11155111,
            });
        } else {
            executeMint();
        }
    };

    const executeMint = () => {
        if (!address || !amount) return;

        setStep('modifying');

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

        // Action codes from v4-periphery/src/libraries/Actions.sol
        const SETTLE = 0x0b;
        const MINT_POSITION_FROM_DELTAS = 0x05;
        const TAKE_PAIR = 0x11;

        // For MINT_POSITION_FROM_DELTAS we must settle first, then mint from resulting credits.
        const actions =
            `0x${SETTLE.toString(16).padStart(2, '0')}${SETTLE.toString(16).padStart(2, '0')}${MINT_POSITION_FROM_DELTAS.toString(16).padStart(2, '0')}${TAKE_PAIR.toString(16).padStart(2, '0')}` as `0x${string}`;

        // Determine amounts based on currency order
        const isUsdcCurrency0 = currency0.toLowerCase() === usdcAddress.toLowerCase();
        const amount0Max = isUsdcCurrency0 ? parseUnits(amount, 6) : parseUnits(amountB || '100', 18);
        const amount1Max = isUsdcCurrency0 ? parseUnits(amountB || '100', 18) : parseUnits(amount, 6);

        // SETTLE params: (currency, amount, payerIsUser)
        const settle0Params = encodeAbiParameters(
            [
                { name: 'currency', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'payerIsUser', type: 'bool' },
            ],
            [currency0 as `0x${string}`, amount0Max, true]
        );

        const settle1Params = encodeAbiParameters(
            [
                { name: 'currency', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'payerIsUser', type: 'bool' },
            ],
            [currency1 as `0x${string}`, amount1Max, true]
        );

        // MINT_POSITION_FROM_DELTAS params:
        // (PoolKey, int24 tickLower, int24 tickUpper, uint128 amount0Max, uint128 amount1Max, address owner, bytes hookData)
        const mintParams = encodeAbiParameters(
            [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' },
                { name: 'tickLower', type: 'int24' },
                { name: 'tickUpper', type: 'int24' },
                { name: 'amount0Max', type: 'uint128' },
                { name: 'amount1Max', type: 'uint128' },
                { name: 'owner', type: 'address' },
                { name: 'hookData', type: 'bytes' },
            ],
            [
                currency0 as `0x${string}`,
                currency1 as `0x${string}`,
                CONTRACTS.LP_FEE,
                CONTRACTS.TICK_SPACING,
                CONTRACTS.STOCK_SHIELD_HOOK as `0x${string}`,
                -887220,  // Full range tickLower (divisible by 60)
                887220,   // Full range tickUpper (divisible by 60)
                amount0Max,
                amount1Max,
                address as `0x${string}`,
                '0x',     // empty hookData
            ]
        );

        // TAKE_PAIR params: (currency0, currency1, recipient)
        const takePairParams = encodeAbiParameters(
            [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'recipient', type: 'address' },
            ],
            [
                currency0 as `0x${string}`,
                currency1 as `0x${string}`,
                address as `0x${string}`,
            ]
        );

        const unlockData = encodeAbiParameters(
            [
                { name: 'actions', type: 'bytes' },
                { name: 'params', type: 'bytes[]' },
            ],
            [actions, [settle0Params, settle1Params, mintParams, takePairParams]]
        );

        mintPosition({
            address: CONTRACTS.POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'modifyLiquidities',
            args: [unlockData, deadline],
            chainId: 11155111,
        });
    };

    const handleAddLiquidity = () => {
        if (action === 'add') {
            continueFlow();
        }
    };

    if (!isOpen) return null;

    const isProcessing = isApprovingToken || isTokenApproveConfirming ||
        isApprovingPermit2 || isPermit2ApproveConfirming ||
        isMinting || isMintConfirming;

    const poolExists = (() => {
        if (!slot0) return false;
        const result = slot0 as readonly [bigint, number, number, number];
        return result[0] > BigInt(0);
    })();

    const requestedUsdc = amount ? parseUnits(amount, 6) : BigInt(0);
    const requestedStock = amountB ? parseUnits(amountB, 18) : BigInt(0);
    const hasUsdc = usdcBalance ? usdcBalance >= requestedUsdc : true;
    const hasStock = stockBalance ? stockBalance >= requestedStock : true;
    const hasSufficientBalances = hasUsdc && hasStock;

    const getStatusText = () => {
        switch (step) {
            case 'approving_usdc_permit2': return 'Approving USDC (1/2)...';
            case 'approving_usdc_posm': return 'Approving USDC (2/2)...';
            case 'approving_stock_permit2': return `Approving ${tokenA} (1/2)...`;
            case 'approving_stock_posm': return `Approving ${tokenA} (2/2)...`;
            case 'modifying': return 'Adding Liquidity...';
            default: return isProcessing ? 'Processing...' : '';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h3 className="font-bold text-lg">Manage Liquidity</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Tabs */}
                    <div className="flex bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setAction('add')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${action === 'add' ? 'bg-[#FF4D00] text-black shadow-lg' : 'text-neutral-400 hover:text-white'}`}
                        >
                            Add Liquidity
                        </button>
                        <button
                            onClick={() => setAction('remove')}
                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${action === 'remove' ? 'bg-[#FF4D00] text-black shadow-lg' : 'text-neutral-400 hover:text-white'}`}
                        >
                            Remove Liquidity
                        </button>
                    </div>

                    {step === 'success' ? (
                        <div className="text-center py-8">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h4 className="text-xl font-bold text-white mb-2">Transaction Submitted</h4>
                            <p className="text-neutral-400 text-sm mb-6">
                                Your liquidity position has been successfully {action === 'add' ? 'created' : 'reduced'}.
                            </p>
                            <Button className="w-full bg-white/10 hover:bg-white/20" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Regime Warning */}
                            {action === 'remove' && isHighRisk && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex gap-3">
                                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-amber-500">High Risk Regime Detected</p>
                                        <p className="text-xs text-amber-200/80">
                                            Market is in {regime} mode. Withdrawals may be subject to time-locks.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Step Indicator */}
                            {step !== 'input' && (
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                                    <p className="text-sm text-blue-400 flex items-center">
                                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                                        {getStatusText()}
                                    </p>
                                </div>
                            )}

                            {/* Inputs */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-neutral-400 mb-2 block">USDC Amount</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isProcessing}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-4 pr-12 py-3 text-white outline-none focus:border-[#FF4D00]/50"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-500">
                                            USDC
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm text-neutral-400 mb-2 block">{tokenA} Amount</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={amountB}
                                            onChange={(e) => setAmountB(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isProcessing}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-4 pr-12 py-3 text-white outline-none focus:border-[#FF4D00]/50"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-500">
                                            {tokenA}
                                        </span>
                                    </div>
                                </div>

                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex gap-2 items-start">
                                <Info className="w-4 h-4 text-blue-400 relative top-0.5 shrink-0" />
                                <p className="text-xs text-blue-300">
                                    Enter amounts for both USDC and {tokenA}. You&apos;ll approve each token for Permit2, then for the Position Manager.
                                </p>
                            </div>

                            {!poolExists && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                    <p className="text-xs text-red-400">
                                        Pool not initialized on-chain. Create the pool first before adding liquidity.
                                    </p>
                                </div>
                            )}

                            {poolExists && !hasSufficientBalances && (
                                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                                    <p className="text-xs text-amber-300">
                                        Insufficient balance. Check that your wallet has enough USDC and {tokenA}.
                                    </p>
                                </div>
                            )}
                        </div>

                        {action === 'remove' ? (
                            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-xs text-neutral-300 space-y-2">
                                <p>Liquidity removal is not supported in this UI yet.</p>
                                <p>Use your wallet to interact with the Position Manager directly (see README). Removal requires tracking your minted positions before burning.</p>
                            </div>
                        ) : (
                            <Button
                                onClick={handleAddLiquidity}
                                disabled={!amount || !amountB || isProcessing || !poolExists || !hasSufficientBalances}
                                className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] text-black font-bold h-12 dashed-loading"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        {getStatusText()}
                                    </>
                                ) : (
                                    'Add Liquidity'
                                )}
                            </Button>
                        )}

                            {mintError && (
                                <p className="text-xs text-red-500 break-all bg-red-500/10 p-2 rounded">
                                    {mintError.message.split('\n')[0]}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, maxUint256, encodeAbiParameters } from 'viem';
import { CONTRACTS, ERC20_ABI, POSITION_MANAGER_ABI, PERMIT2_ABI, MOCK_TOKENS } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, Loader2, ChevronRight, AlertCircle } from 'lucide-react';

interface CreatePoolModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPoolCreated?: (pool: { tokenA: string; tokenB: string }) => void;
}

// Available stock tokens
const STOCK_TOKENS = [
    { symbol: 'AAPL', name: 'Apple Inc.', address: MOCK_TOKENS.tAAPL },
    { symbol: 'TSLA', name: 'Tesla Inc.', address: MOCK_TOKENS.tTSLA },
    { symbol: 'MSFT', name: 'Microsoft', address: MOCK_TOKENS.tMSFT },
    { symbol: 'NVDA', name: 'NVIDIA', address: MOCK_TOKENS.tNVDA },
    { symbol: 'GOOGL', name: 'Alphabet', address: MOCK_TOKENS.tGOOGL },
];

const UINT160_MAX = (BigInt(1) << BigInt(160)) - BigInt(1);

function sqrtBigInt(value: bigint): bigint {
    if (value < BigInt(0)) {
        throw new Error('sqrt only supports non-negative values');
    }
    if (value < BigInt(2)) return value;
    let x0 = value;
    let x1 = (value >> BigInt(1)) + BigInt(1);
    while (x1 < x0) {
        x0 = x1;
        x1 = ((value / x1) + x1) >> BigInt(1);
    }
    return x0;
}

/**
 * Compute sqrtPriceX96 from raw token amounts.
 * sqrtPriceX96 = sqrt(amount1Raw / amount0Raw) * 2^96
 * 
 * The raw amounts already include decimal scaling, so no adjustment needed.
 * e.g., 100 USDC = 100e6 raw, 2 tTSLA = 2e18 raw
 *       price = 2e18 / 100e6 = 2e10 (correct raw price for v4)
 */
function computeSqrtPriceX96FromAmounts(
    amount0Raw: bigint, 
    amount1Raw: bigint,
): bigint {
    if (amount0Raw <= BigInt(0) || amount1Raw <= BigInt(0)) {
        throw new Error('Initial amounts must be greater than zero');
    }

    // sqrtPriceX96 = sqrt((amount1 / amount0) * 2^192)
    const ratioX192 = (amount1Raw << BigInt(192)) / amount0Raw;
    const sqrtPriceX96 = sqrtBigInt(ratioX192);
    if (sqrtPriceX96 <= BigInt(0) || sqrtPriceX96 > UINT160_MAX) {
        throw new Error('Computed initial price is out of uint160 range');
    }
    return sqrtPriceX96;
}

type Step =
    | 'select'
    | 'initializing'
    | 'approving_usdc_permit2'
    | 'approving_usdc_posm'
    | 'approving_stock_permit2'
    | 'approving_stock_posm'
    | 'adding_liquidity'
    | 'success'
    | 'error';

export function CreatePoolModal({ isOpen, onClose, onPoolCreated }: CreatePoolModalProps) {
    const { address } = useAccount();
    const [selectedToken, setSelectedToken] = useState<typeof STOCK_TOKENS[0] | null>(null);
    const [usdcAmount, setUsdcAmount] = useState('100');
    const [stockAmount, setStockAmount] = useState('10');
    const [step, setStep] = useState<Step>('select');
    const [errorMessage, setErrorMessage] = useState('');

    // Get USDC address
    const usdcAddress = MOCK_TOKENS.USDC;

    // Sort currencies for v4
    const getCurrencies = () => {
        if (!selectedToken) return { currency0: '', currency1: '' };
        const stock = selectedToken.address;
        return stock.toLowerCase() < usdcAddress.toLowerCase()
            ? { currency0: stock, currency1: usdcAddress }
            : { currency0: usdcAddress, currency1: stock };
    };

    // --- Reads ---

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
        address: selectedToken?.address || MOCK_TOKENS.tAAPL,
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
        args: [address as `0x${string}`, selectedToken?.address || MOCK_TOKENS.tAAPL, CONTRACTS.POSITION_MANAGER],
        chainId: 11155111,
    });


    // --- Writes ---

    // Initialize Pool
    const { writeContract: initializePool, data: initHash, isPending: isInitializing, error: initError } = useWriteContract();
    const { isLoading: isInitConfirming, isSuccess: isInitConfirmed } = useWaitForTransactionReceipt({ hash: initHash });

    // Approve Token -> Permit2
    const { writeContract: approveToken, data: approveTokenHash, isPending: isApprovingToken } = useWriteContract();
    const { isLoading: isTokenApproveConfirming, isSuccess: isTokenApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTokenHash });

    // Approve Permit2 -> PosM
    const { writeContract: approvePermit2, data: approvePermit2Hash, isPending: isApprovingPermit2 } = useWriteContract();
    const { isLoading: isPermit2ApproveConfirming, isSuccess: isPermit2ApproveConfirmed } = useWaitForTransactionReceipt({ hash: approvePermit2Hash });

    // Add Liquidity
    const { writeContract: addLiquidity, data: liquidityHash, isPending: isAddingLiquidity, error: liquidityError } = useWriteContract();
    const { isLoading: isLiquidityConfirming, isSuccess: isLiquidityConfirmed } = useWaitForTransactionReceipt({ hash: liquidityHash });

    // --- Effects ---

    // Handle init confirmation
    useEffect(() => {
        if (isInitConfirmed && step === 'initializing') {
            setTimeout(() => proceedToApprovals(), 500);
        }
    }, [isInitConfirmed]);

    // Handle Token Approval (Standard ERC20) Confirmation
    useEffect(() => {
        if (isTokenApproveConfirmed) {
            if (step === 'approving_usdc_permit2') {
                refetchUsdcToPermit2().then(() => setTimeout(() => checkUsdcPosmApproval(), 500));
            } else if (step === 'approving_stock_permit2') {
                refetchStockToPermit2().then(() => setTimeout(() => checkStockPosmApproval(), 500));
            }
        }
    }, [isTokenApproveConfirmed]);

    // Handle Permit2 Approval Confirmation
    useEffect(() => {
        if (isPermit2ApproveConfirmed) {
            if (step === 'approving_usdc_posm') {
                refetchUsdcPermit2Allowance().then(() => setTimeout(() => checkStockFlow(), 500));
            } else if (step === 'approving_stock_posm') {
                refetchStockPermit2Allowance().then(() => setTimeout(() => executeAddLiquidity(), 500));
            }
        }
    }, [isPermit2ApproveConfirmed]);

    // Handle liquidity confirmation
    useEffect(() => {
        if (isLiquidityConfirmed && step === 'adding_liquidity') {
            setStep('success');
            if (onPoolCreated && selectedToken) {
                onPoolCreated({ tokenA: selectedToken.symbol, tokenB: 'USDC' });
            }
        }
    }, [isLiquidityConfirmed]);

    // Handle errors
    useEffect(() => {
        if (initError || liquidityError) {
            setStep('error');
            const msg = (initError?.message || liquidityError?.message || 'Transaction failed').split('\n')[0];
            setErrorMessage(msg ?? 'Transaction failed');
        }
    }, [initError, liquidityError]);

    // --- Actions ---

    const startPoolCreation = () => {
        if (!selectedToken || !address) return;
        try {
            setStep('initializing');

            const { currency0, currency1 } = getCurrencies();
            const usdcRaw = parseUnits(usdcAmount, 6);
            const stockRaw = parseUnits(stockAmount, 18);

            // Price is initialized from user-provided amounts, respecting currency ordering.
            const amount0Raw = currency0.toLowerCase() === usdcAddress.toLowerCase() ? usdcRaw : stockRaw;
            const amount1Raw = currency1.toLowerCase() === usdcAddress.toLowerCase() ? usdcRaw : stockRaw;
            const sqrtPriceX96 = computeSqrtPriceX96FromAmounts(amount0Raw, amount1Raw);

            const poolKey = {
                currency0: currency0 as `0x${string}`,
                currency1: currency1 as `0x${string}`,
                fee: CONTRACTS.LP_FEE,
                tickSpacing: CONTRACTS.TICK_SPACING,
                hooks: CONTRACTS.STOCK_SHIELD_HOOK as `0x${string}`,
            };

            initializePool({
                address: CONTRACTS.POSITION_MANAGER,
                abi: POSITION_MANAGER_ABI,
                functionName: 'initializePool',
                args: [poolKey, sqrtPriceX96],
                chainId: 11155111,
            });
        } catch (error) {
            setStep('error');
            setErrorMessage(error instanceof Error ? error.message : 'Invalid initial amounts');
        }
    };

    const proceedToApprovals = () => {
        // Start with USDC
        const usdcNeeded = parseUnits(usdcAmount, 6);
        if (!usdcToPermit2 || usdcToPermit2 < usdcNeeded) {
            setStep('approving_usdc_permit2');
            approveToken({
                address: usdcAddress,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.PERMIT2, maxUint256],
                chainId: 11155111,
            });
        } else {
            checkUsdcPosmApproval();
        }
    };

    const checkUsdcPosmApproval = () => {
        const usdcNeeded = parseUnits(usdcAmount, 6);
        // permit2 allowance returns (uint160 amount, uint48 expiration, uint48 nonce)
        // Wagmi reads might return array or object

        let amount = BigInt(0);
        let expiration = 0;

        if (usdcPermit2Allowance) {
            // @ts-ignore
            if (Array.isArray(usdcPermit2Allowance)) {
                // @ts-ignore
                amount = usdcPermit2Allowance[0];
                // @ts-ignore
                expiration = usdcPermit2Allowance[1];
            } else if (typeof usdcPermit2Allowance === 'object') {
                // @ts-ignore
                amount = usdcPermit2Allowance.amount;
                // @ts-ignore
                expiration = usdcPermit2Allowance.expiration;
            }
        }

        const now = Math.floor(Date.now() / 1000);

        if (amount < usdcNeeded || expiration < now) {
            setStep('approving_usdc_posm');
            approvePermit2({
                address: CONTRACTS.PERMIT2,
                abi: PERMIT2_ABI,
                functionName: 'approve',
                args: [usdcAddress, CONTRACTS.POSITION_MANAGER, BigInt(2) ** BigInt(160) - BigInt(1), 281474976710655], // max uint160, max uint48
                chainId: 11155111,
            });
        } else {
            checkStockFlow();
        }
    };

    const checkStockFlow = () => {
        const stockNeeded = parseUnits(stockAmount, 18);
        if (!stockToPermit2 || stockToPermit2 < stockNeeded) {
            setStep('approving_stock_permit2');
            approveToken({
                address: selectedToken!.address,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [CONTRACTS.PERMIT2, maxUint256],
                chainId: 11155111,
            });
        } else {
            checkStockPosmApproval();
        }
    };

    const checkStockPosmApproval = () => {
        const stockNeeded = parseUnits(stockAmount, 18);

        let amount = BigInt(0);
        let expiration = 0;

        if (stockPermit2Allowance) {
            // @ts-ignore
            if (Array.isArray(stockPermit2Allowance)) {
                // @ts-ignore
                amount = stockPermit2Allowance[0];
                // @ts-ignore
                expiration = stockPermit2Allowance[1];
            } else if (typeof stockPermit2Allowance === 'object') {
                // @ts-ignore
                amount = stockPermit2Allowance.amount;
                // @ts-ignore
                expiration = stockPermit2Allowance.expiration;
            }
        }

        const now = Math.floor(Date.now() / 1000);

        if (amount < stockNeeded || expiration < now) {
            setStep('approving_stock_posm');
            approvePermit2({
                address: CONTRACTS.PERMIT2,
                abi: PERMIT2_ABI,
                functionName: 'approve',
                args: [selectedToken!.address, CONTRACTS.POSITION_MANAGER, BigInt(2) ** BigInt(160) - BigInt(1), 281474976710655],
                chainId: 11155111,
            });
        } else {
            executeAddLiquidity();
        }
    };

    const executeAddLiquidity = () => {
        if (!selectedToken || !address) return;

        setStep('adding_liquidity');

        const { currency0, currency1 } = getCurrencies();
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);

        // Action codes from v4-periphery/src/libraries/Actions.sol
        const SETTLE = 0x0b;
        const MINT_POSITION_FROM_DELTAS = 0x05;
        const TAKE_PAIR = 0x11;

        // For MINT_POSITION_FROM_DELTAS we must settle first, then mint from resulting credits.
        const actions =
            `0x${SETTLE.toString(16).padStart(2, '0')}${SETTLE.toString(16).padStart(2, '0')}${MINT_POSITION_FROM_DELTAS.toString(16).padStart(2, '0')}${TAKE_PAIR.toString(16).padStart(2, '0')}` as `0x${string}`;

        const isUsdcCurrency0 = currency0.toLowerCase() === usdcAddress.toLowerCase();
        const amount0Max = isUsdcCurrency0 ? parseUnits(usdcAmount, 6) : parseUnits(stockAmount, 18);
        const amount1Max = isUsdcCurrency0 ? parseUnits(stockAmount, 18) : parseUnits(usdcAmount, 6);

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
                address,
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

        // Encode the full unlockData: abi.encode(bytes actions, bytes[] params)
        const unlockData = encodeAbiParameters(
            [
                { name: 'actions', type: 'bytes' },
                { name: 'params', type: 'bytes[]' },
            ],
            [actions, [settle0Params, settle1Params, mintParams, takePairParams]]
        );

        addLiquidity({
            address: CONTRACTS.POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'modifyLiquidities',
            args: [unlockData, deadline],
            chainId: 11155111,
        });
    };

    const resetModal = () => {
        setStep('select');
        setSelectedToken(null);
        setErrorMessage('');
    };

    if (!isOpen) return null;

    const isProcessing = isInitializing || isInitConfirming || isApprovingToken || isTokenApproveConfirming ||
        isApprovingPermit2 || isPermit2ApproveConfirming || isAddingLiquidity || isLiquidityConfirming;

    const getStepNumber = () => {
        switch (step) {
            case 'initializing': return 1;
            case 'approving_usdc_permit2':
            case 'approving_usdc_posm': return 2;
            case 'approving_stock_permit2':
            case 'approving_stock_posm': return 3;
            case 'adding_liquidity': return 4;
            default: return 0;
        }
    };

    const getStepLabel = (stepId: number) => {
        if (stepId === 1) return 'Initialize Pool';
        if (stepId === 2) return step === 'approving_usdc_posm' ? 'Approve USDC (2/2)' : 'Approve USDC';
        if (stepId === 3) return step === 'approving_stock_posm' ? `Approve ${selectedToken?.symbol} (2/2)` : `Approve ${selectedToken?.symbol}`;
        return 'Add Liquidity';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <h3 className="font-bold text-lg">Create New Pool</h3>
                    <button onClick={() => { resetModal(); onClose(); }} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {step === 'success' ? (
                        <div className="text-center py-8">
                            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                            <h4 className="text-xl font-bold text-white mb-2">Pool Created!</h4>
                            <p className="text-neutral-400 text-sm mb-6">
                                Your {selectedToken?.symbol}/USDC pool has been initialized with liquidity.
                            </p>
                            <Button className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] text-black font-bold" onClick={() => { resetModal(); onClose(); }}>
                                Done
                            </Button>
                        </div>
                    ) : step === 'error' ? (
                        <div className="text-center py-8">
                            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h4 className="text-xl font-bold text-white mb-2">Transaction Failed</h4>
                            <p className="text-neutral-400 text-sm mb-4 break-all">{errorMessage}</p>
                            <Button className="w-full bg-white/10 hover:bg-white/20" onClick={resetModal}>
                                Try Again
                            </Button>
                        </div>
                    ) : step === 'select' ? (
                        <>
                            {/* Token Selection */}
                            <div>
                                <label className="text-sm text-neutral-400 mb-3 block">Select Stock Token</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {STOCK_TOKENS.map((token) => (
                                        <button
                                            key={token.symbol}
                                            onClick={() => setSelectedToken(token)}
                                            className={`p-3 rounded-lg border text-left transition-all ${selectedToken?.symbol === token.symbol
                                                ? 'border-[#FF4D00] bg-[#FF4D00]/10'
                                                : 'border-white/10 hover:border-white/20 bg-black/20'
                                                }`}
                                        >
                                            <p className="font-bold">{token.symbol}</p>
                                            <p className="text-xs text-neutral-500">{token.name}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Amounts */}
                            {selectedToken && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-neutral-400 mb-2 block">Initial USDC</label>
                                        <input
                                            type="number"
                                            value={usdcAmount}
                                            onChange={(e) => setUsdcAmount(e.target.value)}
                                            placeholder="100"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-neutral-400 mb-2 block">Initial {selectedToken.symbol}</label>
                                        <input
                                            type="number"
                                            value={stockAmount}
                                            onChange={(e) => setStockAmount(e.target.value)}
                                            placeholder="10"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white"
                                        />
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        The USDC:{selectedToken.symbol} ratio sets the initial pool price and cannot be changed after initialization.
                                    </p>
                                </div>
                            )}

                            <Button
                                onClick={startPoolCreation}
                                disabled={!selectedToken || !usdcAmount || !stockAmount}
                                className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] text-black font-bold h-12"
                            >
                                Create Pool
                            </Button>
                        </>
                    ) : (
                        /* Processing Steps */
                        <div className="space-y-4">
                            <div className="text-center mb-6">
                                <p className="text-lg font-medium">Creating {selectedToken?.symbol}/USDC Pool</p>
                                <p className="text-sm text-neutral-500">Step {getStepNumber()} of 4</p>
                            </div>

                            {/* Progress Steps */}
                            <div className="space-y-3">
                                {[1, 2, 3, 4].map((stepId) => {
                                    const currentStep = getStepNumber();
                                    const isComplete = currentStep > stepId; // simple logic for 4 visual steps
                                    const isCurrent = currentStep === stepId;

                                    return (
                                        <div
                                            key={stepId}
                                            className={`flex items-center gap-3 p-3 rounded-lg border ${isComplete ? 'border-green-500/30 bg-green-500/5' :
                                                isCurrent ? 'border-[#FF4D00]/50 bg-[#FF4D00]/5' :
                                                    'border-white/5 bg-black/20'
                                                }`}
                                        >
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isComplete ? 'bg-green-500 text-black' :
                                                isCurrent ? 'bg-[#FF4D00] text-black' :
                                                    'bg-neutral-800 text-neutral-500'
                                                }`}>
                                                {isComplete ? '✓' : stepId}
                                            </div>
                                            <span className={isComplete ? 'text-green-400' : isCurrent ? 'text-white' : 'text-neutral-500'}>
                                                {getStepLabel(stepId)}
                                            </span>
                                            {isCurrent && <Loader2 className="w-4 h-4 animate-spin ml-auto text-[#FF4D00]" />}
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-center text-sm text-neutral-500">
                                Please confirm the transaction in your wallet...
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

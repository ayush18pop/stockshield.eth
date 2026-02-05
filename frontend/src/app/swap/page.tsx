'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatUnits, parseUnits } from 'viem';
import { ArrowLeftRight, ExternalLink, Shield, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotMatrix } from '@/components/ui/dot-matrix';
import {
    CONTRACTS,
    MOCK_TOKENS,
    TOKEN_INFO,
    REGIME_ORACLE_ABI,
    ERC20_ABI,
    getEtherscanLink,
    getContractLink,
    ETHERSCAN_BASE,
} from '@/lib/contracts';

// Regime display info
const REGIME_INFO: Record<number, { name: string; color: string; risk: string; multiplier: string }> = {
    0: { name: 'CORE SESSION', color: 'text-green-500', risk: 'Low', multiplier: '1.0x' },
    1: { name: 'SOFT OPEN', color: 'text-yellow-500', risk: 'Medium', multiplier: '1.5x' },
    2: { name: 'PRE-MARKET', color: 'text-orange-400', risk: 'Medium', multiplier: '2.0x' },
    3: { name: 'AFTER HOURS', color: 'text-orange-400', risk: 'Medium', multiplier: '2.0x' },
    4: { name: 'OVERNIGHT', color: 'text-red-400', risk: 'High', multiplier: '4.0x' },
    5: { name: 'WEEKEND', color: 'text-red-500', risk: 'Very High', multiplier: '6.0x' },
    6: { name: 'HOLIDAY', color: 'text-purple-500', risk: 'Extreme', multiplier: '6.0x' },
};

export default function SwapDemoPage() {
    const { address, isConnected, chain } = useAccount();
    const [selectedToken, setSelectedToken] = useState<keyof typeof MOCK_TOKENS>('tAAPL');
    const [amount, setAmount] = useState('100');

    // Read current regime from contract
    const { data: currentRegime, isLoading: regimeLoading, refetch: refetchRegime } = useReadContract({
        address: CONTRACTS.REGIME_ORACLE,
        abi: REGIME_ORACLE_ABI,
        functionName: 'getCurrentRegime',
        chainId: 11155111, // Sepolia
    });

    // Read token balance
    const { data: tokenBalance } = useReadContract({
        address: MOCK_TOKENS[selectedToken],
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: 11155111,
    });

    // Read USDC balance
    const { data: usdcBalance } = useReadContract({
        address: MOCK_TOKENS.USDC,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: 11155111,
    });

    // Approve transaction
    const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract();
    const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({
        hash: approveHash,
    });

    // Auto-refresh regime every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            refetchRegime();
        }, 30000);
        return () => clearInterval(interval);
    }, [refetchRegime]);

    const regimeData = currentRegime !== undefined ? REGIME_INFO[Number(currentRegime)] : null;

    const handleApprove = () => {
        approve({
            address: MOCK_TOKENS[selectedToken],
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACTS.STOCK_SHIELD_HOOK, parseUnits(amount, 18)],
            chainId: 11155111,
        });
    };

    const isWrongNetwork = isConnected && chain?.id !== 11155111;

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <nav className="fixed top-0 w-full z-50 h-20 flex items-center justify-center border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm">
                <div className="w-full max-w-[1400px] px-8 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3">
                        <span className="font-sans text-lg font-semibold tracking-tight text-white">Stock</span>
                        <span className="font-sans text-lg font-semibold tracking-tight text-[#FF4D00]">Shield</span>
                        <span className="text-[#FF4D00] text-xs font-mono ml-1 opacity-50">SWAP DEMO</span>
                    </Link>
                    <ConnectButton />
                </div>
            </nav>

            <div className="pt-32 pb-20 px-8">
                <div className="max-w-[1200px] mx-auto">
                    {/* Title */}
                    <div className="text-center mb-12">
                        <DotMatrix text="SEPOLIA DEMO" size="sm" className="mb-4 text-neutral-500" />
                        <h1 className="text-4xl font-medium tracking-tight mb-4">
                            Live Contract <span className="text-[#FF4D00]">Interaction</span>
                        </h1>
                        <p className="text-neutral-400 max-w-xl mx-auto">
                            Interact with StockShield contracts deployed on Sepolia testnet.
                            All transactions are real and verifiable on Etherscan.
                        </p>
                    </div>

                    {/* Wrong Network Warning */}
                    {isWrongNetwork && (
                        <div className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <span className="text-red-400">Please switch to Sepolia testnet to interact with contracts</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column - Contract Status */}
                        <div className="space-y-6">
                            {/* Current Regime Card */}
                            <div className="p-6 rounded-xl bg-[#0a0a0a] border border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Clock className="w-5 h-5 text-[#FF4D00]" />
                                    <h3 className="text-lg font-medium">Current Market Regime</h3>
                                </div>

                                {regimeLoading ? (
                                    <div className="animate-pulse h-20 bg-white/5 rounded-lg" />
                                ) : regimeData ? (
                                    <div className="space-y-3">
                                        <div className={`text-2xl font-bold ${regimeData.color}`}>
                                            {regimeData.name}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="text-neutral-500">Risk Level:</span>
                                                <span className={`ml-2 ${regimeData.color}`}>{regimeData.risk}</span>
                                            </div>
                                            <div>
                                                <span className="text-neutral-500">Fee Multiplier:</span>
                                                <span className="ml-2 text-white">{regimeData.multiplier}</span>
                                            </div>
                                        </div>
                                        <a
                                            href={getContractLink('REGIME_ORACLE')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-[#FF4D00] hover:underline"
                                        >
                                            View on Etherscan <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                ) : (
                                    <div className="text-neutral-500">Connect to Sepolia to view</div>
                                )}
                            </div>

                            {/* Deployed Contracts */}
                            <div className="p-6 rounded-xl bg-[#0a0a0a] border border-white/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Shield className="w-5 h-5 text-[#FF4D00]" />
                                    <h3 className="text-lg font-medium">Deployed Contracts</h3>
                                </div>
                                <div className="space-y-3">
                                    {Object.entries(CONTRACTS).map(([name, addr]) => (
                                        <div key={name} className="flex justify-between items-center text-sm">
                                            <span className="text-neutral-400">{name.replace(/_/g, ' ')}</span>
                                            <a
                                                href={getEtherscanLink('address', addr)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[#FF4D00] hover:underline font-mono text-xs"
                                            >
                                                {addr.slice(0, 6)}...{addr.slice(-4)}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Center Column - Swap Interface */}
                        <div className="lg:col-span-2">
                            <div className="p-8 rounded-xl bg-[#0a0a0a] border border-white/5">
                                <div className="flex items-center gap-2 mb-6">
                                    <ArrowLeftRight className="w-5 h-5 text-[#FF4D00]" />
                                    <h3 className="text-lg font-medium">Token Approval Demo</h3>
                                </div>

                                {!isConnected ? (
                                    <div className="text-center py-12">
                                        <p className="text-neutral-400 mb-4">Connect your wallet to interact with contracts</p>
                                        <ConnectButton />
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Token Selection */}
                                        <div>
                                            <label className="block text-sm text-neutral-400 mb-2">Select Token</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(['tAAPL', 'tTSLA', 'tNVDA'] as const).map((token) => (
                                                    <button
                                                        key={token}
                                                        onClick={() => setSelectedToken(token)}
                                                        className={`p-3 rounded-lg border transition-all ${selectedToken === token
                                                                ? 'border-[#FF4D00] bg-[#FF4D00]/10'
                                                                : 'border-white/10 hover:border-white/20'
                                                            }`}
                                                    >
                                                        <div className="text-2xl mb-1">{TOKEN_INFO[MOCK_TOKENS[token]].logo}</div>
                                                        <div className="text-sm font-medium">{token}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Amount Input */}
                                        <div>
                                            <label className="block text-sm text-neutral-400 mb-2">Amount</label>
                                            <input
                                                type="number"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full p-4 rounded-lg bg-[#111] border border-white/10 text-white text-lg focus:outline-none focus:border-[#FF4D00]"
                                                placeholder="100"
                                            />
                                        </div>

                                        {/* Balances */}
                                        <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-[#111] border border-white/5">
                                            <div>
                                                <div className="text-xs text-neutral-500 mb-1">{selectedToken} Balance</div>
                                                <div className="text-lg font-medium">
                                                    {tokenBalance ? formatUnits(tokenBalance as bigint, 18) : '0.00'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-neutral-500 mb-1">USDC Balance</div>
                                                <div className="text-lg font-medium">
                                                    {usdcBalance ? formatUnits(usdcBalance as bigint, 6) : '0.00'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Approve Button */}
                                        <Button
                                            onClick={handleApprove}
                                            disabled={isApproving || isApproveConfirming || isWrongNetwork}
                                            className="w-full py-6 text-lg bg-[#FF4D00] hover:bg-[#ff5e1a] disabled:opacity-50"
                                        >
                                            {isApproving
                                                ? 'Confirm in Wallet...'
                                                : isApproveConfirming
                                                    ? 'Confirming...'
                                                    : isApproveConfirmed
                                                        ? '✓ Approved!'
                                                        : `Approve ${amount} ${selectedToken} for Hook`}
                                        </Button>

                                        {/* Transaction Link */}
                                        {approveHash && (
                                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                                                <div className="flex items-center gap-2 text-green-400">
                                                    <TrendingUp className="w-4 h-4" />
                                                    <span>Transaction submitted!</span>
                                                </div>
                                                <a
                                                    href={getEtherscanLink('tx', approveHash)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-sm text-[#FF4D00] hover:underline mt-2"
                                                >
                                                    View on Etherscan <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        )}

                                        {/* Info Box */}
                                        <div className="p-4 rounded-lg bg-[#111] border border-white/5 text-sm text-neutral-400">
                                            <p className="mb-2">
                                                <strong className="text-white">How this works:</strong>
                                            </p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>Connect wallet to Sepolia testnet</li>
                                                <li>Select a tokenized stock (tAAPL, tTSLA, etc.)</li>
                                                <li>Approve the StockShield Hook to spend your tokens</li>
                                                <li>The Hook applies dynamic fees based on current regime</li>
                                            </ol>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Mock Token Faucet Info */}
                            <div className="mt-6 p-6 rounded-xl bg-[#0a0a0a] border border-white/5">
                                <h3 className="text-lg font-medium mb-3">Need Test Tokens?</h3>
                                <p className="text-neutral-400 text-sm mb-4">
                                    Get Sepolia ETH for gas, then interact with our mock token contracts.
                                </p>
                                <div className="flex gap-4">
                                    <a
                                        href="https://sepoliafaucet.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-[#FF4D00] hover:underline"
                                    >
                                        Sepolia Faucet →
                                    </a>
                                    <a
                                        href={`${ETHERSCAN_BASE}/address/${MOCK_TOKENS.tAAPL}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-[#FF4D00] hover:underline"
                                    >
                                        tAAPL Contract →
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

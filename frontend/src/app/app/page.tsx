'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import {
    ArrowDownUp, Shield, Clock, Zap, ExternalLink, AlertTriangle, Check, Play
} from 'lucide-react';
import { DotMatrix } from '@/components/ui/dot-matrix';
import { CONTRACTS, MOCK_TOKENS, TOKEN_INFO, REGIME_ORACLE_ABI, ERC20_ABI, getEtherscanLink, STOCK_SHIELD_HOOK_ABI } from '@/lib/contracts';

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

// Mock pool ID for demo (would be real pool ID in production)
const DEMO_POOL_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

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
    const [selectedToken, setSelectedToken] = useState<'tAAPL' | 'tTSLA' | 'tNVDA' | 'tMSFT'>('tAAPL');

    // =========================================================================
    // ON-CHAIN DATA (REAL)
    // =========================================================================

    // Read current regime from RegimeOracle
    const { data: onChainRegime } = useReadContract({
        address: CONTRACTS.REGIME_ORACLE,
        abi: REGIME_ORACLE_ABI,
        functionName: 'getCurrentRegime',
        chainId: 11155111,
    });

    // Read next regime transition
    const { data: nextTransition } = useReadContract({
        address: CONTRACTS.REGIME_ORACLE,
        abi: REGIME_ORACLE_ABI,
        functionName: 'getNextTransition',
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

    // Read selected token balance
    const { data: tokenBalance } = useReadContract({
        address: MOCK_TOKENS[selectedToken],
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

    // =========================================================================
    // DERIVED VALUES
    // =========================================================================

    const regimeNumber = typeof onChainRegime === 'number' ? onChainRegime : (onChainRegime !== undefined ? Number(onChainRegime) : 2);
    const regime = REGIME_MAP[regimeNumber] || REGIME_MAP[2];
    const isWrongNetwork = isConnected && chain?.id !== 11155111;

    // Simulated values (would come from oracle/backend in production)
    const simulatedPrice = { tAAPL: 185.42, tTSLA: 248.50, tNVDA: 878.35, tMSFT: 415.28 }[selectedToken];
    const simulatedVPIN = 0.25; // Would come from VPIN calculator

    // Dynamic fee calculation (based on real regime)
    const baseFee = regime.fee;
    const volatilityFee = 2;
    const vpinFee = Math.floor(simulatedVPIN * 10);
    const inventoryFee = 1;
    const totalFee = baseFee + volatilityFee + vpinFee + inventoryFee;

    const inputNum = parseFloat(inputAmount) || 0;
    const outputAmount = (inputNum / simulatedPrice) * (1 - totalFee / 10000);

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

    const handleApprove = () => {
        approve({
            address: MOCK_TOKENS.USDC,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [CONTRACTS.STOCK_SHIELD_HOOK, parseUnits(inputAmount || '0', 6)],
            chainId: 11155111,
        });
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
                                Demo <span className="text-[8px] px-1 py-0.5 bg-[#FF4D00]/20 text-[#FF4D00] rounded">BEST</span>
                            </Link>
                            <Link href="/app" className="text-white font-medium">Trade</Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Live Regime Badge */}
                        <div
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                            style={{
                                borderColor: regime.color,
                                backgroundColor: `${regime.color}10`
                            }}
                        >
                            <Clock className="w-4 h-4" style={{ color: regime.color }} />
                            <span className="text-sm font-medium" style={{ color: regime.color }}>
                                {regime.label}
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
                            <span className="text-[#FF4D00] font-medium">For best demo experience:</span>{' '}
                            <span className="text-neutral-400">Watch the full protection simulation</span>
                        </span>
                    </div>
                    <Link href="/demo">
                        <Button size="sm" className="bg-[#FF4D00] hover:bg-[#ff5e1a] text-sm px-4">
                            Launch Full Demo →
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Main Content */}
            <main className="max-w-[1200px] mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Left: Swap Interface */}
                    <div className="space-y-6">
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-medium">Swap Preview</h2>
                                <span className="text-xs text-neutral-500">Sepolia Testnet</span>
                            </div>

                            {/* Wrong Network Warning */}
                            {isWrongNetwork && (
                                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-sm text-red-400">
                                    <AlertTriangle className="w-4 h-4" />
                                    Switch to Sepolia testnet
                                </div>
                            )}

                            {/* Input */}
                            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-neutral-500">You pay</span>
                                    <span className="text-sm text-neutral-500 flex items-center">
                                        Balance: {usdcBalance ? formatUnits(usdcBalance as bigint, 6) : '0.00'}
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
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg">
                                        <span className="text-lg">💵</span>
                                        <span>USDC</span>
                                    </div>
                                </div>
                            </div>

                            {/* Swap Arrow */}
                            <div className="flex justify-center -my-2 relative z-10">
                                <div className="bg-[#0a0a0a] border border-white/10 p-2 rounded-lg">
                                    <ArrowDownUp className="w-4 h-4" />
                                </div>
                            </div>

                            {/* Output */}
                            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm text-neutral-500">You receive</span>
                                    <span className="text-sm text-neutral-500 flex items-center">
                                        Balance: {tokenBalance ? formatUnits(tokenBalance as bigint, 18) : '0.00'}
                                        <DataLabel type="live" />
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="text"
                                        value={inputNum > 0 ? outputAmount.toFixed(6) : ''}
                                        readOnly
                                        placeholder="0.00"
                                        className="bg-transparent text-2xl font-mono flex-1 outline-none min-w-0"
                                    />
                                    <select
                                        value={selectedToken}
                                        onChange={(e) => setSelectedToken(e.target.value as typeof selectedToken)}
                                        className="bg-white/5 px-3 py-2 rounded-lg outline-none cursor-pointer"
                                    >
                                        <option value="tAAPL">🍎 tAAPL</option>
                                        <option value="tTSLA">🚗 tTSLA</option>
                                        <option value="tNVDA">🎮 tNVDA</option>
                                        <option value="tMSFT">💻 tMSFT</option>
                                    </select>
                                </div>
                            </div>

                            {/* Fee Breakdown */}
                            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4 space-y-3">
                                <div className="flex items-center justify-between text-sm pb-2 border-b border-white/5">
                                    <span className="text-neutral-400 font-medium">StockShield Dynamic Fee</span>
                                    <span className="text-[#FF4D00] font-mono font-bold">{totalFee} bps</span>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 flex items-center">
                                            Base Fee (regime-based) <DataLabel type="live" />
                                        </span>
                                        <span className="font-mono">{baseFee} bps</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 flex items-center">
                                            Volatility (ασ²) <DataLabel type="simulated" />
                                        </span>
                                        <span className="font-mono">+{volatilityFee} bps</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 flex items-center">
                                            VPIN Toxicity <DataLabel type="simulated" />
                                        </span>
                                        <span className="font-mono">+{vpinFee} bps</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-neutral-500 flex items-center">
                                            Inventory (δ|I|) <DataLabel type="simulated" />
                                        </span>
                                        <span className="font-mono">+{inventoryFee} bps</span>
                                    </div>
                                </div>
                            </div>

                            {/* Protection Badge */}
                            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#FF4D00]/10 border border-[#FF4D00]/20 rounded-lg">
                                <Shield className="w-4 h-4 text-[#FF4D00]" />
                                <span className="text-sm text-[#FF4D00]">StockShield Protection Active</span>
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-auto" />
                            </div>

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
                                <Button
                                    onClick={handleApprove}
                                    className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] py-6 text-lg"
                                    disabled={!inputAmount || parseFloat(inputAmount) <= 0 || isApproving || isApproveConfirming || isWrongNetwork}
                                >
                                    {isApproving
                                        ? 'Confirm in Wallet...'
                                        : isApproveConfirming
                                            ? 'Confirming...'
                                            : isApproveConfirmed
                                                ? '✓ Approved! Ready to Swap'
                                                : 'Approve USDC'}
                                </Button>
                            )}

                            {approveHash && (
                                <a
                                    href={getEtherscanLink('tx', approveHash)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-1 mt-3 text-sm text-[#FF4D00] hover:underline"
                                >
                                    View on Etherscan <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Right: Live Data Panel */}
                    <div className="space-y-6">
                        {/* On-Chain Status */}
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                                Live On-Chain Data
                                <DataLabel type="live" />
                            </h2>

                            <div className="space-y-4">
                                {/* Regime */}
                                <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-neutral-500" />
                                        <span className="text-sm">Current Market Regime</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium" style={{ color: regime.color }}>
                                            {regime.label}
                                        </span>
                                        <span className="text-xs text-neutral-500">(Regime {regimeNumber})</span>
                                    </div>
                                </div>

                                {/* Base Fee */}
                                <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-neutral-500" />
                                        <span className="text-sm">Base Fee (this regime)</span>
                                    </div>
                                    <span className="text-sm font-mono" style={{ color: regime.color }}>
                                        {regime.fee} bps
                                    </span>
                                </div>

                                {/* Next Transition */}
                                {timeUntilNext && (
                                    <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-neutral-500" />
                                            <span className="text-sm">Next Regime Change</span>
                                        </div>
                                        <span className="text-sm font-mono text-neutral-400">
                                            {timeUntilNext}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Deployed Contracts */}
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <h2 className="text-lg font-medium mb-4">Deployed Contracts (Sepolia)</h2>
                            <div className="space-y-2">
                                {Object.entries(CONTRACTS).map(([name, addr]) => (
                                    <a
                                        key={name}
                                        href={getEtherscanLink('address', addr)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
                                    >
                                        <span className="text-neutral-400">{name.replace(/_/g, ' ')}</span>
                                        <span className="font-mono text-[#FF4D00] text-xs">{addr.slice(0, 6)}...{addr.slice(-4)}</span>
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Token Faucet Info */}
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <h2 className="text-lg font-medium mb-4">Test Tokens</h2>
                            <p className="text-sm text-neutral-400 mb-4">
                                These are mock ERC20 tokens deployed for testing. You'll need Sepolia ETH to interact.
                            </p>
                            <div className="space-y-2">
                                {Object.entries(MOCK_TOKENS).map(([symbol, addr]) => (
                                    <a
                                        key={symbol}
                                        href={getEtherscanLink('address', addr)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition-colors text-sm"
                                    >
                                        <span className="text-neutral-400">{symbol}</span>
                                        <span className="font-mono text-neutral-500 text-xs">{addr.slice(0, 6)}...{addr.slice(-4)}</span>
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

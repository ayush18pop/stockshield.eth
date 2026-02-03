'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    ArrowDownUp, Shield, Clock, Zap, Plus, Minus,
    ChevronDown, ExternalLink, Settings, AlertTriangle, Check
} from 'lucide-react';
import { DotMatrix } from '@/components/ui/dot-matrix';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import type { Regime } from '@/types/simulation';

// ============================================================================
// REGIME UTILITIES
// ============================================================================
const REGIME_CONFIG: Record<Regime, { color: string; label: string; fee: number; multiplier: number }> = {
    CORE: { color: '#22c55e', label: 'Core Session', fee: 5, multiplier: 1.0 },
    SOFT_OPEN: { color: '#84cc16', label: 'Soft Open', fee: 10, multiplier: 1.5 },
    PRE_MARKET: { color: '#eab308', label: 'Pre-Market', fee: 15, multiplier: 2.0 },
    AFTER_HOURS: { color: '#f97316', label: 'After Hours', fee: 15, multiplier: 2.0 },
    OVERNIGHT: { color: '#ef4444', label: 'Overnight', fee: 30, multiplier: 4.0 },
    WEEKEND: { color: '#dc2626', label: 'Weekend', fee: 50, multiplier: 6.0 },
    HOLIDAY: { color: '#dc2626', label: 'Holiday', fee: 50, multiplier: 6.0 },
};

function getCurrentRegime(): Regime {
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const day = et.getDay();
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    if (day === 0 || day === 6) return 'WEEKEND';
    if (totalMinutes >= 575 && totalMinutes < 960) return 'CORE';
    if (totalMinutes >= 570 && totalMinutes < 575) return 'SOFT_OPEN';
    if (totalMinutes >= 240 && totalMinutes < 570) return 'PRE_MARKET';
    if (totalMinutes >= 960 && totalMinutes < 1200) return 'AFTER_HOURS';
    return 'OVERNIGHT';
}

// ============================================================================
// MOCK DATA
// ============================================================================
type Pool = {
    id: number;
    token: string;
    name: string;
    price: number;
    tvl: number;
    volume24h: number;
    apy: number;
};

const POOLS: Pool[] = [
    { id: 1, token: 'AAPL', name: 'Apple Inc.', price: 185.42, tvl: 2450000, volume24h: 892000, apy: 12.4 },
    { id: 2, token: 'TSLA', name: 'Tesla Inc.', price: 248.50, tvl: 1890000, volume24h: 1230000, apy: 18.7 },
    { id: 3, token: 'MSFT', name: 'Microsoft', price: 415.28, tvl: 3200000, volume24h: 567000, apy: 8.2 },
    { id: 4, token: 'NVDA', name: 'NVIDIA', price: 878.35, tvl: 4100000, volume24h: 2100000, apy: 24.1 },
];

// ============================================================================
// WALLET BUTTON
// ============================================================================
function WalletButton() {
    return (
        <ConnectButton
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'full' }}
            showBalance={false}
            chainStatus="icon"
        />
    );
}

// ============================================================================
// SWAP INTERFACE
// ============================================================================
function SwapInterface({ regime, vpin }: { regime: Regime; vpin: number }) {
    const [inputAmount, setInputAmount] = useState('');
    const [selectedPool, setSelectedPool] = useState<Pool>(POOLS[0]!);
    const [showPoolSelect, setShowPoolSelect] = useState(false);
    const [swapDirection, setSwapDirection] = useState<'buy' | 'sell'>('buy');

    // Calculate dynamic fee based on StockShield formula
    const baseFee = REGIME_CONFIG[regime].fee;
    const volatilityFee = Math.floor(Math.random() * 3); // Mock volatility
    const vpinFee = Math.floor(vpin * 10);
    const inventoryFee = Math.floor(Math.random() * 2);
    const totalFee = baseFee + volatilityFee + vpinFee + inventoryFee;

    const inputNum = parseFloat(inputAmount) || 0;
    const outputAmount = swapDirection === 'buy'
        ? (inputNum / selectedPool.price) * (1 - totalFee / 10000)
        : inputNum * selectedPool.price * (1 - totalFee / 10000);

    const traditionalFee = 30; // Standard AMM fee
    const savings = traditionalFee - totalFee;

    return (
        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium">Swap</h2>
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <Settings className="w-4 h-4 text-neutral-400" />
                </button>
            </div>

            {/* Input */}
            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">You pay</span>
                    <span className="text-sm text-neutral-500">Balance: 10,000.00</span>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        value={inputAmount}
                        onChange={(e) => setInputAmount(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent text-2xl font-mono flex-1 outline-none min-w-0"
                    />
                    <button
                        onClick={() => setSwapDirection(swapDirection === 'buy' ? 'sell' : 'buy')}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors shrink-0 relative z-20"
                    >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${swapDirection === 'buy' ? 'bg-blue-500' : 'bg-neutral-700'}`}>
                            {swapDirection === 'buy' ? '$' : selectedPool.token.charAt(0)}
                        </div>
                        <span className="whitespace-nowrap">{swapDirection === 'buy' ? 'USDC' : selectedPool.token}</span>
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Swap direction button */}
            <div className="flex justify-center -my-2 relative z-10">
                <button
                    onClick={() => setSwapDirection(swapDirection === 'buy' ? 'sell' : 'buy')}
                    className="bg-[#0a0a0a] border border-white/10 p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                    <ArrowDownUp className="w-4 h-4" />
                </button>
            </div>

            {/* Output */}
            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">You receive</span>
                    <span className="text-sm text-neutral-500">Balance: 0.00</span>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="text"
                        value={inputNum > 0 ? outputAmount.toFixed(swapDirection === 'buy' ? 4 : 2) : ''}
                        readOnly
                        placeholder="0.00"
                        className="bg-transparent text-2xl font-mono flex-1 outline-none min-w-0"
                    />
                    <div className="relative">
                        <button
                            onClick={() => setShowPoolSelect(!showPoolSelect)}
                            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition-colors shrink-0 relative z-20"
                        >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${swapDirection === 'sell' ? 'bg-blue-500' : 'bg-neutral-700'}`}>
                                {swapDirection === 'sell' ? '$' : selectedPool.token.charAt(0)}
                            </div>
                            <span className="whitespace-nowrap">{swapDirection === 'sell' ? 'USDC' : selectedPool.token}</span>
                            <ChevronDown className="w-4 h-4" />
                        </button>

                        {/* Pool Selector Dropdown */}
                        {showPoolSelect && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-[#0f0f0f] border border-white/10 rounded-lg shadow-xl z-50">
                                {POOLS.map((pool) => (
                                    <button
                                        key={pool.id}
                                        onClick={() => { setSelectedPool(pool); setShowPoolSelect(false); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                    >
                                        <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-sm">
                                            {pool.token.charAt(0)}
                                        </div>
                                        <div className="text-left">
                                            <p className="font-medium">{pool.token}</p>
                                            <p className="text-xs text-neutral-500">{pool.name}</p>
                                        </div>
                                        <p className="ml-auto font-mono text-sm">${pool.price.toFixed(2)}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* StockShield Fee Breakdown */}
            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center justify-between text-sm pb-2 border-b border-white/5">
                    <span className="text-neutral-400 font-medium">Fee Breakdown (StockShield)</span>
                    <span className="text-[#FF4D00] font-mono font-bold">{totalFee} bps</span>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Base Fee (f₀)</span>
                        <span className="font-mono">{baseFee} bps</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Volatility (ασ²)</span>
                        <span className="font-mono">+{volatilityFee} bps</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-500">VPIN Toxicity (β·VPIN)</span>
                        <span className="font-mono">+{vpinFee} bps</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Inventory (δ|I|)</span>
                        <span className="font-mono">+{inventoryFee} bps</span>
                    </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
                    <span className="text-neutral-500">Regime Multiplier</span>
                    <span style={{ color: REGIME_CONFIG[regime].color }}>{REGIME_CONFIG[regime].multiplier}x ({REGIME_CONFIG[regime].label})</span>
                </div>
                {savings > 0 && (
                    <div className="flex items-center justify-between text-sm bg-green-500/10 -mx-4 px-4 py-2 rounded">
                        <span className="text-green-400 flex items-center gap-1">
                            <Check className="w-4 h-4" /> You save vs traditional AMM
                        </span>
                        <span className="text-green-400 font-mono font-bold">{savings} bps</span>
                    </div>
                )}
            </div>

            {/* Protection Badge */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[#FF4D00]/10 border border-[#FF4D00]/20 rounded-lg">
                <Shield className="w-4 h-4 text-[#FF4D00]" />
                <span className="text-sm text-[#FF4D00]">StockShield Protection Active</span>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-auto" />
            </div>

            {/* Swap Button */}
            <Button className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] py-6 text-lg" disabled={!inputAmount || parseFloat(inputAmount) <= 0}>
                {inputAmount && parseFloat(inputAmount) > 0 ? `Swap for ${outputAmount.toFixed(swapDirection === 'buy' ? 4 : 2)} ${swapDirection === 'buy' ? selectedPool.token : 'USDC'}` : 'Enter an amount'}
            </Button>
        </div>
    );
}

// ============================================================================
// ADD LIQUIDITY INTERFACE
// ============================================================================
function AddLiquidityInterface({ regime }: { regime: Regime }) {
    const [selectedPool, setSelectedPool] = useState<Pool>(POOLS[0]!);
    const [tokenAmount, setTokenAmount] = useState('');
    const [usdcAmount, setUsdcAmount] = useState('');
    const [showPoolSelect, setShowPoolSelect] = useState(false);

    // Auto-calculate paired amount
    const handleTokenChange = (value: string) => {
        setTokenAmount(value);
        const num = parseFloat(value) || 0;
        setUsdcAmount((num * selectedPool.price).toFixed(2));
    };

    const handleUsdcChange = (value: string) => {
        setUsdcAmount(value);
        const num = parseFloat(value) || 0;
        setTokenAmount((num / selectedPool.price).toFixed(4));
    };

    const totalValue = (parseFloat(tokenAmount) || 0) * selectedPool.price + (parseFloat(usdcAmount) || 0);
    const poolShare = selectedPool.tvl > 0 ? ((totalValue / (selectedPool.tvl + totalValue)) * 100) : 0;

    return (
        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium">Add Liquidity</h2>
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                    <Settings className="w-4 h-4 text-neutral-400" />
                </button>
            </div>

            {/* Pool Selection */}
            <div className="relative mb-4">
                <button
                    onClick={() => setShowPoolSelect(!showPoolSelect)}
                    className="w-full flex items-center justify-between bg-[#0f0f0f] p-4 rounded-lg hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a] z-10">
                                {selectedPool.token.charAt(0)}
                            </div>
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a]">
                                $
                            </div>
                        </div>
                        <div>
                            <p className="font-medium">{selectedPool.token}/USDC</p>
                            <p className="text-xs text-neutral-500">{selectedPool.name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-green-400">{selectedPool.apy}% APY</span>
                        <ChevronDown className="w-4 h-4 text-neutral-400" />
                    </div>
                </button>

                {showPoolSelect && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-[#0f0f0f] border border-white/10 rounded-lg shadow-xl z-50">
                        {POOLS.map((pool) => (
                            <button
                                key={pool.id}
                                onClick={() => { setSelectedPool(pool); setShowPoolSelect(false); setTokenAmount(''); setUsdcAmount(''); }}
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-sm">
                                        {pool.token.charAt(0)}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-medium">{pool.token}/USDC</p>
                                        <p className="text-xs text-neutral-500">{pool.name}</p>
                                    </div>
                                </div>
                                <span className="text-sm text-green-400">{pool.apy}% APY</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Token Input */}
            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-2">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">{selectedPool.token}</span>
                    <span className="text-sm text-neutral-500">Balance: 100.00</span>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        value={tokenAmount}
                        onChange={(e) => handleTokenChange(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent text-2xl font-mono flex-1 outline-none min-w-0"
                    />
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg shrink-0">
                        <div className="w-6 h-6 bg-neutral-700 rounded-full flex items-center justify-center text-xs font-bold">
                            {selectedPool.token.charAt(0)}
                        </div>
                        <span>{selectedPool.token}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-[#0a0a0a] border border-white/10 p-2 rounded-lg">
                    <Plus className="w-4 h-4" />
                </div>
            </div>

            {/* USDC Input */}
            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-neutral-500">USDC</span>
                    <span className="text-sm text-neutral-500">Balance: 50,000.00</span>
                </div>
                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        value={usdcAmount}
                        onChange={(e) => handleUsdcChange(e.target.value)}
                        placeholder="0.00"
                        className="bg-transparent text-2xl font-mono flex-1 outline-none min-w-0"
                    />
                    <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg shrink-0">
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold">$</div>
                        <span>USDC</span>
                    </div>
                </div>
            </div>

            {/* Position Preview */}
            <div className="bg-[#0f0f0f] rounded-lg p-4 mb-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Current Price</span>
                    <span className="font-mono">1 {selectedPool.token} = ${selectedPool.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Total Value</span>
                    <span className="font-mono">${totalValue.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Pool Share</span>
                    <span className="font-mono text-[#FF4D00]">{poolShare.toFixed(4)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500">Estimated APY</span>
                    <span className="font-mono text-green-400">{selectedPool.apy}%</span>
                </div>
            </div>

            {/* Protection Info */}
            <div className="bg-[#FF4D00]/10 border border-[#FF4D00]/20 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-[#FF4D00] mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-[#FF4D00] mb-1">StockShield Protection Included</p>
                        <p className="text-xs text-neutral-400">Your LP position is protected against:</p>
                        <ul className="text-xs text-neutral-400 mt-1 space-y-0.5">
                            <li>• LVR attacks during market close</li>
                            <li>• Flash crash exploitation</li>
                            <li>• Toxic order flow (VPIN monitored)</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Add Button */}
            <Button
                className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] py-6 text-lg"
                disabled={!tokenAmount || !usdcAmount || parseFloat(tokenAmount) <= 0}
            >
                {totalValue > 0 ? `Add $${totalValue.toFixed(2)} Liquidity` : 'Enter amounts'}
            </Button>
        </div>
    );
}

// ============================================================================
// POOL STATS
// ============================================================================
function PoolStats({ pool }: { pool: Pool }) {
    return (
        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center font-bold">
                        {pool.token.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-medium">{pool.token}/USDC</h3>
                        <p className="text-sm text-neutral-500">{pool.name}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="font-mono text-lg">${pool.price.toFixed(2)}</p>
                    <p className="text-sm text-green-400">+2.4%</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <p className="text-xs text-neutral-500 mb-1">TVL</p>
                    <p className="font-mono">${(pool.tvl / 1000000).toFixed(2)}M</p>
                </div>
                <div>
                    <p className="text-xs text-neutral-500 mb-1">24h Volume</p>
                    <p className="font-mono">${(pool.volume24h / 1000).toFixed(0)}K</p>
                </div>
                <div>
                    <p className="text-xs text-neutral-500 mb-1">APY</p>
                    <p className="font-mono text-green-400">{pool.apy}%</p>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// ANALYTICS PANEL
// ============================================================================
function AnalyticsPanel({ regime, vpin, circuitBreaker }: { regime: Regime; vpin: number; circuitBreaker: number }) {
    return (
        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
            <h2 className="text-lg font-medium mb-4">Protection Status</h2>
            <div className="space-y-4">
                {/* Regime */}
                <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm">Current Regime</span>
                    </div>
                    <span className="text-sm font-medium" style={{ color: REGIME_CONFIG[regime].color }}>
                        {REGIME_CONFIG[regime].label}
                    </span>
                </div>

                {/* VPIN */}
                <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm">VPIN (Toxicity)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${vpin > 0.7 ? 'bg-red-500' : vpin > 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                style={{ width: `${vpin * 100}%` }}
                            />
                        </div>
                        <span className={`text-sm font-mono ${vpin > 0.7 ? 'text-red-400' : vpin > 0.5 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {vpin.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Circuit Breaker */}
                <div className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-neutral-500" />
                        <span className="text-sm">Circuit Breaker</span>
                    </div>
                    <span className={`text-sm font-mono ${circuitBreaker > 2 ? 'text-red-400' : circuitBreaker > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        Level {circuitBreaker}
                    </span>
                </div>

                {/* Protection Active */}
                <div className="flex items-center justify-between p-3 bg-[#FF4D00]/10 border border-[#FF4D00]/20 rounded-lg">
                    <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[#FF4D00]" />
                        <span className="text-sm text-[#FF4D00]">StockShield Active</span>
                    </div>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN APP PAGE
// ============================================================================
export default function AppPage() {
    const [activeTab, setActiveTab] = useState<'swap' | 'liquidity'>('swap');
    const [regime, setRegime] = useState<Regime>('CORE');
    const [vpin, setVpin] = useState(0.25);
    const [circuitBreaker, setCircuitBreaker] = useState(0);
    const dynamicFee = REGIME_CONFIG[regime].fee;

    useEffect(() => {
        const updateRegime = () => {
            const currentRegime = getCurrentRegime();
            setRegime(currentRegime);
        };

        updateRegime();
        const interval = setInterval(updateRegime, 60000);
        return () => clearInterval(interval);
    }, []);

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

                        <nav className="hidden md:flex items-center gap-6">
                            <Link href="/app" className="text-white text-sm font-medium">Trade</Link>
                            <Link href="/pools" className="text-neutral-400 hover:text-white text-sm transition-colors">Pools</Link>
                            <Link href="/portfolio" className="text-neutral-400 hover:text-white text-sm transition-colors">Portfolio</Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                            style={{
                                borderColor: REGIME_CONFIG[regime].color,
                                backgroundColor: `${REGIME_CONFIG[regime].color}10`
                            }}
                        >
                            <Clock className="w-4 h-4" style={{ color: REGIME_CONFIG[regime].color }} />
                            <span className="text-sm font-medium" style={{ color: REGIME_CONFIG[regime].color }}>
                                {REGIME_CONFIG[regime].label}
                            </span>
                            <span className="text-xs text-neutral-500">|</span>
                            <span className="text-sm font-mono" style={{ color: REGIME_CONFIG[regime].color }}>
                                {dynamicFee} bps
                            </span>
                        </div>
                        <WalletButton />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[1400px] mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Swap/Liquidity */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Tab Switcher */}
                        <div className="flex bg-[#0a0a0a] rounded-lg p-1 border border-white/5">
                            <button
                                onClick={() => setActiveTab('swap')}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'swap' ? 'bg-[#FF4D00] text-white' : 'text-neutral-400 hover:text-white'}`}
                            >
                                Swap
                            </button>
                            <button
                                onClick={() => setActiveTab('liquidity')}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'liquidity' ? 'bg-[#FF4D00] text-white' : 'text-neutral-400 hover:text-white'}`}
                            >
                                Add Liquidity
                            </button>
                        </div>

                        {activeTab === 'swap' ? (
                            <SwapInterface regime={regime} vpin={vpin} />
                        ) : (
                            <AddLiquidityInterface regime={regime} />
                        )}
                    </div>

                    {/* Middle Column - Pool Stats */}
                    <div className="lg:col-span-1 space-y-6">
                        <PoolStats pool={POOLS[0]!} />

                        {/* Quick Stats */}
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <h2 className="text-lg font-medium mb-4">Your Position</h2>
                            <div className="text-center py-8 text-neutral-500">
                                <p className="mb-2">No active positions</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-white/10"
                                    onClick={() => setActiveTab('liquidity')}
                                >
                                    Add Liquidity
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Analytics */}
                    <div className="lg:col-span-1 space-y-6">
                        <AnalyticsPanel regime={regime} vpin={vpin} circuitBreaker={circuitBreaker} />

                        {/* Quick Links */}
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                            <h2 className="text-lg font-medium mb-4">Resources</h2>
                            <div className="space-y-2">
                                <Link href="/docs" className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg hover:bg-white/5 transition-colors">
                                    <span className="text-sm">Documentation</span>
                                    <ExternalLink className="w-4 h-4 text-neutral-500" />
                                </Link>
                                <Link href="/demo" className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg hover:bg-white/5 transition-colors">
                                    <span className="text-sm">Protection Demo</span>
                                    <ExternalLink className="w-4 h-4 text-neutral-500" />
                                </Link>
                                <Link href="/StockSheild_whitepaper.pdf" target="_blank" className="flex items-center justify-between p-3 bg-[#0f0f0f] rounded-lg hover:bg-white/5 transition-colors">
                                    <span className="text-sm">Whitepaper</span>
                                    <ExternalLink className="w-4 h-4 text-neutral-500" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pool List */}
                <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-medium">Protected Pools</h2>
                        <Link href="/pools">
                            <Button variant="outline" size="sm" className="border-white/10">
                                View All Pools
                            </Button>
                        </Link>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
                        <table className="w-full">
                            <thead className="border-b border-white/5">
                                <tr className="text-left text-sm text-neutral-500">
                                    <th className="px-6 py-4 font-medium">Pool</th>
                                    <th className="px-6 py-4 font-medium">Price</th>
                                    <th className="px-6 py-4 font-medium">TVL</th>
                                    <th className="px-6 py-4 font-medium">24h Volume</th>
                                    <th className="px-6 py-4 font-medium">APY</th>
                                    <th className="px-6 py-4 font-medium">Protection</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {POOLS.map((pool) => (
                                    <tr key={pool.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-sm">
                                                    {pool.token.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{pool.token}/USDC</p>
                                                    <p className="text-xs text-neutral-500">{pool.name}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono">${pool.price.toFixed(2)}</td>
                                        <td className="px-6 py-4 font-mono">${(pool.tvl / 1000000).toFixed(2)}M</td>
                                        <td className="px-6 py-4 font-mono">${(pool.volume24h / 1000).toFixed(0)}K</td>
                                        <td className="px-6 py-4 font-mono text-green-400">{pool.apy}%</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF4D00]/10 text-[#FF4D00] rounded text-xs">
                                                <Shield className="w-3 h-3" /> Active
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Button size="sm" className="bg-[#FF4D00] hover:bg-[#ff5e1a]">
                                                Trade
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}

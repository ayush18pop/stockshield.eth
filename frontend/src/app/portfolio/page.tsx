'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Shield, TrendingUp, TrendingDown, Wallet, PieChart,
    ArrowUpRight, ArrowDownRight, Plus, Clock
} from 'lucide-react';
import { DotMatrix } from '@/components/ui/dot-matrix';

// ============================================================================
// MOCK DATA
// ============================================================================
const POSITIONS = [
    {
        id: 1,
        tokenA: 'AAPL',
        tokenB: 'USDC',
        name: 'Apple Inc.',
        liquidityUSD: 25000,
        share: 1.02,
        feesEarned: 312.45,
        feesEarned24h: 12.34,
        pnl: 845.23,
        pnlPercent: 3.38,
        protected: true,
        entryDate: '2024-01-15',
    },
    {
        id: 2,
        tokenA: 'NVDA',
        tokenB: 'USDC',
        name: 'NVIDIA',
        liquidityUSD: 50000,
        share: 1.22,
        feesEarned: 1245.67,
        feesEarned24h: 52.18,
        pnl: 2340.56,
        pnlPercent: 4.68,
        protected: true,
        entryDate: '2024-01-02',
    },
    {
        id: 3,
        tokenA: 'TSLA',
        tokenB: 'USDC',
        name: 'Tesla Inc.',
        liquidityUSD: 15000,
        share: 0.79,
        feesEarned: 189.23,
        feesEarned24h: 8.45,
        pnl: -234.12,
        pnlPercent: -1.56,
        protected: true,
        entryDate: '2024-02-01',
    },
];

const HISTORY = [
    { type: 'add', pool: 'AAPL/USDC', amount: 10000, date: '2024-02-28', txHash: '0x1234...5678' },
    { type: 'fee', pool: 'NVDA/USDC', amount: 52.18, date: '2024-02-28', txHash: '0x2345...6789' },
    { type: 'remove', pool: 'MSFT/USDC', amount: 5000, date: '2024-02-27', txHash: '0x3456...7890' },
    { type: 'fee', pool: 'AAPL/USDC', amount: 12.34, date: '2024-02-27', txHash: '0x4567...8901' },
];

// ============================================================================
// POSITION CARD COMPONENT
// ============================================================================
function PositionCard({ position }: { position: typeof POSITIONS[0] }) {
    const isProfitable = position.pnl >= 0;

    return (
        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        <div className="w-10 h-10 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a] z-10">
                            {position.tokenA.charAt(0)}
                        </div>
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a]">
                            $
                        </div>
                    </div>
                    <div>
                        <p className="font-medium">{position.tokenA}/{position.tokenB}</p>
                        <p className="text-xs text-neutral-500">{position.name}</p>
                    </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF4D00]/10 text-[#FF4D00] rounded text-xs">
                    <Shield className="w-3 h-3" /> Protected
                </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-neutral-500 mb-1">Your Liquidity</p>
                    <p className="font-mono text-lg">${position.liquidityUSD.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-xs text-neutral-500 mb-1">Pool Share</p>
                    <p className="font-mono text-lg">{position.share.toFixed(2)}%</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <p className="text-xs text-neutral-500 mb-1">Fees Earned</p>
                    <p className="font-mono text-green-400">${position.feesEarned.toFixed(2)}</p>
                    <p className="text-xs text-neutral-500">+${position.feesEarned24h.toFixed(2)} (24h)</p>
                </div>
                <div>
                    <p className="text-xs text-neutral-500 mb-1">PnL</p>
                    <p className={`font-mono flex items-center gap-1 ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                        {isProfitable ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        ${Math.abs(position.pnl).toFixed(2)} ({position.pnlPercent.toFixed(2)}%)
                    </p>
                </div>
            </div>

            <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 border-white/10">
                    <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
                <Button variant="outline" size="sm" className="flex-1 border-white/10">
                    Remove
                </Button>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN PORTFOLIO PAGE
// ============================================================================
export default function PortfolioPage() {
    const totalLiquidity = POSITIONS.reduce((sum, p) => sum + p.liquidityUSD, 0);
    const totalFees = POSITIONS.reduce((sum, p) => sum + p.feesEarned, 0);
    const totalPnL = POSITIONS.reduce((sum, p) => sum + p.pnl, 0);

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
                            <Link href="/app" className="text-neutral-400 hover:text-white text-sm transition-colors">Trade</Link>
                            <Link href="/pools" className="text-neutral-400 hover:text-white text-sm transition-colors">Pools</Link>
                            <Link href="/portfolio" className="text-white text-sm font-medium">Portfolio</Link>
                        </nav>
                    </div>
                    <Link href="/app">
                        <Button className="bg-[#FF4D00] hover:bg-[#ff5e1a]">Launch App</Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[1400px] mx-auto px-6 py-8">
                {/* Portfolio Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <div className="flex items-center gap-2 text-neutral-500 mb-2">
                            <Wallet className="w-4 h-4" />
                            <p className="text-sm">Total Value</p>
                        </div>
                        <p className="text-2xl font-mono">${totalLiquidity.toLocaleString()}</p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <div className="flex items-center gap-2 text-neutral-500 mb-2">
                            <TrendingUp className="w-4 h-4" />
                            <p className="text-sm">Total Fees</p>
                        </div>
                        <p className="text-2xl font-mono text-green-400">${totalFees.toFixed(2)}</p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <div className="flex items-center gap-2 text-neutral-500 mb-2">
                            <PieChart className="w-4 h-4" />
                            <p className="text-sm">Total PnL</p>
                        </div>
                        <p className={`text-2xl font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <div className="flex items-center gap-2 text-neutral-500 mb-2">
                            <Shield className="w-4 h-4 text-[#FF4D00]" />
                            <p className="text-sm">Active Positions</p>
                        </div>
                        <p className="text-2xl font-mono">{POSITIONS.length}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Positions */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-medium">Your Positions</h2>
                            <Link href="/pools">
                                <Button size="sm" className="bg-[#FF4D00] hover:bg-[#ff5e1a]">
                                    <Plus className="w-4 h-4 mr-1" /> New Position
                                </Button>
                            </Link>
                        </div>

                        <div className="space-y-4">
                            {POSITIONS.map((position) => (
                                <PositionCard key={position.id} position={position} />
                            ))}
                        </div>
                    </div>

                    {/* Activity History */}
                    <div className="lg:col-span-1">
                        <h2 className="text-xl font-medium mb-4">Recent Activity</h2>
                        <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
                            {HISTORY.map((item, i) => (
                                <div key={i} className="px-4 py-3 border-b border-white/5 last:border-0 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.type === 'add' ? 'bg-green-500/20 text-green-400' :
                                                item.type === 'fee' ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-red-500/20 text-red-400'
                                            }`}>
                                            {item.type === 'add' ? <Plus className="w-4 h-4" /> :
                                                item.type === 'fee' ? <TrendingUp className="w-4 h-4" /> :
                                                    <ArrowDownRight className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium capitalize">{item.type === 'fee' ? 'Fees Collected' : `${item.type} Liquidity`}</p>
                                            <p className="text-xs text-neutral-500">{item.pool}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-mono ${item.type === 'remove' ? 'text-red-400' : 'text-green-400'}`}>
                                            {item.type === 'remove' ? '-' : '+'}${item.amount.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-neutral-500">{item.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

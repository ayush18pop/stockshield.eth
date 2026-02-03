'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Shield, TrendingUp, ArrowUpRight, Plus, Search,
    ChevronDown, Filter
} from 'lucide-react';
import { DotMatrix } from '@/components/ui/dot-matrix';

// ============================================================================
// MOCK DATA
// ============================================================================
const POOLS = [
    {
        id: 1,
        tokenA: 'AAPL',
        tokenB: 'USDC',
        name: 'Apple Inc.',
        price: 185.42,
        tvl: 2450000,
        volume24h: 892000,
        volume7d: 5234000,
        fees24h: 4460,
        apy: 12.4,
        protected: true,
        regime: 'CORE',
    },
    {
        id: 2,
        tokenA: 'TSLA',
        tokenB: 'USDC',
        name: 'Tesla Inc.',
        price: 248.50,
        tvl: 1890000,
        volume24h: 1230000,
        volume7d: 7890000,
        fees24h: 6150,
        apy: 18.7,
        protected: true,
        regime: 'CORE',
    },
    {
        id: 3,
        tokenA: 'MSFT',
        tokenB: 'USDC',
        name: 'Microsoft',
        price: 415.28,
        tvl: 3200000,
        volume24h: 567000,
        volume7d: 3234000,
        fees24h: 2835,
        apy: 8.2,
        protected: true,
        regime: 'CORE',
    },
    {
        id: 4,
        tokenA: 'NVDA',
        tokenB: 'USDC',
        name: 'NVIDIA',
        price: 878.35,
        tvl: 4100000,
        volume24h: 2100000,
        volume7d: 12340000,
        fees24h: 10500,
        apy: 24.1,
        protected: true,
        regime: 'CORE',
    },
    {
        id: 5,
        tokenA: 'GOOGL',
        tokenB: 'USDC',
        name: 'Alphabet Inc.',
        price: 175.32,
        tvl: 2780000,
        volume24h: 723000,
        volume7d: 4560000,
        fees24h: 3615,
        apy: 11.2,
        protected: true,
        regime: 'CORE',
    },
    {
        id: 6,
        tokenA: 'AMZN',
        tokenB: 'USDC',
        name: 'Amazon',
        price: 186.45,
        tvl: 2120000,
        volume24h: 945000,
        volume7d: 5670000,
        fees24h: 4725,
        apy: 14.8,
        protected: true,
        regime: 'CORE',
    },
];

// ============================================================================
// MAIN POOLS PAGE
// ============================================================================
export default function PoolsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'tvl' | 'apy' | 'volume'>('tvl');

    const filteredPools = POOLS
        .filter(pool =>
            pool.tokenA.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pool.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'tvl') return b.tvl - a.tvl;
            if (sortBy === 'apy') return b.apy - a.apy;
            return b.volume24h - a.volume24h;
        });

    const totalTVL = POOLS.reduce((sum, p) => sum + p.tvl, 0);
    const totalVolume = POOLS.reduce((sum, p) => sum + p.volume24h, 0);

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
                            <Link href="/pools" className="text-white text-sm font-medium">Pools</Link>
                            <Link href="/portfolio" className="text-neutral-400 hover:text-white text-sm transition-colors">Portfolio</Link>
                        </nav>
                    </div>
                    <Link href="/app">
                        <Button className="bg-[#FF4D00] hover:bg-[#ff5e1a]">Launch App</Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-[1400px] mx-auto px-6 py-8">
                {/* Stats Banner */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <p className="text-sm text-neutral-500 mb-1">Total Value Locked</p>
                        <p className="text-2xl font-mono">${(totalTVL / 1000000).toFixed(2)}M</p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <p className="text-sm text-neutral-500 mb-1">24h Volume</p>
                        <p className="text-2xl font-mono">${(totalVolume / 1000000).toFixed(2)}M</p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <p className="text-sm text-neutral-500 mb-1">Protected Pools</p>
                        <p className="text-2xl font-mono flex items-center gap-2">
                            {POOLS.length}
                            <Shield className="w-5 h-5 text-[#FF4D00]" />
                        </p>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                            type="text"
                            placeholder="Search pools..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-white/5 rounded-lg pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#FF4D00]/50"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSortBy('tvl')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${sortBy === 'tvl' ? 'bg-[#FF4D00] text-white' : 'bg-[#0a0a0a] border border-white/5 text-neutral-400 hover:text-white'}`}
                        >
                            TVL
                        </button>
                        <button
                            onClick={() => setSortBy('apy')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${sortBy === 'apy' ? 'bg-[#FF4D00] text-white' : 'bg-[#0a0a0a] border border-white/5 text-neutral-400 hover:text-white'}`}
                        >
                            APY
                        </button>
                        <button
                            onClick={() => setSortBy('volume')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${sortBy === 'volume' ? 'bg-[#FF4D00] text-white' : 'bg-[#0a0a0a] border border-white/5 text-neutral-400 hover:text-white'}`}
                        >
                            Volume
                        </button>
                    </div>
                </div>

                {/* Pools Table */}
                <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
                    <table className="w-full">
                        <thead className="border-b border-white/5">
                            <tr className="text-left text-sm text-neutral-500">
                                <th className="px-6 py-4 font-medium">Pool</th>
                                <th className="px-6 py-4 font-medium">TVL</th>
                                <th className="px-6 py-4 font-medium">Volume (24h)</th>
                                <th className="px-6 py-4 font-medium">Fees (24h)</th>
                                <th className="px-6 py-4 font-medium">APY</th>
                                <th className="px-6 py-4 font-medium">Protection</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPools.map((pool) => (
                                <tr key={pool.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex -space-x-2">
                                                <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a] z-10">
                                                    {pool.tokenA.charAt(0)}
                                                </div>
                                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a]">
                                                    $
                                                </div>
                                            </div>
                                            <div>
                                                <p className="font-medium">{pool.tokenA}/{pool.tokenB}</p>
                                                <p className="text-xs text-neutral-500">{pool.name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono">${(pool.tvl / 1000000).toFixed(2)}M</td>
                                    <td className="px-6 py-4 font-mono">${(pool.volume24h / 1000).toFixed(0)}K</td>
                                    <td className="px-6 py-4 font-mono text-green-400">${pool.fees24h.toLocaleString()}</td>
                                    <td className="px-6 py-4 font-mono text-green-400">{pool.apy}%</td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF4D00]/10 text-[#FF4D00] rounded text-xs">
                                            <Shield className="w-3 h-3" /> Active
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Link href="/app">
                                            <Button size="sm" className="bg-[#FF4D00] hover:bg-[#ff5e1a]">
                                                <Plus className="w-4 h-4 mr-1" /> Add Liquidity
                                            </Button>
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}

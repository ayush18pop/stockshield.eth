'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Shield, TrendingUp, Plus, Search, Wallet, RefreshCw, Loader2, Globe
} from 'lucide-react';
import { DotMatrix } from '@/components/ui/dot-matrix';
import { LiquidityModal } from '@/components/LiquidityModal';
import { CreatePoolModal } from '@/components/CreatePoolModal';
import { useStockShield } from '@/hooks/useStockShield';
import { usePoolDiscovery, PoolInfo } from '@/hooks/usePoolDiscovery';
import { useAccount } from 'wagmi';
import { CONTRACTS, MOCK_TOKENS } from '@/lib/contracts';
import { PoolNameBadge } from '@/components/PoolNameDisplay';
import { getPoolENSName, ENS_ROOT } from '@/hooks/useENS';

// Disable SSR for this page (uses wagmi hooks and localStorage)
export const dynamic = 'force-dynamic';

// ============================================================================
// MAIN POOLS PAGE
// ============================================================================
export default function PoolsPage() {
    const { address, isConnected } = useAccount();
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'liquidity' | 'name'>('liquidity');

    // On-chain pool discovery
    const { pools, isLoading, positionCount, savePool, refetch } = usePoolDiscovery();

    // Modal States
    const [selectedPool, setSelectedPool] = useState<PoolInfo | null>(null);
    const [isLiquidityModalOpen, setIsLiquidityModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Fetch Real Regime
    const { regime } = useStockShield();

    const filteredPools = pools
        .filter(pool =>
            pool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pool.tokenSymbol.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'liquidity') {
                if (b.liquidity > a.liquidity) return 1;
                if (b.liquidity < a.liquidity) return -1;
                return 0;
            }
            return a.name.localeCompare(b.name);
        });

    const openLiquidityModal = (pool: PoolInfo) => {
        setSelectedPool(pool);
        setIsLiquidityModalOpen(true);
    };

    const handlePoolCreated = useCallback((newPool: { tokenA: string; tokenB: string }) => {
        // Find the matching token address
        const tokenKey = `t${newPool.tokenA}` as keyof typeof MOCK_TOKENS;
        const stockAddr = MOCK_TOKENS[tokenKey] || MOCK_TOKENS.tAAPL;
        const usdcAddr = MOCK_TOKENS.USDC;

        const [c0, c1] =
            stockAddr.toLowerCase() < usdcAddr.toLowerCase()
                ? [stockAddr, usdcAddr]
                : [usdcAddr, stockAddr];

        // Save to localStorage for persistence
        savePool(`t${newPool.tokenA}`, c0, c1);

        // Re-fetch on-chain data after a short delay (wait for tx to mine)
        setTimeout(() => refetch(), 5000);
    }, [savePool, refetch]);

    /** Format raw v4 liquidity units for display */
    const formatLiquidity = (liq: bigint): string => {
        if (liq === BigInt(0)) return '0';
        return liq.toLocaleString();
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
                        <p className="text-sm text-neutral-500 mb-1">Active Pools</p>
                        <p className="text-2xl font-mono flex items-center gap-2">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : pools.length}
                            <Shield className="w-5 h-5 text-[#FF4D00]" />
                        </p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <p className="text-sm text-neutral-500 mb-1">Your Positions</p>
                        <p className="text-2xl font-mono">
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : positionCount}
                        </p>
                    </div>
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-6">
                        <p className="text-sm text-neutral-500 mb-1">Current Regime</p>
                        <p className="text-2xl font-mono">{regime}</p>
                    </div>
                </div>

                {/* Action Bar */}
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
                            onClick={() => setSortBy('liquidity')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${sortBy === 'liquidity' ? 'bg-[#FF4D00] text-white' : 'bg-[#0a0a0a] border border-white/5 text-neutral-400 hover:text-white'}`}
                        >
                            Liquidity
                        </button>
                        <button
                            onClick={() => setSortBy('name')}
                            className={`px-4 py-2 rounded-lg text-sm transition-colors ${sortBy === 'name' ? 'bg-[#FF4D00] text-white' : 'bg-[#0a0a0a] border border-white/5 text-neutral-400 hover:text-white'}`}
                        >
                            Name
                        </button>
                        <button
                            onClick={() => refetch()}
                            className="px-3 py-2 rounded-lg text-sm bg-[#0a0a0a] border border-white/5 text-neutral-400 hover:text-white transition-colors"
                            title="Refresh on-chain data"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                    <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-[#FF4D00] hover:bg-[#ff5e1a] text-black font-bold"
                        disabled={!isConnected}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Pool
                    </Button>
                </div>

                {/* Loading State */}
                {isLoading ? (
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-12">
                        <div className="text-center">
                            <Loader2 className="w-10 h-10 text-[#FF4D00] animate-spin mx-auto mb-4" />
                            <p className="text-neutral-500">Discovering pools on-chain...</p>
                        </div>
                    </div>
                ) : pools.length === 0 ? (
                    /* Empty State */
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-12">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-[#FF4D00]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Wallet className="w-8 h-8 text-[#FF4D00]" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">No Pools Found</h3>
                            <p className="text-neutral-500 mb-6 max-w-md mx-auto">
                                No StockShield-protected pools exist yet on Sepolia. Create your first pool to get started.
                            </p>
                            {isConnected ? (
                                <Button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="bg-[#FF4D00] hover:bg-[#ff5e1a] text-black font-bold"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Your First Pool
                                </Button>
                            ) : (
                                <p className="text-sm text-neutral-500">Connect your wallet to create a pool</p>
                            )}
                        </div>
                    </div>
                ) : (
                    /* Pools Table */
                    <div className="bg-[#0a0a0a] rounded-xl border border-white/5 overflow-hidden">
                        <table className="w-full">
                            <thead className="border-b border-white/5">
                                <tr className="text-left text-sm text-neutral-500">
                                    <th className="px-6 py-4 font-medium">Pool (ENS)</th>

                                    <th className="px-6 py-4 font-medium">Liquidity (raw)</th>
                                    <th className="px-6 py-4 font-medium">Tick</th>
                                    <th className="px-6 py-4 font-medium">Protection</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPools.map((pool) => {
                                    const ensName = getPoolENSName(pool.tokenSymbol);
                                    return (
                                        <tr key={pool.poolId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex -space-x-2">
                                                        <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a] z-10">
                                                            {pool.name.charAt(0)}
                                                        </div>
                                                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm border-2 border-[#0a0a0a]">
                                                            $
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Globe size={14} className="text-[#5298FF]" />
                                                            <p className="font-mono font-medium text-[#5298FF]">{ensName}</p>
                                                        </div>
                                                        <p className="text-xs text-neutral-500 mt-0.5">{pool.name} · tick spacing: {CONTRACTS.TICK_SPACING}</p>
                                                        <code className="text-[10px] text-neutral-600 font-mono">
                                                            {pool.poolId.slice(0, 10)}...{pool.poolId.slice(-6)}
                                                        </code>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 font-mono">
                                                <div className="text-white">{formatLiquidity(pool.liquidity)}</div>
                                                <div className="text-xs text-neutral-600">raw liquidity units</div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-sm">
                                                {pool.tick}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF4D00]/10 text-[#FF4D00] rounded text-xs">
                                                        <Shield className="w-3 h-3" /> Active
                                                    </span>
                                                    <span className="text-xs text-neutral-600 border border-neutral-800 px-1.5 py-0.5 rounded">
                                                        {regime}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Button
                                                    size="sm"
                                                    className="bg-[#FF4D00] hover:bg-[#ff5e1a] text-black font-bold"
                                                    onClick={() => openLiquidityModal(pool)}
                                                >
                                                    <Plus className="w-4 h-4 mr-1" /> Manage
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Modals */}
            <CreatePoolModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onPoolCreated={handlePoolCreated}
            />

            {selectedPool && (
                <LiquidityModal
                    isOpen={isLiquidityModalOpen}
                    onClose={() => setIsLiquidityModalOpen(false)}
                    poolId={selectedPool.poolId}
                    tokenA={selectedPool.tokenSymbol.replace('t', '')}
                    tokenB="USDC"
                    regime={regime}
                />
            )}
        </div>
    );
}

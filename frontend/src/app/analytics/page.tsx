'use client';

import { useStockShield } from '@/hooks/useStockShield';
import { RegimeTimeline } from '@/components/analytics/RegimeTimeline';
import { OracleHealth } from '@/components/analytics/OracleHealth';
import { VPINHeatmap } from '@/components/analytics/VPINHeatmap';
import { YellowNetworkPanel } from '@/components/analytics/YellowNetworkPanel';
import { DotMatrix } from '@/components/ui/dot-matrix';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AnalyticsPage() {
    const { regime, marketState } = useStockShield();

    // Mock last update time since loop/time updates aren't pushed in demo hook
    const lastOracleUpdate = Math.floor(Date.now() / 1000) - 15;

    return (
        <main className="min-h-screen bg-[#050505] text-white selection:bg-[#FF4D00] selection:text-white">
            {/* GRID LINES OVERLAY — matches landing page */}
            <div className="fixed inset-0 pointer-events-none z-0 flex justify-center">
                <div className="w-full max-w-[1400px] border-x border-white/5 h-full" />
            </div>

            {/* NAV — consistent with landing page */}
            <nav className="fixed top-0 w-full z-50 h-20 flex items-center justify-center border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm">
                <div className="w-full max-w-[1400px] px-8 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative">
                            <img
                                src="/icon.png"
                                alt="StockShield"
                                className="w-8 h-8 transition-transform duration-300 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-[#FF4D00] blur-lg opacity-0 group-hover:opacity-30 transition-opacity duration-300" />
                        </div>
                        <div className="flex items-baseline gap-0.5">
                            <span className="font-sans text-lg font-semibold tracking-tight text-white">Stock</span>
                            <span className="font-sans text-lg font-semibold tracking-tight text-[#FF4D00]">Shield</span>
                            <span className="text-[#FF4D00] text-xs font-mono ml-1 opacity-50">v1</span>
                        </div>
                    </Link>

                    <div className="hidden md:flex gap-8 text-[13px] font-medium tracking-wide uppercase text-neutral-400">
                        <Link href="/demo" className="hover:text-[#FF4D00] transition-colors flex items-center gap-1">
                            Demo <span className="text-[8px] px-1 py-0.5 bg-[#FF4D00]/20 text-[#FF4D00] rounded">LIVE</span>
                        </Link>
                        <Link href="/app" className="hover:text-white transition-colors flex items-center gap-1">
                            Trade <span className="text-[8px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">SEPOLIA</span>
                        </Link>
                        <Link href="/pools" className="hover:text-white transition-colors">
                            Pools
                        </Link>
                        <Link href="/analytics" className="text-white transition-colors">
                            Analytics
                        </Link>
                    </div>

                    <Link href="/app">
                        <Button variant="outline" className="rounded-sm border-[#FF4D00]/30 bg-[#FF4D00]/10 text-[#FF4D00] text-[13px] font-medium px-6 py-5 hover:bg-[#FF4D00] hover:text-white transition-all uppercase tracking-wide">
                            Start Trading →
                        </Button>
                    </Link>
                </div>
            </nav>

            {/* PAGE CONTENT */}
            <div className="relative z-10 pt-28 pb-24">
                <div className="max-w-[1400px] mx-auto px-8">
                    {/* Page Header — matches landing page section style */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
                        <div className="md:col-span-3">
                            <div className="sticky top-32">
                                <div className="w-8 h-[2px] bg-[#FF4D00] mb-4" />
                                <DotMatrix text="PROTOCOL" size="sm" className="text-neutral-500" />
                                <DotMatrix text="ANALYTICS" size="sm" className="text-neutral-500" />
                            </div>
                        </div>
                        <div className="md:col-span-9">
                            <h1 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.1] mb-6 text-white">
                                Real-Time Risk<br />
                                Monitoring.
                            </h1>
                            <p className="text-neutral-400 max-w-2xl text-base leading-relaxed">
                                Live visualization of StockShield&apos;s protection mechanisms — regime detection,
                                VPIN toxicity scoring, oracle health, and Yellow Network state channel status.
                            </p>
                        </div>
                    </div>

                    {/* Dashboard Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
                        {/* Regime Timeline — Left Column */}
                        <div className="lg:col-span-4">
                            <RegimeTimeline currentRegime={regime} />
                        </div>

                        {/* Right Column — Oracle + VPIN */}
                        <div className="lg:col-span-8 flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <OracleHealth
                                    lastUpdateTimestamp={lastOracleUpdate}
                                    lastPrice={185.0}
                                    currentPrice={185.42}
                                />
                                <VPINHeatmap currentScore={marketState.vpinScore} />
                            </div>
                        </div>
                    </div>

                    {/* Yellow Network Panel — Full Width, Hero Treatment */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
                        <div className="md:col-span-3">
                            <div className="sticky top-32">
                                <div className="w-8 h-[2px] bg-yellow-500 mb-4" />
                                <DotMatrix text="YELLOW" size="sm" className="text-neutral-500" />
                                <DotMatrix text="NETWORK" size="sm" className="text-neutral-500" />
                            </div>
                        </div>
                        <div className="md:col-span-9">
                            <YellowNetworkPanel />
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER — matches landing page */}
            <footer className="py-16 px-8 bg-[#050505] relative overflow-hidden border-t border-white/5">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-xs text-neutral-600">© 2026 StockShield Protocol. All rights reserved.</p>
                        <div className="flex gap-6 text-xs text-neutral-500">
                            <Link href="/" className="hover:text-white transition-colors">Home</Link>
                            <Link href="/demo" className="hover:text-white transition-colors">Demo</Link>
                            <Link href="/app" className="hover:text-white transition-colors">Trade</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}

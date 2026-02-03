'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ShieldCheck, Zap, Clock, Gavel } from 'lucide-react';
import { BentoGrid, BentoGridItem } from '@/components/ui/bento-grid';
import { DotMatrix } from '@/components/ui/dot-matrix';

// Lazy load heavy canvas
const ParticleHero = dynamic(
  () => import('@/components/canvas/ParticleHero').then(mod => ({ default: mod.ParticleHero })),
  { ssr: false, loading: () => <div className="absolute inset-0 bg-[#050505]" /> }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-[#FF4D00] selection:text-white">
      {/* 
        GRID LINES OVERLAY 
        The reference shows visible vertical borders separating the center content from the sides.
        We'll create a 3-column grid structure that runs down the page.
      */}
      <div className="fixed inset-0 pointer-events-none z-50 flex justify-center">
        <div className="w-full max-w-[1400px] border-x border-white/5 h-full relative">
          {/* Center line or additional grid lines if needed */}
        </div>
      </div>

      {/* NAV */}
      <nav className="fixed top-0 w-full z-50 h-20 flex items-center justify-center border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm">
        <div className="w-full max-w-[1400px] px-8 flex justify-between items-center">
          {/* Logo - Avant-Garde Web3 Style */}
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

          <div className="hidden md:flex gap-12 text-[13px] font-medium tracking-wide uppercase text-neutral-400">
            <Link href="/demo" className="hover:text-white transition-colors">Demo +</Link>
            <Link href="/docs" className="hover:text-white transition-colors">Docs +</Link>
            <Link href="/StockSheild_whitepaper.pdf" target="_blank" className="hover:text-white transition-colors">Whitepaper +</Link>
          </div>

          <Link href="/app">
            <Button variant="outline" className="rounded-sm border-white/10 bg-white/5 text-[13px] font-medium px-6 py-5 hover:bg-white hover:text-black transition-all uppercase tracking-wide">
              Launch App
            </Button>
          </Link>
        </div>
      </nav>

      {/* HERO SECTION */}
      {/* Explicit height and relative positioning to contain the absolute canvas */}
      <section className="relative w-full h-screen min-h-[800px] flex flex-col items-center justify-center overflow-hidden border-b border-white/5 bg-[#050505] pt-0">

        {/* Particle Canvas Layer - Explicit full coverage */}
        <div className="absolute inset-0 z-0">
          <ParticleHero />
        </div>

        <div className="z-10 flex flex-col items-center text-center px-4 max-w-4xl relative mt-20">
          {/* W/04 Branding -> S/01 for StockShield */}
          <DotMatrix text="S/01" size="lg" className="mb-8 opacity-90 text-white" />

          <h1 className="text-4xl md:text-6xl font-medium tracking-tight leading-[1.15] mb-10 text-neutral-200">
            The <span className="text-white">Protection Layer</span> for<br />
            Tokenized Stock <span className="text-white">LPs</span>.<br />
            Built on Uniswap v4.
          </h1>

          <div className="flex gap-4 mt-2">
            {/* Whitepaper button - opens PDF in new tab */}
            <Link href="/StockSheild_whitepaper.pdf" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-white/10 bg-[#111] text-white hover:bg-white/10 rounded-md px-8 py-6 text-sm font-medium transition-all">
                Read Whitepaper
              </Button>
            </Link>

            {/* Demo button */}
            <Link href="/demo">
              <Button className="bg-[#FF4D00] hover:bg-[#ff5e1a] text-white rounded-md px-8 py-6 text-sm font-medium transition-all shadow-[0_0_30px_rgba(255,77,0,0.2)]">
                Explore Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ABOUT / MISSION (Matching "Beyond Services" Layout) */}
      <section className="py-32 bg-[#050505] border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-8 grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Left Column title */}
          <div className="md:col-span-3">
            <div className="sticky top-32">
              <DotMatrix text="ABOUT" size="sm" className="mb-1 text-neutral-500" />
              <DotMatrix text="STOCKSHIELD" size="sm" className="text-neutral-500" />
            </div>
          </div>

          {/* Right Content */}
          <div className="md:col-span-9">
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight leading-[1.1] mb-16 text-white">
              The Discontinuous Hedging<br />
              Problem, Solved.
            </h2>

            <div className="grid md:grid-cols-2 gap-16 text-base leading-relaxed text-neutral-400">
              <p>
                Traditional AMMs trade 24/7, but <span className="text-white">stock markets have trading hours</span>. When NYSE closes at 4 PM ET, LPs can&apos;t hedge—yet arbitrageurs exploit stale prices overnight and on weekends.
              </p>
              <div className="space-y-6">
                <p>
                  <span className="text-white">LPs lose 40–60% more</span> on tokenized securities vs. crypto assets due to this fundamental mismatch.
                </p>
                <p>
                  StockShield is a Uniswap v4 Hook that dynamically adjusts fees based on market regime, detects toxic flow via VPIN, captures gap value through auctions, and pauses trading during extreme volatility.
                </p>
                <p>
                  The result: LPs keep more of what they earn, and arbitrageurs pay fair value for information asymmetry.
                </p>
              </div>
            </div>

            {/* Bottom 3 Grid Items (Image, Text, Start) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24">
              {/* 1. Mini Particle Box */}
              <div className="aspect-square rounded-xl bg-[#0A0A0A] border border-white/5 overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                {/* Reuse a smaller particle view here if possible, or a static graphic */}
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="h-32 w-full rounded-full bg-[#FF4D00] blur-[80px] opacity-20" />
                </div>
              </div>

              {/* 2. Text Box */}
              <div className="aspect-square rounded-xl bg-[#0A0A0A] border border-white/5 p-8 flex flex-col justify-between">
                <p className="text-lg text-neutral-400 leading-snug">
                  &quot;LPs provide the liquidity. They deserve fair protection.&quot;
                </p>
                <div className="flex justify-between items-end">
                  <div>
                    <DotMatrix text="S/01" size="md" className="mb-2" />
                    <div className="text-xs text-neutral-500">Uniswap v4 Hooks</div>
                    <div className="text-xs text-neutral-500">Yellow Network ERC-7824</div>
                  </div>
                  <div className="bg-[#FF4D00] p-2 rounded-sm">
                    <ArrowUpRight className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* 3. V01 / START */}
              <div className="flex flex-col gap-4">
                <div className="flex-1 rounded-xl bg-[#e5e5e5] flex items-center justify-center">
                  <DotMatrix text="V01" size="lg" className="text-black opacity-80" />
                </div>
                <div className="flex-1 rounded-xl bg-[#e5e5e5] flex items-center justify-center">
                  <DotMatrix text="START" size="lg" className="text-black opacity-80" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES BENTO */}
      <section className="py-32 bg-[#050505] border-b border-white/5" id="service">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            <div className="md:col-span-3">
              <div className="sticky top-32">
                <div className="w-8 h-[2px] bg-[#FF4D00] mb-4" />
                <DotMatrix text="SERVICES" size="sm" className="text-neutral-500" />
              </div>
            </div>
            <div className="md:col-span-9">
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight mb-6 text-white">
                Four-Layer Protection
              </h2>
              <p className="text-neutral-400 max-w-2xl text-base leading-relaxed">
                StockShield implements a multi-layered defense system that adapts to market conditions in real-time, protecting LPs from exploitation during off-hours trading.
              </p>
            </div>
          </div>

          <BentoGrid className="max-w-none">
            <BentoGridItem
              title="Regime Detection"
              description="Automatically identifies Core Session, Pre/Post Market, Overnight, and Weekend regimes based on NYSE trading hours."
              header={<div className="flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-white/5 relative group p-6 overflow-hidden">
                <div className="absolute top-4 right-4 bg-[#FF4D00] text-white text-[10px] font-bold px-2 py-1 rounded-sm tracking-wider">01</div>
                <Clock className="absolute bottom-4 left-4 w-8 h-8 text-white/10 group-hover:text-[#FF4D00]/30 transition-colors duration-500" />
              </div>}
              className="md:col-span-1"
            />
            <BentoGridItem
              title="Dynamic Fees"
              description="Fees scale from 5 bps (Core) to 50 bps (Weekend) + volatility, VPIN toxicity, and inventory imbalance components."
              header={<div className="flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-white/5 relative group p-6 overflow-hidden">
                <div className="absolute top-4 right-4 bg-[#FF4D00] text-white text-[10px] font-bold px-2 py-1 rounded-sm tracking-wider">02</div>
                <Zap className="absolute bottom-4 left-4 w-8 h-8 text-white/10 group-hover:text-[#FF4D00]/30 transition-colors duration-500" />
              </div>}
              className="md:col-span-1"
            />
            <BentoGridItem
              title="Circuit Breakers"
              description="Four-level graduated response: spread widening, depth reduction, and full trading pause when multiple risk flags trigger."
              header={<div className="flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-white/5 relative group p-6 overflow-hidden">
                <div className="absolute top-4 right-4 bg-[#FF4D00] text-white text-[10px] font-bold px-2 py-1 rounded-sm tracking-wider">03</div>
                <ShieldCheck className="absolute bottom-4 left-4 w-8 h-8 text-white/10 group-hover:text-[#FF4D00]/30 transition-colors duration-500" />
              </div>}
              className="md:col-span-1"
            />
            <BentoGridItem
              title="Gap Capture Auctions"
              description="When markets gap overnight, a Dutch auction captures 70% of the gap value for LPs instead of arbitrageurs."
              header={<div className="flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-[#0f0f0f] to-[#0a0a0a] border border-white/5 relative group p-6 overflow-hidden">
                <div className="absolute top-4 right-4 bg-[#FF4D00] text-white text-[10px] font-bold px-2 py-1 rounded-sm tracking-wider">04</div>
                <Gavel className="absolute bottom-4 left-4 w-8 h-8 text-white/10 group-hover:text-[#FF4D00]/30 transition-colors duration-500" />
              </div>}
              className="md:col-span-1"
            />
          </BentoGrid>
        </div>
      </section>

      {/* TECHNOLOGY STACK */}
      <section className="py-24 bg-[#050505] border-b border-white/5">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
            <div className="md:col-span-3">
              <div className="sticky top-32">
                <div className="w-8 h-[2px] bg-[#FF4D00] mb-4" />
                <DotMatrix text="BUILT WITH" size="sm" className="text-neutral-500" />
              </div>
            </div>
            <div className="md:col-span-9">
              <h2 className="text-3xl md:text-4xl font-medium tracking-tight mb-4 text-white">
                Enterprise-Grade Infrastructure
              </h2>
              <p className="text-neutral-400 max-w-2xl text-base leading-relaxed">
                StockShield leverages cutting-edge DeFi primitives for maximum security and performance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 rounded-xl bg-[#0a0a0a] border border-white/5 group hover:border-white/10 transition-all">
              <div className="w-12 h-12 rounded-lg bg-[#0f0f0f] border border-white/5 flex items-center justify-center mb-6">
                <span className="text-2xl">🦄</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Uniswap v4 Hooks</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Native hook integration for on-chain fee adjustments and trading controls without external dependencies.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[#0a0a0a] border border-white/5 group hover:border-white/10 transition-all">
              <div className="w-12 h-12 rounded-lg bg-[#0f0f0f] border border-white/5 flex items-center justify-center mb-6">
                <span className="text-2xl">🟡</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Yellow Network ERC-7824</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                State channel technology for sub-second fee updates and high-frequency regime detection.
              </p>
            </div>
            <div className="p-8 rounded-xl bg-[#0a0a0a] border border-white/5 group hover:border-white/10 transition-all">
              <div className="w-12 h-12 rounded-lg bg-[#0f0f0f] border border-white/5 flex items-center justify-center mb-6">
                <span className="text-2xl">🔗</span>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Chainlink + Pyth Oracles</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Dual-source price feeds for accurate gap detection and staleness monitoring.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-24 px-8 bg-[#050505] relative overflow-hidden border-t border-white/5">
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] opacity-[0.03] pointer-events-none select-none">
          <DotMatrix text="S/01" size="lg" className="text-[200px] font-bold" />
        </div>

        <div className="max-w-[1400px] mx-auto">
          {/* Top section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            <div className="md:col-span-4">
              <div className="w-8 h-[2px] bg-[#FF4D00] mb-6" />
              <span className="font-sans text-2xl font-medium tracking-tight">StockShield.</span>
              <p className="mt-4 text-sm text-neutral-500 leading-relaxed max-w-xs">
                The protection layer for tokenized stock LPs. Built on Uniswap v4 Hooks.
              </p>
            </div>

            <div className="md:col-span-2 md:col-start-7">
              <h4 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">Protocol</h4>
              <div className="flex flex-col gap-3 text-sm text-neutral-400">
                <Link href="/demo" className="hover:text-white transition-colors">Demo</Link>
                <Link href="#" className="hover:text-white transition-colors">Documentation</Link>
                <Link href="#" className="hover:text-white transition-colors">Whitepaper</Link>
              </div>
            </div>

            <div className="md:col-span-2">
              <h4 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">Resources</h4>
              <div className="flex flex-col gap-3 text-sm text-neutral-400">
                <Link href="#" className="hover:text-white transition-colors">GitHub</Link>
                <Link href="#" className="hover:text-white transition-colors">Blog</Link>
                <Link href="#" className="hover:text-white transition-colors">FAQ</Link>
              </div>
            </div>

            <div className="md:col-span-2">
              <h4 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">Community</h4>
              <div className="flex flex-col gap-3 text-sm text-neutral-400">
                <Link href="#" className="hover:text-white transition-colors">Twitter</Link>
                <Link href="#" className="hover:text-white transition-colors">Discord</Link>
                <Link href="#" className="hover:text-white transition-colors">Telegram</Link>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-neutral-600">© 2026 StockShield Protocol. All rights reserved.</p>
            <div className="flex gap-6 text-xs text-neutral-500">
              <Link href="#" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

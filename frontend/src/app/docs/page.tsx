'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    ChevronLeft, ChevronRight, FileText, Book, Zap, Shield, Clock,
    AlertTriangle, ExternalLink, Download, Copy, Check
} from 'lucide-react';
import { DotMatrix } from '@/components/ui/dot-matrix';

// ============================================================================
// SIDEBAR NAVIGATION
// ============================================================================
const DOCS_SECTIONS = [
    {
        title: 'Getting Started',
        items: [
            { id: 'overview', label: 'Overview', icon: Book },
            { id: 'problem', label: 'The Problem', icon: AlertTriangle },
            { id: 'solution', label: 'Solution Architecture', icon: Shield },
        ],
    },
    {
        title: 'Core Mechanisms',
        items: [
            { id: 'regime', label: 'Regime Detection', icon: Clock },
            { id: 'fees', label: 'Dynamic Fees', icon: Zap },
            { id: 'circuit', label: 'Circuit Breakers', icon: Shield },
            { id: 'auction', label: 'Gap Auctions', icon: FileText },
        ],
    },
    {
        title: 'Technical',
        items: [
            { id: 'integration', label: 'Integration Guide', icon: FileText },
            { id: 'contracts', label: 'Smart Contracts', icon: FileText },
        ],
    },
    {
        title: 'Resources',
        items: [
            { id: 'whitepaper', label: 'Whitepaper', icon: Download },
            { id: 'references', label: 'References', icon: ExternalLink },
        ],
    },
];

// ============================================================================
// CODE BLOCK COMPONENT
// ============================================================================
function CodeBlock({ code, language = 'typescript' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group bg-[#0a0a0a] rounded-lg border border-white/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.02]">
                <span className="text-xs text-neutral-500">{language}</span>
                <button
                    onClick={handleCopy}
                    className="text-neutral-500 hover:text-white transition-colors"
                >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>
            <pre className="p-4 text-sm overflow-x-auto">
                <code className="text-neutral-300">{code}</code>
            </pre>
        </div>
    );
}

// ============================================================================
// TABLE COMPONENT
// ============================================================================
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
    return (
        <div className="overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-sm">
                <thead className="bg-white/[0.02] border-b border-white/5">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="px-4 py-3 text-left text-neutral-400 font-medium">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                            {row.map((cell, j) => (
                                <td key={j} className="px-4 py-3 text-neutral-300">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================================
// DOCS CONTENT BY SECTION
// ============================================================================
function DocsContent({ section }: { section: string }) {
    switch (section) {
        case 'overview':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">StockShield Protocol</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            A Uniswap v4 Hook that protects liquidity providers in tokenized securities AMMs
                            from exploitation during off-hours trading.
                        </p>
                    </div>

                    <div className="p-6 bg-[#FF4D00]/10 border border-[#FF4D00]/20 rounded-lg">
                        <h3 className="font-medium text-[#FF4D00] mb-2">Core Value Proposition</h3>
                        <p className="text-neutral-300">
                            Traditional AMMs lose 40-60% more on tokenized securities vs. crypto assets due to
                            the discontinuous hedging problem. StockShield solves this with four integrated
                            protection mechanisms.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
                            <Clock className="w-6 h-6 text-[#FF4D00] mb-3" />
                            <h4 className="font-medium mb-1">Regime Detection</h4>
                            <p className="text-sm text-neutral-500">Automatic market session identification</p>
                        </div>
                        <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
                            <Zap className="w-6 h-6 text-[#FF4D00] mb-3" />
                            <h4 className="font-medium mb-1">Dynamic Fees</h4>
                            <p className="text-sm text-neutral-500">5-50 bps based on market conditions</p>
                        </div>
                        <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
                            <Shield className="w-6 h-6 text-[#FF4D00] mb-3" />
                            <h4 className="font-medium mb-1">Circuit Breakers</h4>
                            <p className="text-sm text-neutral-500">Graduated response to extreme volatility</p>
                        </div>
                        <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
                            <FileText className="w-6 h-6 text-[#FF4D00] mb-3" />
                            <h4 className="font-medium mb-1">Gap Auctions</h4>
                            <p className="text-sm text-neutral-500">Capture 70% of gap value for LPs</p>
                        </div>
                    </div>
                </div>
            );

        case 'problem':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">The Discontinuous Hedging Problem</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Why traditional AMMs fail for tokenized securities.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xl font-medium">The Core Issue</h3>
                        <p className="text-neutral-400">
                            AMMs trade 24/7, but stock markets have trading hours. When NYSE closes at 4 PM ET,
                            LPs cannot hedge their positions—yet arbitrageurs can exploit any price discrepancies
                            when the oracle updates.
                        </p>

                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <h4 className="font-medium text-red-400 mb-2">Impact on LPs</h4>
                            <ul className="text-neutral-300 space-y-2">
                                <li>• <strong>Overnight gaps:</strong> After-hours earnings create 5-8% price gaps</li>
                                <li>• <strong>Weekend exposure:</strong> 60+ hours without hedging ability</li>
                                <li>• <strong>Information asymmetry:</strong> Arbitrageurs have sub-second oracle access</li>
                                <li>• <strong>Result:</strong> LPs lose 40-60% more vs. crypto-native assets</li>
                            </ul>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-4">Academic Foundation</h3>
                        <DataTable
                            headers={['Paper', 'Contribution']}
                            rows={[
                                ['Avellaneda-Stoikov (2008)', 'Inventory risk model for market makers'],
                                ['Kyle (1985)', 'Price impact and informed trading theory'],
                                ['Milionis et al. (2023)', 'Loss-versus-rebalancing (LVR) framework'],
                            ]}
                        />
                    </div>
                </div>
            );

        case 'fees':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">Dynamic Fee System</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Real-time fee adjustment based on market conditions.
                        </p>
                    </div>

                    <div className="p-6 bg-[#0a0a0a] rounded-lg border border-white/5">
                        <h3 className="text-lg font-medium mb-4">Fee Formula</h3>
                        <div className="text-2xl font-mono text-center py-6 bg-white/[0.02] rounded-lg mb-4">
                            Fee = f₀ + ασ² + β·VPIN + γ·R + δ|I|
                        </div>
                        <DataTable
                            headers={['Component', 'Symbol', 'Description']}
                            rows={[
                                ['Base Fee', 'f₀', 'Regime-dependent: 5-50 bps'],
                                ['Volatility', 'ασ²', 'Realized volatility component (α=0.5)'],
                                ['VPIN', 'β·VPIN', 'Toxicity detection (β=0.3)'],
                                ['Regime', 'γ·R', 'Session multiplier (1x-6x)'],
                                ['Inventory', 'δ|I|', 'Imbalance adjustment (δ=0.2)'],
                            ]}
                        />
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-4">Regime Fee Schedule</h3>
                        <DataTable
                            headers={['Regime', 'Hours (ET)', 'Base Fee', 'Multiplier']}
                            rows={[
                                ['Core Session', '9:35-16:00', '5 bps', '1.0x'],
                                ['Soft Open', '9:30-9:35', '10 bps', '1.5x'],
                                ['Pre/Post Market', '4:00-9:30, 16:00-20:00', '15 bps', '2.0x'],
                                ['Overnight', '20:00-4:00', '30 bps', '4.0x'],
                                ['Weekend', 'Fri 20:00 - Mon 4:00', '50 bps', '6.0x'],
                            ]}
                        />
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-4">Implementation</h3>
                        <CodeBlock
                            language="solidity"
                            code={`function calculateDynamicFee(
    Regime regime,
    uint256 volatility,
    uint256 vpin,
    int256 inventoryImbalance
) public pure returns (uint256 fee) {
    uint256 baseFee = BASE_FEES[regime];
    uint256 regimeMultiplier = REGIME_MULTIPLIERS[regime];
    
    fee = baseFee
        + (ALPHA * volatility * volatility) / 1e18
        + (BETA * vpin) / 1e18
        + (GAMMA * regimeMultiplier) / 1e18
        + (DELTA * abs(inventoryImbalance)) / 1e18;
    
    return min(fee, MAX_FEE);
}`}
                        />
                    </div>
                </div>
            );

        case 'regime':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">Regime Detection</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Automatic identification of market trading sessions.
                        </p>
                    </div>

                    <DataTable
                        headers={['Regime', 'Detection Logic', 'Protection Level']}
                        rows={[
                            ['CORE', 'Mon-Fri 9:35-16:00 ET + NYSE open', 'Standard'],
                            ['SOFT_OPEN', 'Mon-Fri 9:30-9:35 ET', 'Elevated'],
                            ['PRE_MARKET', 'Mon-Fri 4:00-9:30 ET', 'High'],
                            ['AFTER_HOURS', 'Mon-Fri 16:00-20:00 ET', 'High'],
                            ['OVERNIGHT', 'Mon-Fri 20:00-4:00 ET', 'Maximum'],
                            ['WEEKEND', 'Fri 20:00 - Mon 4:00 ET', 'Maximum'],
                            ['HOLIDAY', 'NYSE holidays', 'Maximum'],
                        ]}
                    />

                    <CodeBlock
                        language="typescript"
                        code={`function getRegime(timestamp: Date): Regime {
  const et = toEasternTime(timestamp);
  const day = et.getDay();
  const minutes = et.getHours() * 60 + et.getMinutes();
  
  // Weekend check
  if (day === 0 || day === 6) return 'WEEKEND';
  
  // Core session: 9:35-16:00 ET
  if (minutes >= 575 && minutes < 960) return 'CORE';
  
  // Soft open: 9:30-9:35 ET
  if (minutes >= 570 && minutes < 575) return 'SOFT_OPEN';
  
  // Pre-market: 4:00-9:30 ET
  if (minutes >= 240 && minutes < 570) return 'PRE_MARKET';
  
  // After-hours: 16:00-20:00 ET
  if (minutes >= 960 && minutes < 1200) return 'AFTER_HOURS';
  
  return 'OVERNIGHT';
}`}
                    />
                </div>
            );

        case 'circuit':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">Circuit Breakers</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Four-level graduated response to extreme market conditions.
                        </p>
                    </div>

                    <DataTable
                        headers={['Level', 'Trigger Conditions', 'Effect']}
                        rows={[
                            ['0 - Normal', 'No risk flags', 'Standard trading'],
                            ['1 - Caution', '1 flag (e.g., high VPIN)', 'Spread +20%'],
                            ['2 - Warning', '2 flags', 'Spread +50%, Depth -25%'],
                            ['3 - Severe', '3 flags', 'Spread +100%, Depth -50%'],
                            ['4 - Halt', '4+ flags or oracle stale >5min', 'Trading paused'],
                        ]}
                    />

                    <div>
                        <h3 className="text-xl font-medium mb-4">Risk Flags</h3>
                        <ul className="space-y-3 text-neutral-400">
                            <li className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-white">Oracle Staleness:</strong> Last update &gt;60 seconds ago</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-white">Price Deviation:</strong> Pool price &gt;2% from oracle</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-white">High VPIN:</strong> VPIN &gt;0.7 (toxic flow detected)</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                                <span><strong className="text-white">Inventory Imbalance:</strong> |I| &gt;0.4</span>
                            </li>
                        </ul>
                    </div>
                </div>
            );

        case 'auction':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">Gap Capture Auctions</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Dutch auctions that transfer gap value from arbitrageurs to LPs.
                        </p>
                    </div>

                    <div className="p-6 bg-[#0a0a0a] rounded-lg border border-white/5">
                        <h3 className="text-lg font-medium mb-4">Auction Formula</h3>
                        <div className="text-2xl font-mono text-center py-6 bg-white/[0.02] rounded-lg mb-4">
                            MinBid(t) = Gap × L × 70% × e<sup>-0.4t</sup>
                        </div>
                        <DataTable
                            headers={['Variable', 'Description']}
                            rows={[
                                ['Gap', 'Oracle price - Pool price'],
                                ['L', 'Available liquidity'],
                                ['70%', 'LP capture rate'],
                                ['e^(-0.4t)', 'Time decay (t in minutes)'],
                            ]}
                        />
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-4">How It Works</h3>
                        <ol className="space-y-4 text-neutral-400">
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-[#FF4D00] text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">1</span>
                                <span>Market gaps overnight (e.g., earnings announcement)</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-[#FF4D00] text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">2</span>
                                <span>StockShield detects gap when oracle updates</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-[#FF4D00] text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">3</span>
                                <span>Dutch auction starts with high minimum bid</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-[#FF4D00] text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">4</span>
                                <span>First bidder to pay MinBid(t) wins the arbitrage opportunity</span>
                            </li>
                            <li className="flex gap-3">
                                <span className="w-6 h-6 bg-[#FF4D00] text-white rounded-full flex items-center justify-center text-sm flex-shrink-0">5</span>
                                <span>Bid proceeds go to LPs, not protocol</span>
                            </li>
                        </ol>
                    </div>
                </div>
            );

        case 'whitepaper':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">Whitepaper</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Complete technical specification of the StockShield protocol.
                        </p>
                    </div>

                    <div className="p-8 bg-[#0a0a0a] rounded-lg border border-white/5 text-center">
                        <FileText className="w-16 h-16 text-[#FF4D00] mx-auto mb-4" />
                        <h3 className="text-xl font-medium mb-2">StockShield: LP Protection for Tokenized Securities</h3>
                        <p className="text-neutral-500 mb-6">Version 1.0 — February 2024</p>
                        <Link href="/StockSheild_whitepaper.pdf" target="_blank">
                            <Button className="bg-[#FF4D00] hover:bg-[#ff5e1a]">
                                <Download className="w-4 h-4 mr-2" />
                                Download PDF
                            </Button>
                        </Link>
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-4">Table of Contents</h3>
                        <ul className="space-y-2 text-neutral-400">
                            <li>1. Abstract</li>
                            <li>2. Introduction & Problem Statement</li>
                            <li>3. Theoretical Background</li>
                            <li>4. Protocol Architecture</li>
                            <li>5. Mathematical Framework</li>
                            <li>6. Implementation Details</li>
                            <li>7. Security Analysis</li>
                            <li>8. Economic Model</li>
                            <li>9. Future Work</li>
                            <li>10. References</li>
                        </ul>
                    </div>
                </div>
            );

        case 'references':
            return (
                <div className="space-y-8">
                    <div>
                        <h1 className="text-3xl font-medium mb-4">References</h1>
                        <p className="text-neutral-400 text-lg leading-relaxed">
                            Academic papers and resources that inform StockShield's design.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
                            <h4 className="font-medium mb-1">Avellaneda, M., & Stoikov, S. (2008)</h4>
                            <p className="text-sm text-neutral-400 mb-2">High-frequency trading in a limit order book</p>
                            <a href="#" className="text-[#FF4D00] text-sm inline-flex items-center gap-1 hover:underline">
                                View Paper <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                        <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
                            <h4 className="font-medium mb-1">Kyle, A. S. (1985)</h4>
                            <p className="text-sm text-neutral-400 mb-2">Continuous Auctions and Insider Trading</p>
                            <a href="#" className="text-[#FF4D00] text-sm inline-flex items-center gap-1 hover:underline">
                                View Paper <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                        <div className="p-4 bg-[#0a0a0a] rounded-lg border border-white/5">
                            <h4 className="font-medium mb-1">Milionis, J., et al. (2023)</h4>
                            <p className="text-sm text-neutral-400 mb-2">Automated Market Making and Loss-Versus-Rebalancing</p>
                            <a href="#" className="text-[#FF4D00] text-sm inline-flex items-center gap-1 hover:underline">
                                View Paper <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>
            );

        default:
            return (
                <div className="space-y-8">
                    <h1 className="text-3xl font-medium">Documentation</h1>
                    <p className="text-neutral-400">Select a topic from the sidebar to get started.</p>
                </div>
            );
    }
}

// ============================================================================
// MAIN DOCS PAGE
// ============================================================================
export default function DocsPage() {
    const [activeSection, setActiveSection] = useState('overview');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-[#050505] text-white flex">
            {/* Sidebar */}
            <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 border-r border-white/5 bg-[#050505] transition-all duration-300 overflow-hidden`}>
                <div className="p-4 border-b border-white/5">
                    <Link href="/" className="flex items-center gap-2">
                        <DotMatrix text="S/01" size="sm" className="text-[#FF4D00]" />
                        <span className="font-medium">Docs</span>
                    </Link>
                </div>

                <nav className="p-4 space-y-6">
                    {DOCS_SECTIONS.map((section) => (
                        <div key={section.title}>
                            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                                {section.title}
                            </h3>
                            <ul className="space-y-1">
                                {section.items.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => setActiveSection(item.id)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === item.id
                                                    ? 'bg-[#FF4D00]/10 text-[#FF4D00]'
                                                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <item.icon className="w-4 h-4" />
                                            {item.label}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>

            {/* Toggle sidebar button */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-[#0a0a0a] border border-white/10 p-1 rounded-r-lg"
                style={{ left: sidebarOpen ? '256px' : '0' }}
            >
                {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Main content */}
            <main className="flex-1 min-w-0">
                <header className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#050505]/95 backdrop-blur-sm sticky top-0 z-40">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-neutral-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </Link>
                        <span className="text-sm text-neutral-500">Documentation</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/demo">
                            <Button variant="outline" size="sm" className="border-white/10">
                                Try Demo
                            </Button>
                        </Link>
                        <Link href="/app">
                            <Button size="sm" className="bg-[#FF4D00] hover:bg-[#ff5e1a]">
                                Launch App
                            </Button>
                        </Link>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto px-8 py-12">
                    <DocsContent section={activeSection} />
                </div>
            </main>
        </div>
    );
}

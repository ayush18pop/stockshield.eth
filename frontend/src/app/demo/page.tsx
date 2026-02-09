'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
    Play,
    Pause,
    RotateCcw,
    Shield,
    TrendingUp,
    Zap,
    Clock,
    Activity,
    BarChart3,
    ArrowUpRight,
    ArrowDownRight,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Server,
    Database,
    Lock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DotMatrix } from '@/components/ui/dot-matrix';

import {
    SCENARIOS,
    calculateProtectionValue,
    LP_CONFIG,
} from '@/lib/simulation/scenario-data';
import {
    SimulationState,
    SimulationFrame,
    createSimulationState,
    getCurrentFrame,
    advanceFrame,
    seekToProgress,
    seekToKeyMoment,
} from '@/lib/simulation/simulation-engine';

// Disable SSR for this page (uses client-side state)
export const dynamic = 'force-dynamic';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type Speed = 1 | 5 | 10 | 60;
type ScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const REGIME_COLORS: Record<string, string> = {
    CORE: '#22c55e',       // Green
    SOFT_OPEN: '#eab308',  // Yellow
    PRE_MARKET: '#3b82f6', // Blue
    AFTER_HOURS: '#8b5cf6',// Purple
    OVERNIGHT: '#6b7280',  // Gray
    WEEKEND: '#ef4444',    // Red
    HOLIDAY: '#ef4444',    // Red
};

const REGIME_LABELS: Record<string, string> = {
    CORE: 'Core Session',
    SOFT_OPEN: 'Soft Open',
    PRE_MARKET: 'Pre-Market',
    AFTER_HOURS: 'After Hours',
    OVERNIGHT: 'Overnight',
    WEEKEND: 'Weekend',
    HOLIDAY: 'Holiday',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatCurrency(value: number, showSign = true): string {
    const sign = showSign ? (value >= 0 ? '+' : '') : '';
    // Use monospace formatting
    return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ============================================================================
// COMPONENTS
// ============================================================================

function ScenarioSelector({
    selected,
    onSelect
}: {
    selected: ScenarioId;
    onSelect: (id: ScenarioId) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((scenario) => {
                const isSelected = selected === scenario.id;
                return (
                    <button
                        key={scenario.id}
                        onClick={() => onSelect(scenario.id as ScenarioId)}
                        className={`
                            px-4 py-2 text-xs font-mono tracking-wide uppercase border transition-all duration-300
                            ${isSelected
                                ? 'bg-[#FF4D00] text-white border-[#FF4D00]'
                                : 'bg-[#0a0a0a] text-neutral-500 border-white/5 hover:border-white/20 hover:text-white'}
                        `}
                    >
                        {scenario.stock} / {scenario.name}
                    </button>
                );
            })}
        </div>
    );
}

// ============================================================================
// PLAYBAR
// ============================================================================

function PlayBar({
    state,
    onSeek,
    onSeekToMoment,
}: {
    state: SimulationState;
    onSeek: (progress: number) => void;
    onSeekToMoment: (momentIndex: number) => void;
}) {
    const { precomputed, currentFrameIndex } = state;
    const { keyMomentIndices, frames, scenario } = precomputed;
    const progress = currentFrameIndex / (frames.length - 1);
    const [hoveredMoment, setHoveredMoment] = useState<number | null>(null);

    const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickProgress = (e.clientX - rect.left) / rect.width;
        onSeek(Math.max(0, Math.min(1, clickProgress)));
    };

    return (
        <div className="relative w-full py-6 group">
            {/* Tooltip */}
            {hoveredMoment !== null && (
                <div
                    className="absolute bottom-full mb-3 px-3 py-2 bg-[#0a0a0a] border border-white/10 text-xs font-mono text-white z-20 transform -translate-x-1/2"
                    style={{
                        left: `${((keyMomentIndices[hoveredMoment] ?? 0) / (frames.length - 1)) * 100}%`
                    }}
                >
                    <span className="text-[#FF4D00] mr-2">
                        {scenario.keyMoments[hoveredMoment]?.type === 'event' ? '⚠' : '▶'}
                    </span>
                    {scenario.keyMoments[hoveredMoment]?.label}
                </div>
            )}

            {/* Detailed Time Grid - decorative */}
            <div className="absolute top-0 w-full flex justify-between px-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} className="h-2 w-[1px] bg-white/10" />
                ))}
            </div>

            {/* Track */}
            <div
                className="relative h-1 bg-white/10 w-full cursor-pointer hover:h-1.5 transition-all duration-300"
                onClick={handleTrackClick}
            >
                {/* Progress */}
                <div
                    className="absolute h-full bg-[#FF4D00]"
                    style={{ width: `${progress * 100}%` }}
                />

                {/* Moments */}
                {keyMomentIndices.map((frameIdx, i) => {
                    const momentProgress = frameIdx / (frames.length - 1);
                    const moment = scenario.keyMoments[i];
                    const isEvent = moment?.type === 'event';

                    return (
                        <button
                            key={i}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSeekToMoment(i);
                            }}
                            onMouseEnter={() => setHoveredMoment(i)}
                            onMouseLeave={() => setHoveredMoment(null)}
                            className={`
                                absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rotate-45 transform transition-all
                                ${isEvent ? 'bg-[#FF4D00] scale-125' : 'bg-white/30 hover:bg-white'}
                            `}
                            style={{ left: `calc(${momentProgress * 100}% - 3px)` }}
                        />
                    );
                })}
            </div>

            {/* Scrubber Head */}
            <div
                className="absolute top-1/2 -translate-y-1/2 w-[1px] h-4 bg-[#FF4D00] pointer-events-none"
                style={{ left: `${progress * 100}%` }}
            >
                <div className="absolute -top-1 -left-[3px] w-[7px] h-[1px] bg-[#FF4D00]" />
                <div className="absolute -bottom-1 -left-[3px] w-[7px] h-[1px] bg-[#FF4D00]" />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-3 font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                <span>{scenario.keyMoments[0]?.label?.split('—')[0]?.trim()}</span>
                <span className="text-white">{frames[currentFrameIndex]?.time}</span>
                <span>{scenario.keyMoments[scenario.keyMoments.length - 1]?.label?.split('—')[0]?.trim()}</span>
            </div>
        </div>
    );
}

// ============================================================================
// CHART
// ============================================================================

function InteractivePriceChart({
    frames,
    currentIndex,
    scenario,
}: {
    frames: SimulationFrame[];
    currentIndex: number;
    scenario: typeof SCENARIOS[0];
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; price: number; idx: number } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.clearRect(0, 0, rect.width, rect.height);

        const allPrices = frames.map(f => f.oraclePrice);
        const minPrice = Math.min(...allPrices) * 0.98;
        const maxPrice = Math.max(...allPrices) * 1.02;
        const priceRange = maxPrice - minPrice;

        // Grid lines - Technical
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const y = (rect.height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(rect.width, y);
            ctx.stroke();

            // Axis labels inside chart
            const p = maxPrice - (priceRange / 5) * i;
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.font = '10px "Inter", monospace';
            ctx.fillText(p.toFixed(0), 6, y - 6);
        }

        // Draw Line
        const prices = frames.slice(0, currentIndex + 1).map(f => f.oraclePrice);
        if (prices.length > 1) {
            ctx.beginPath();

            // Logic for line color based on trend
            const lastPrice = prices[prices.length - 1];
            const firstPrice = prices[0];
            const isUp = (lastPrice !== undefined && firstPrice !== undefined) ? lastPrice >= firstPrice : true;
            const lineColor = '#FF4D00'; // Always brand color for main line

            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1.5;

            prices.forEach((price, i) => {
                const x = (i / (frames.length - 1)) * rect.width;
                const y = rect.height - ((price - minPrice) / priceRange) * rect.height;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.stroke();

            // Area fill gradient
            const lastX = (currentIndex / (frames.length - 1)) * rect.width;
            ctx.lineTo(lastX, rect.height);
            ctx.lineTo(0, rect.height);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, 0, 0, rect.height);
            grad.addColorStop(0, 'rgba(255, 77, 0, 0.1)');
            grad.addColorStop(1, 'rgba(255, 77, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Current point crosshair
            const currentPrice = prices[prices.length - 1];
            if (currentPrice !== undefined) {
                const cy = rect.height - ((currentPrice - minPrice) / priceRange) * rect.height;

                // Crosshair lines
                ctx.strokeStyle = 'rgba(255, 77, 0, 0.5)';
                ctx.setLineDash([2, 4]);
                ctx.lineWidth = 1;

                ctx.beginPath();
                ctx.moveTo(0, cy);
                ctx.lineTo(rect.width, cy);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(lastX, 0);
                ctx.lineTo(lastX, rect.height);
                ctx.stroke();

                ctx.setLineDash([]); // Reset

                // Point
                ctx.fillStyle = '#FF4D00';
                ctx.beginPath();
                ctx.rect(lastX - 2, cy - 2, 4, 4);
                ctx.fill();
            }
        }

        // Events markers
        scenario.keyMoments.forEach((moment) => {
            const currentOffsetMinutes = frames[currentIndex]?.offsetMinutes ?? 0;
            if (moment.type === 'event' && moment.offsetMinutes <= currentOffsetMinutes) {
                const frameIdx = Math.floor(moment.offsetMinutes * 10);
                const x = (frameIdx / (frames.length - 1)) * rect.width;
                // Just a subtle tick at the bottom
                ctx.fillStyle = '#FF4D00';
                ctx.fillRect(x - 0.5, rect.height - 4, 1, 4);
            }
        });

        // Hover
        if (hoveredPoint) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.moveTo(hoveredPoint.x, 0);
            ctx.lineTo(hoveredPoint.x, rect.height);
            ctx.stroke();
        }

    }, [frames, currentIndex, hoveredPoint, scenario]);

    const handleMouseMove = (e: React.MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const idx = Math.floor((x / rect.width) * (frames.length - 1));
        const price = frames[idx]?.oraclePrice ?? 0;
        setHoveredPoint({ x, y: 0, price, idx });
    };

    return (
        <div
            ref={containerRef}
            className="relative h-64 w-full bg-[#0a0a0a] border border-white/5 border-l-0 border-r-0 md:border md:rounded-sm overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredPoint(null)}
        >
            <div className="absolute top-4 left-4 z-10 font-mono text-xs text-[#FF4D00] flex items-center gap-2">
                <Activity className="w-3 h-3" />
                PRICE_ACTION
            </div>

            <canvas ref={canvasRef} className="w-full h-full" />

            {hoveredPoint && (
                <div
                    className="absolute bg-black/90 border border-white/10 px-2 py-1 text-[10px] font-mono text-white pointer-events-none"
                    style={{ left: hoveredPoint.x + 10, top: 20 }}
                >
                    ${hoveredPoint.price.toFixed(2)}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// COMPARISON METRICS
// ============================================================================

function ComparisonMetric({ label, traditional, shield, isPositiveGood = true }: { label: string, traditional: number, shield: number, isPositiveGood?: boolean }) {
    const isBetter = isPositiveGood ? shield > traditional : shield < traditional; // Simplified for display
    // Actually we want net value better.
    // Let's just color code positive numbers green, negative red, unless it's loss then inverted.

    return (
        <div className="grid grid-cols-3 gap-4 py-3 border-b border-white/5 text-xs font-mono group hover:bg-white/[0.02] transition-colors">
            <div className="text-neutral-500 uppercase tracking-widest flex items-center">{label}</div>
            <div className={`text-right ${traditional < 0 ? 'text-red-500/70' : 'text-neutral-400'}`}>
                {formatCurrency(traditional)}
            </div>
            <div className={`text-right font-medium ${shield >= 0 ? 'text-[#FF4D00]' : 'text-neutral-300'}`}>
                {formatCurrency(shield)}
            </div>
        </div>
    );
}

function ComparisonPanel({
    traditional,
    shield,
    scenario,
}: {
    traditional: SimulationFrame['traditionalPnL'];
    shield: SimulationFrame['shieldPnL'];
    scenario: typeof SCENARIOS[0];
}) {
    const delta = shield.netPnL - traditional.netPnL;

    return (
        <div className="h-full flex flex-col bg-[#0a0a0a] border border-white/5 md:rounded-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                    <Database className="w-3 h-3 text-[#FF4D00]" />
                    <span>PERFORMANCE_AUDIT</span>
                </div>
                {delta > 0 && (
                    <div className="text-[10px] font-mono text-[#FF4D00] border border-[#FF4D00]/20 px-2 py-0.5 bg-[#FF4D00]/5">
                        PROTECTION_ACTIVE
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-6 flex-1 flex flex-col gap-8">
                {/* Net P&L Big Display */}
                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Traditional P&L</div>
                        <div className={`text-2xl font-mono ${traditional.netPnL < 0 ? 'text-red-500' : 'text-white'}`}>
                            {formatCurrency(traditional.netPnL)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-[#FF4D00] mb-1">StockShield P&L</div>
                        <div className="text-2xl font-mono text-white flex items-center gap-2">
                            {formatCurrency(shield.netPnL)}
                            {shield.netPnL > traditional.netPnL && <ArrowUpRight className="w-4 h-4 text-[#FF4D00]" />}
                        </div>
                    </div>
                </div>

                {/* Grid Breakdown */}
                <div className="flex-1">
                    <div className="grid grid-cols-3 gap-4 pb-2 border-b border-white/10 text-[10px] uppercase tracking-widest text-neutral-600 font-medium">
                        <div>Metric</div>
                        <div className="text-right">Unprotected</div>
                        <div className="text-right text-[#FF4D00]">StockShield</div>
                    </div>

                    <ComparisonMetric label="Yield" traditional={traditional.feesEarned} shield={shield.feesEarned} />
                    <ComparisonMetric label="Imp. Loss" traditional={-traditional.impermanentLoss} shield={-shield.impermanentLoss} />
                    <ComparisonMetric label="Gap/Arb" traditional={-traditional.gapLoss - traditional.adverseSelectionLoss} shield={-shield.gapLoss - shield.adverseSelectionLoss + shield.gapAuctionGains} />
                </div>

                {/* Summary Box */}
                <div className="mt-auto bg-[#0f0f0f] border border-white/5 p-4 flex justify-between items-center">
                    <div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Net Protection Value</div>
                        <div className="text-xs text-neutral-400">Total capital preserved vs. baseline</div>
                    </div>
                    <div className="text-xl font-mono text-[#FF4D00] font-medium">
                        {formatCurrency(delta)}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DemoPage() {
    const [scenarioId, setScenarioId] = useState<ScenarioId>(1);
    const [simulation, setSimulation] = useState<SimulationState>(() =>
        createSimulationState(scenarioId)
    );
    const [speed, setSpeed] = useState<Speed>(5);
    const [isPlaying, setIsPlaying] = useState(false);

    // Reset simulation when scenario changes
    useEffect(() => {
        setSimulation(createSimulationState(scenarioId));
        setIsPlaying(false);
    }, [scenarioId]);

    // Playback loop
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            setSimulation(prev => {
                const next = advanceFrame(prev);
                if (next.currentFrameIndex >= next.precomputed.totalFrames - 1) {
                    setIsPlaying(false);
                }
                return next;
            });
        }, 100 / speed);

        return () => clearInterval(interval);
    }, [isPlaying, speed]);

    const currentFrame = getCurrentFrame(simulation);
    const scenario = simulation.precomputed.scenario;

    const handleSeek = useCallback((progress: number) => {
        setSimulation(prev => seekToProgress(prev, progress));
    }, []);

    const handleSeekToMoment = useCallback((momentIndex: number) => {
        setSimulation(prev => seekToKeyMoment(prev, momentIndex));
    }, []);

    const handleReset = useCallback(() => {
        setSimulation(createSimulationState(scenarioId));
        setIsPlaying(false);
    }, [scenarioId]);

    return (
        <main className="min-h-screen bg-[#050505] text-white selection:bg-[#FF4D00] selection:text-white font-sans">
            {/* GRID LINES OVERLAY */}
            <div className="fixed inset-0 pointer-events-none z-0 flex justify-center">
                <div className="w-full max-w-[1400px] border-x border-white/5 h-full relative" />
            </div>

            {/* NAV */}
            <nav className="fixed top-0 w-full z-50 h-16 flex items-center justify-center border-b border-white/5 bg-[#050505]/90 backdrop-blur-sm">
                <div className="w-full max-w-[1400px] px-6 lg:px-8 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-[#FF4D00] rounded-sm flex items-center justify-center text-black font-bold text-xs">S</div>
                        <div className="flex items-baseline gap-1">
                            <span className="font-semibold tracking-tight text-white">StockShield</span>
                            <span className="text-neutral-600 text-[10px] font-mono uppercase tracking-widest">Simulation // V1</span>
                        </div>
                    </Link>

                    <div className="flex items-center gap-6 text-[11px] font-mono text-neutral-500 uppercase tracking-widest">
                        <span>Balance: ${LP_CONFIG.initialBalance.toLocaleString()}</span>
                        <div className="h-4 w-[1px] bg-white/10" />
                        <span className={currentFrame.circuitBreakerLevel > 0 ? 'text-[#FF4D00]' : 'text-neutral-500'}>
                            Status: {currentFrame.circuitBreakerLevel > 0 ? 'RISK_DETECTED' : 'NOMINAL'}
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/">
                            <Button variant="ghost" className="text-white/60 hover:text-white text-xs uppercase tracking-wider font-mono">Exit</Button>
                        </Link>
                    </div>
                </div>
            </nav>

            <div className="pt-24 pb-12 relative z-10 max-w-[1400px] mx-auto px-6 lg:px-8">
                {/* Header Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
                    <div className="lg:col-span-8">
                        <DotMatrix text="SCENARIO_CONFIG" size="sm" className="mb-4 text-neutral-600" />
                        <h1 className="text-3xl font-medium tracking-tight mb-2 text-white/90">
                            {scenario.name}
                        </h1>
                        <p className="text-neutral-400 max-w-xl">{scenario.description}</p>
                    </div>
                    <div className="lg:col-span-4 flex items-end justify-end">
                        <div className="text-right">
                            <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest mb-1">Current Asset Price</div>
                            <div className="text-3xl font-mono tracking-tighter text-[#FF4D00]">
                                ${currentFrame.oraclePrice.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls & Scenario List */}
                <div className="mb-8 border-y border-white/5 py-4 flex flex-col md:flex-row items-center justify-between gap-6">
                    <ScenarioSelector selected={scenarioId} onSelect={setScenarioId} />

                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="bg-[#FF4D00] hover:bg-[#cc3d00] text-white border-0 rounded-sm w-10 h-10 p-0 flex items-center justify-center"
                        >
                            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        </Button>
                        <Button
                            onClick={handleReset}
                            variant="outline"
                            className="bg-transparent border-white/10 text-neutral-400 hover:text-white rounded-sm w-10 h-10 p-0"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>

                        <div className="h-6 w-[1px] bg-white/10 mx-2" />

                        {/* Speed Controls */}
                        <div className="flex gap-1">
                            {([1, 5, 10, 60] as Speed[]).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSpeed(s)}
                                    className={`px-2 py-1 text-[10px] font-mono rounded-sm transition-colors ${speed === s ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[800px] lg:h-[600px]">
                    {/* LEFT: VISUALIZATION */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <div className="flex-1 flex flex-col">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                                    <BarChart3 className="w-3 h-3" />
                                    Real-Time Simulation
                                </div>
                                <div className="text-[10px] font-mono text-[#FF4D00]">
                                    LIVE_FEED :: {Math.round(currentFrame?.vpin * 100)}% TOXICITY
                                </div>
                            </div>

                            <InteractivePriceChart
                                frames={simulation.precomputed.frames}
                                currentIndex={simulation.currentFrameIndex}
                                scenario={scenario}
                            />

                            <div className="mt-4">
                                <PlayBar
                                    state={simulation}
                                    onSeek={handleSeek}
                                    onSeekToMoment={handleSeekToMoment}
                                />
                            </div>
                        </div>

                        {/* System Logs / Metrics */}
                        <div className="grid grid-cols-3 gap-4 border-t border-white/5 pt-6">
                            <div>
                                <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1">Market Regime</div>
                                <div
                                    className="text-sm font-medium"
                                    style={{ color: REGIME_COLORS[currentFrame.regime] }}
                                >
                                    {REGIME_LABELS[currentFrame.regime]}
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1">Dynamic Fee</div>
                                <div className="text-sm font-mono text-white">
                                    {currentFrame.dynamicFee.toFixed(1)} bps
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-mono uppercase text-neutral-500 mb-1">Security Level</div>
                                <div className="flex items-center gap-2 text-sm text-white">
                                    {Array.from({ length: 4 }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-2 h-2 rounded-full ${i < currentFrame.circuitBreakerLevel ? 'bg-[#FF4D00]' : 'bg-neutral-800'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: DATA */}
                    <div className="lg:col-span-5 h-full">
                        <ComparisonPanel
                            traditional={currentFrame.traditionalPnL}
                            shield={currentFrame.shieldPnL}
                            scenario={scenario}
                        />
                    </div>
                </div>

                {/* Footer Status Line */}
                <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                    <div>System: ONLINE</div>
                    <div>Hook Address: 0x7a...8e21</div>
                    <div>Oracle Latency: 12ms</div>
                </div>
            </div>
        </main>
    );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    Play, Pause, RotateCcw, SkipForward, ChevronLeft,
    Clock, Zap, Shield, AlertTriangle
} from 'lucide-react';
import { calculateDynamicFee } from '@/lib/simulation/math/fee';
import { determineCircuitBreakerLevel, CIRCUIT_BREAKER_EFFECTS } from '@/lib/simulation/math/circuit-breaker';
import type { Regime, SimEvent } from '@/types/simulation';

// ============================================================================
// SCENARIO DEFINITIONS (PRD 4.2)
// ============================================================================
const SCENARIOS = [
    { id: 1, name: 'Overnight Earnings Surprise', stock: 'AAPL', difficulty: 2, description: 'Apple announces earnings after hours, causing a 10% gap up.' },
    { id: 2, name: 'Monday Morning Gap', stock: 'TSLA', difficulty: 3, description: 'Weekend tweet causes Monday open -15%.' },
    { id: 3, name: 'Flash Crash Recovery', stock: 'MSFT', difficulty: 3, description: 'Fat-finger error causes 12% crash, recovers in 45 seconds.' },
    { id: 4, name: 'Trading Halt', stock: 'GME', difficulty: 2, description: 'NYSE halts stock for news pending — oracle goes stale.' },
    { id: 5, name: 'Low-Liquidity Hour Attack', stock: 'AMZN', difficulty: 3, description: 'Whale manipulates thin ECN during pre-market.' },
    { id: 6, name: 'Informed Trader (VPIN)', stock: 'PFE', difficulty: 2, description: 'FDA announcement expected — VPIN spikes to 0.75.' },
    { id: 7, name: 'Weekend Holiday Disaster', stock: 'BAC', difficulty: 3, description: 'Friday holiday, European bank crisis on Saturday.' },
    { id: 8, name: 'Stale Oracle Attack', stock: 'NVDA', difficulty: 2, description: 'Attacker front-runs pending oracle update.' },
];

// ============================================================================
// SIMULATION STATE
// ============================================================================
interface PricePoint {
    time: number;
    oracle: number;
    pool: number;
}

interface PnLPoint {
    time: number;
    pnl: number;
}

interface SimulationState {
    simulatedTime: Date;
    elapsedSeconds: number;
    oraclePrice: number;
    poolPriceTraditional: number;
    poolPriceShield: number;
    currentRegime: Regime;
    dynamicFee: number;
    volatility: number;
    vpin: number;
    inventoryImbalance: number;
    circuitBreakerLevel: 0 | 1 | 2 | 3 | 4;
    lpPnLTraditional: number;
    lpPnLShield: number;
    feesCollectedTraditional: number;
    feesCollectedShield: number;
    events: SimEvent[];
    isGapAuction: boolean;
    priceHistoryTraditional: PricePoint[];
    priceHistoryShield: PricePoint[];
    pnlHistoryTraditional: PnLPoint[];
    pnlHistoryShield: PnLPoint[];
}

const REGIME_COLORS: Record<Regime, string> = {
    CORE: '#22c55e',
    SOFT_OPEN: '#84cc16',
    PRE_MARKET: '#eab308',
    AFTER_HOURS: '#f97316',
    OVERNIGHT: '#ef4444',
    WEEKEND: '#dc2626',
    HOLIDAY: '#dc2626',
};

function getRegimeFromTime(time: Date): Regime {
    const hours = time.getHours();
    const minutes = time.getMinutes();
    const day = time.getDay();
    const totalMinutes = hours * 60 + minutes;

    if (day === 0 || day === 6) return 'WEEKEND';
    if (totalMinutes >= 575 && totalMinutes < 960) return 'CORE';
    if (totalMinutes >= 570 && totalMinutes < 575) return 'SOFT_OPEN';
    if (totalMinutes >= 240 && totalMinutes < 570) return 'PRE_MARKET';
    if (totalMinutes >= 960 && totalMinutes < 1200) return 'AFTER_HOURS';
    return 'OVERNIGHT';
}

// ============================================================================
// MINI CHART COMPONENT (Canvas-based for performance)
// ============================================================================
function MiniChart({
    data,
    color,
    height = 120,
    showZeroLine = false,
    label,
    currentValue,
    formatValue,
}: {
    data: { time: number; value: number }[];
    color: string;
    height?: number;
    showZeroLine?: boolean;
    label: string;
    currentValue: number;
    formatValue: (v: number) => string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || data.length < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const chartHeight = rect.height;

        // Clear
        ctx.clearRect(0, 0, width, chartHeight);

        // Calculate bounds
        const values = data.map(d => d.value);
        let minVal = Math.min(...values);
        let maxVal = Math.max(...values);

        if (showZeroLine) {
            minVal = Math.min(minVal, 0);
            maxVal = Math.max(maxVal, 0);
        }

        const padding = (maxVal - minVal) * 0.1 || 10;
        minVal -= padding;
        maxVal += padding;
        const range = maxVal - minVal || 1;

        // Draw zero line if needed
        if (showZeroLine) {
            const zeroY = chartHeight - ((0 - minVal) / range) * chartHeight;
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, zeroY);
            ctx.lineTo(width, zeroY);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        data.forEach((point, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = chartHeight - ((point.value - minVal) / range) * chartHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
        gradient.addColorStop(0, `${color}40`);
        gradient.addColorStop(1, `${color}00`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        data.forEach((point, i) => {
            const x = (i / (data.length - 1)) * width;
            const y = chartHeight - ((point.value - minVal) / range) * chartHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.lineTo(width, chartHeight);
        ctx.lineTo(0, chartHeight);
        ctx.closePath();
        ctx.fill();

    }, [data, color, showZeroLine]);

    return (
        <div className="bg-[#0a0a0a] rounded-lg border border-white/5 p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
                <span className="text-lg font-mono" style={{ color }}>{formatValue(currentValue)}</span>
            </div>
            <canvas
                ref={canvasRef}
                className="w-full"
                style={{ height }}
            />
        </div>
    );
}

// ============================================================================
// EVENT TIMELINE COMPONENT (PRD 4.1 bottom section)
// ============================================================================
function EventTimeline({
    events,
    currentTime,
    startTime,
    endTime,
}: {
    events: SimEvent[];
    currentTime: Date;
    startTime: Date;
    endTime: Date;
}) {
    const totalDuration = endTime.getTime() - startTime.getTime();
    const currentProgress = Math.min(100, Math.max(0,
        ((currentTime.getTime() - startTime.getTime()) / totalDuration) * 100
    ));

    const timeMarkers = [
        { label: '4PM', time: 16 * 60 },
        { label: '5:30PM', time: 17.5 * 60 },
        { label: '6PM', time: 18 * 60 },
        { label: '8PM', time: 20 * 60 },
        { label: '12AM', time: 24 * 60 },
        { label: '4AM', time: 28 * 60 },
        { label: '6AM', time: 30 * 60 },
        { label: '9:30AM', time: 33.5 * 60 },
    ];

    return (
        <div className="bg-[#0a0a0a] rounded-lg border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Event Timeline</span>
                <span className="text-xs text-neutral-500">{events.length} events</span>
            </div>

            {/* Timeline bar */}
            <div className="relative h-8 mb-2">
                {/* Background track */}
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/10 rounded-full transform -translate-y-1/2" />

                {/* Progress */}
                <div
                    className="absolute top-1/2 left-0 h-1 bg-[#FF4D00] rounded-full transform -translate-y-1/2 transition-all duration-300"
                    style={{ width: `${currentProgress}%` }}
                />

                {/* Current position marker */}
                <div
                    className="absolute top-1/2 w-3 h-3 bg-[#FF4D00] rounded-full transform -translate-y-1/2 -translate-x-1/2 shadow-[0_0_10px_rgba(255,77,0,0.5)]"
                    style={{ left: `${currentProgress}%` }}
                />

                {/* Event dots */}
                {events.slice(-10).map((event, i) => {
                    const eventProgress = ((event.timestamp.getTime() - startTime.getTime()) / totalDuration) * 100;
                    if (eventProgress < 0 || eventProgress > 100) return null;
                    return (
                        <div
                            key={i}
                            className={`absolute top-1/2 w-2 h-2 rounded-full transform -translate-y-1/2 -translate-x-1/2 ${event.severity === 'DANGER' ? 'bg-red-500' :
                                    event.severity === 'WARNING' ? 'bg-yellow-500' : 'bg-white/50'
                                }`}
                            style={{ left: `${eventProgress}%` }}
                            title={event.description}
                        />
                    );
                })}
            </div>

            {/* Time labels */}
            <div className="flex justify-between text-[10px] text-neutral-500">
                <span>Start</span>
                <span>End</span>
            </div>

            {/* Recent events */}
            <div className="mt-4 space-y-1 max-h-24 overflow-y-auto">
                {events.slice(-5).reverse().map((event, i) => (
                    <div
                        key={i}
                        className={`flex items-center gap-2 text-xs py-1 px-2 rounded ${event.severity === 'DANGER' ? 'bg-red-500/10 text-red-400' :
                                event.severity === 'WARNING' ? 'bg-yellow-500/10 text-yellow-400' :
                                    'bg-white/5 text-neutral-400'
                            }`}
                    >
                        <span className="font-mono text-[10px] opacity-60">
                            {event.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>{event.description}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// METRICS PANEL COMPONENT (PRD 4.1)
// ============================================================================
function MetricsPanel({
    fee,
    regime,
    vpin,
    inventory,
    circuitBreaker,
    isProtected,
}: {
    fee: number;
    regime: Regime;
    vpin: number;
    inventory: number;
    circuitBreaker: 0 | 1 | 2 | 3 | 4;
    isProtected: boolean;
}) {
    return (
        <div className="bg-[#0a0a0a] rounded-lg border border-white/5 p-4">
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Metrics</div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <div className="text-[10px] text-neutral-600">Fee</div>
                    <div className={`font-mono text-sm ${isProtected ? 'text-[#FF4D00]' : 'text-white'}`}>
                        {fee.toFixed(0)} bps
                    </div>
                </div>
                <div>
                    <div className="text-[10px] text-neutral-600">Regime</div>
                    <div className="font-mono text-sm" style={{ color: REGIME_COLORS[regime] }}>
                        {regime.replace('_', ' ')}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] text-neutral-600">VPIN</div>
                    <div className={`font-mono text-sm ${vpin > 0.7 ? 'text-red-400' : vpin > 0.5 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                        {vpin.toFixed(2)}
                    </div>
                </div>
                <div>
                    <div className="text-[10px] text-neutral-600">Inventory</div>
                    <div className={`font-mono text-sm ${Math.abs(inventory) > 0.3 ? 'text-yellow-400' : 'text-white'
                        }`}>
                        {inventory >= 0 ? '+' : ''}{(inventory * 100).toFixed(0)}%
                    </div>
                </div>
                {isProtected && (
                    <div className="col-span-2">
                        <div className="text-[10px] text-neutral-600">Circuit Breaker</div>
                        <div className={`font-mono text-sm ${circuitBreaker >= 3 ? 'text-red-400' : circuitBreaker >= 1 ? 'text-yellow-400' : 'text-green-400'
                            }`}>
                            Level {circuitBreaker} — {CIRCUIT_BREAKER_EFFECTS[circuitBreaker].label}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// MAIN DEMO PAGE
// ============================================================================
export default function DemoPage() {
    const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState<1 | 5 | 10 | 60>(5);
    const [state, setState] = useState<SimulationState>(() => getInitialState(SCENARIOS[0]));

    function getInitialState(scenario: typeof SCENARIOS[0]): SimulationState {
        const initialPrices: Record<string, number> = {
            AAPL: 150, TSLA: 200, MSFT: 400, GME: 25, AMZN: 180, PFE: 40, BAC: 35, NVDA: 800,
        };
        const basePrice = initialPrices[scenario.stock] || 100;
        const startTime = new Date('2024-01-15T15:00:00');

        return {
            simulatedTime: startTime,
            elapsedSeconds: 0,
            oraclePrice: basePrice,
            poolPriceTraditional: basePrice,
            poolPriceShield: basePrice,
            currentRegime: getRegimeFromTime(startTime),
            dynamicFee: 5,
            volatility: 0.35,
            vpin: 0.25,
            inventoryImbalance: 0,
            circuitBreakerLevel: 0,
            lpPnLTraditional: 0,
            lpPnLShield: 0,
            feesCollectedTraditional: 0,
            feesCollectedShield: 0,
            events: [{
                timestamp: startTime,
                type: 'REGIME_CHANGE',
                description: `Simulation started — ${scenario.name}`,
                severity: 'INFO',
            }],
            isGapAuction: false,
            priceHistoryTraditional: [{ time: 0, oracle: basePrice, pool: basePrice }],
            priceHistoryShield: [{ time: 0, oracle: basePrice, pool: basePrice }],
            pnlHistoryTraditional: [{ time: 0, pnl: 0 }],
            pnlHistoryShield: [{ time: 0, pnl: 0 }],
        };
    }

    const tick = useCallback(() => {
        setState(prev => {
            const newTime = new Date(prev.simulatedTime.getTime() + 1000 * speed);
            const newElapsed = prev.elapsedSeconds + 1;
            const newRegime = getRegimeFromTime(newTime);
            const events = [...prev.events];

            if (newRegime !== prev.currentRegime) {
                events.push({
                    timestamp: newTime,
                    type: 'REGIME_CHANGE',
                    description: `Regime → ${newRegime.replace('_', ' ')}`,
                    severity: 'INFO',
                });
            }

            let oraclePrice = prev.oraclePrice;
            let lpPnLTraditional = prev.lpPnLTraditional;
            let lpPnLShield = prev.lpPnLShield;
            let feesShield = prev.feesCollectedShield;
            let vpin = prev.vpin;
            let inventoryImbalance = prev.inventoryImbalance;
            let isGapAuction = prev.isGapAuction;

            // Add small random noise
            oraclePrice += (Math.random() - 0.5) * 0.5;

            // Scenario-specific events
            if (selectedScenario.id === 1 && newElapsed >= 150 && newElapsed < 155 && prev.elapsedSeconds < 150) {
                oraclePrice = 165;
                events.push({ timestamp: newTime, type: 'NEWS', description: '📰 EARNINGS BEAT! Apple +10%', severity: 'WARNING' });
                isGapAuction = true;
                lpPnLTraditional -= 2270;
                lpPnLShield -= 680;
                feesShield += 920;
                events.push({ timestamp: newTime, type: 'TRADE', description: '💸 Traditional: -$2,270 to arbitrage', severity: 'DANGER' });
                events.push({ timestamp: newTime, type: 'GAP_AUCTION', description: '🛡️ StockShield: Gap auction +$920', severity: 'INFO' });
            }

            if (selectedScenario.id === 3) {
                if (newElapsed >= 60 && newElapsed < 65 && prev.elapsedSeconds < 60) {
                    oraclePrice = 350;
                    vpin = 0.85;
                    events.push({ timestamp: newTime, type: 'NEWS', description: '🔻 FLASH CRASH -12.5%', severity: 'DANGER' });
                    lpPnLTraditional -= 3120;
                    events.push({ timestamp: newTime, type: 'TRADE', description: '💸 Traditional: -$3,120', severity: 'DANGER' });
                } else if (newElapsed >= 105 && newElapsed < 110 && prev.elapsedSeconds < 105) {
                    oraclePrice = 400;
                    vpin = 0.4;
                    events.push({ timestamp: newTime, type: 'NEWS', description: '📈 Recovery — Fat finger confirmed', severity: 'INFO' });
                }
            }

            const dynamicFee = calculateDynamicFee(newRegime, prev.volatility, vpin, inventoryImbalance);
            const cbLevel = determineCircuitBreakerLevel(
                0,
                Math.abs(oraclePrice - prev.poolPriceShield) / Math.max(oraclePrice, 1),
                vpin,
                inventoryImbalance,
                newRegime === 'CORE'
            );

            const poolPriceTraditional = prev.poolPriceTraditional + (oraclePrice - prev.poolPriceTraditional) * 0.1;
            const poolPriceShield = cbLevel >= 4 ? prev.poolPriceShield : prev.poolPriceShield + (oraclePrice - prev.poolPriceShield) * 0.1;

            // Add small fee earnings over time
            const tradingFees = newRegime === 'CORE' ? 5 : 2;
            lpPnLTraditional += tradingFees * 0.3;
            lpPnLShield += tradingFees * (dynamicFee / 30);

            return {
                ...prev,
                simulatedTime: newTime,
                elapsedSeconds: newElapsed,
                oraclePrice,
                poolPriceTraditional,
                poolPriceShield,
                currentRegime: newRegime,
                dynamicFee,
                vpin: Math.max(0.1, Math.min(1, vpin + (Math.random() - 0.5) * 0.02)),
                inventoryImbalance: Math.max(-0.5, Math.min(0.5, inventoryImbalance + (Math.random() - 0.5) * 0.02)),
                circuitBreakerLevel: cbLevel,
                lpPnLTraditional,
                lpPnLShield,
                feesCollectedShield: feesShield,
                events: events.slice(-100),
                isGapAuction,
                priceHistoryTraditional: [...prev.priceHistoryTraditional.slice(-200), { time: newElapsed, oracle: oraclePrice, pool: poolPriceTraditional }],
                priceHistoryShield: [...prev.priceHistoryShield.slice(-200), { time: newElapsed, oracle: oraclePrice, pool: poolPriceShield }],
                pnlHistoryTraditional: [...prev.pnlHistoryTraditional.slice(-200), { time: newElapsed, pnl: lpPnLTraditional }],
                pnlHistoryShield: [...prev.pnlHistoryShield.slice(-200), { time: newElapsed, pnl: lpPnLShield }],
            };
        });
    }, [speed, selectedScenario]);

    useEffect(() => {
        if (isPlaying) {
            const interval = setInterval(tick, 100);
            return () => clearInterval(interval);
        }
    }, [isPlaying, tick]);

    const handleReset = () => {
        setIsPlaying(false);
        setState(getInitialState(selectedScenario));
    };

    const handleScenarioChange = (scenario: typeof SCENARIOS[0]) => {
        setSelectedScenario(scenario);
        setIsPlaying(false);
        setState(getInitialState(scenario));
    };

    const delta = state.lpPnLShield - state.lpPnLTraditional;
    const startTime = new Date('2024-01-15T15:00:00');
    const endTime = new Date('2024-01-16T10:00:00');

    return (
        <main className="min-h-screen bg-[#050505] text-white">
            {/* ================================================================== */}
            {/* HEADER: Scenario Selector | Speed Control | Play/Pause | Reset     */}
            {/* ================================================================== */}
            <header className="fixed top-0 w-full z-50 h-14 flex items-center border-b border-white/5 bg-[#050505]/95 backdrop-blur-sm">
                <div className="w-full max-w-[1800px] mx-auto px-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </Link>

                        {/* Scenario Selector */}
                        <select
                            value={selectedScenario.id}
                            onChange={(e) => handleScenarioChange(SCENARIOS.find(s => s.id === Number(e.target.value)) || SCENARIOS[0])}
                            className="bg-[#0a0a0a] border border-white/10 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#FF4D00]/50 max-w-[280px]"
                        >
                            {SCENARIOS.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.id}. {s.name} ({s.stock}) {'★'.repeat(s.difficulty)}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Speed Control */}
                        <div className="flex items-center gap-0.5 bg-[#0a0a0a] border border-white/10 rounded p-0.5">
                            {([1, 5, 10, 60] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setSpeed(s)}
                                    className={`px-2.5 py-1 text-xs rounded transition-colors ${speed === s ? 'bg-[#FF4D00] text-white' : 'text-neutral-400 hover:text-white'
                                        }`}
                                >
                                    {s}x
                                </button>
                            ))}
                        </div>

                        {/* Transport Controls */}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 text-neutral-400 hover:text-white"
                                onClick={handleReset}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button
                                size="icon"
                                className="w-8 h-8 bg-[#FF4D00] hover:bg-[#ff5e1a]"
                                onClick={() => setIsPlaying(!isPlaying)}
                            >
                                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="w-8 h-8 text-neutral-400 hover:text-white"
                            >
                                <SkipForward className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SCENARIO TITLE + DESCRIPTION                                       */}
            {/* ================================================================== */}
            <div className="pt-16 pb-3 px-4 border-b border-white/5 bg-[#080808]">
                <div className="max-w-[1800px] mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-medium">{selectedScenario.name}</h1>
                        <p className="text-sm text-neutral-500">{selectedScenario.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-lg font-mono">
                                {state.simulatedTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="text-xs text-neutral-500">
                                {state.simulatedTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                        <div
                            className="px-3 py-1.5 rounded border text-sm font-medium"
                            style={{
                                borderColor: REGIME_COLORS[state.currentRegime],
                                backgroundColor: `${REGIME_COLORS[state.currentRegime]}15`,
                                color: REGIME_COLORS[state.currentRegime]
                            }}
                        >
                            {state.currentRegime.replace('_', ' ')}
                        </div>
                    </div>
                </div>
            </div>

            {/* Delta Banner */}
            <div className={`px-4 py-2 text-center text-sm font-medium ${delta >= 0 ? 'bg-green-500/10 text-green-400 border-b border-green-500/20' :
                    'bg-red-500/10 text-red-400 border-b border-red-500/20'
                }`}>
                <Shield className="w-4 h-4 inline mr-2" />
                StockShield {delta >= 0 ? 'saved LPs' : 'difference'}: ${Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>

            {/* ================================================================== */}
            {/* MAIN SPLIT PANELS                                                  */}
            {/* ================================================================== */}
            <div className="p-4">
                <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ============================================================== */}
                    {/* TRADITIONAL AMM PANEL (Unprotected)                            */}
                    {/* ============================================================== */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm font-medium">Traditional AMM</span>
                            <span className="text-xs text-neutral-500 px-1.5 py-0.5 bg-white/5 rounded">Unprotected</span>
                        </div>

                        {/* Price Chart */}
                        <MiniChart
                            data={state.priceHistoryTraditional.map(p => ({ time: p.time, value: p.pool }))}
                            color="#ef4444"
                            label="Price Chart"
                            currentValue={state.poolPriceTraditional}
                            formatValue={(v) => `$${v.toFixed(2)}`}
                            height={140}
                        />

                        {/* LP PnL Tracker */}
                        <MiniChart
                            data={state.pnlHistoryTraditional.map(p => ({ time: p.time, value: p.pnl }))}
                            color={state.lpPnLTraditional >= 0 ? '#22c55e' : '#ef4444'}
                            label="LP P&L"
                            currentValue={state.lpPnLTraditional}
                            formatValue={(v) => `${v >= 0 ? '+' : ''}$${v.toFixed(0)}`}
                            height={100}
                            showZeroLine
                        />

                        {/* Metrics Panel */}
                        <MetricsPanel
                            fee={30}
                            regime={state.currentRegime}
                            vpin={state.vpin}
                            inventory={state.inventoryImbalance}
                            circuitBreaker={0}
                            isProtected={false}
                        />
                    </div>

                    {/* ============================================================== */}
                    {/* STOCKSHIELD PANEL (Protected)                                  */}
                    {/* ============================================================== */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-2 h-2 rounded-full bg-[#FF4D00]" />
                            <span className="text-sm font-medium">StockShield AMM</span>
                            <span className="text-xs text-[#FF4D00] px-1.5 py-0.5 bg-[#FF4D00]/10 rounded">Protected</span>
                        </div>

                        {/* Price Chart */}
                        <MiniChart
                            data={state.priceHistoryShield.map(p => ({ time: p.time, value: p.pool }))}
                            color="#FF4D00"
                            label="Price Chart"
                            currentValue={state.poolPriceShield}
                            formatValue={(v) => `$${v.toFixed(2)}`}
                            height={140}
                        />

                        {/* LP PnL Tracker */}
                        <MiniChart
                            data={state.pnlHistoryShield.map(p => ({ time: p.time, value: p.pnl }))}
                            color={state.lpPnLShield >= 0 ? '#22c55e' : '#ef4444'}
                            label="LP P&L"
                            currentValue={state.lpPnLShield}
                            formatValue={(v) => `${v >= 0 ? '+' : ''}$${v.toFixed(0)}`}
                            height={100}
                            showZeroLine
                        />

                        {/* Metrics Panel */}
                        <MetricsPanel
                            fee={state.dynamicFee}
                            regime={state.currentRegime}
                            vpin={state.vpin}
                            inventory={state.inventoryImbalance}
                            circuitBreaker={state.circuitBreakerLevel}
                            isProtected={true}
                        />
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* EVENT TIMELINE (Bottom)                                            */}
            {/* ================================================================== */}
            <div className="px-4 pb-4">
                <div className="max-w-[1800px] mx-auto">
                    <EventTimeline
                        events={state.events}
                        currentTime={state.simulatedTime}
                        startTime={startTime}
                        endTime={endTime}
                    />
                </div>
            </div>
        </main>
    );
}

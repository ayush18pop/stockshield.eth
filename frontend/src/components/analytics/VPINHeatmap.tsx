import { Zap, Info } from 'lucide-react';

interface VPINHeatmapProps {
    currentScore: number;
}

export function VPINHeatmap({ currentScore }: VPINHeatmapProps) {
    // Mock historical data for the heatmap visual
    const mockHistory = Array.from({ length: 48 }, (_, i) => ({
        id: i,
        score: Math.floor(Math.random() * 40) + (i > 40 ? currentScore / 2 : 0)
    }));

    const getHeatColor = (score: number) => {
        if (score < 20) return 'bg-emerald-500/15 border-emerald-500/20';
        if (score < 40) return 'bg-emerald-400/25 border-emerald-400/30';
        if (score < 60) return 'bg-yellow-500/25 border-yellow-500/30';
        if (score < 80) return 'bg-orange-500/35 border-orange-500/40';
        return 'bg-red-500/45 border-red-500/50';
    };

    const getScoreLabel = (score: number) => {
        if (score < 20) return { text: 'LOW', color: 'text-green-400' };
        if (score < 40) return { text: 'NORMAL', color: 'text-green-300' };
        if (score < 60) return { text: 'ELEVATED', color: 'text-amber-400' };
        if (score < 80) return { text: 'HIGH', color: 'text-orange-400' };
        return { text: 'CRITICAL', color: 'text-red-400' };
    };

    const label = getScoreLabel(currentScore);

    return (
        <div className="rounded-xl bg-[#0a0a0a] border border-white/5 p-6 h-full flex flex-col hover:border-white/10 transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0f0f0f] border border-white/5 flex items-center justify-center">
                        <Zap className="w-5 h-5 text-[#FF4D00]" />
                    </div>
                    <div>
                        <h3 className="text-base font-medium text-white">VPIN Toxicity</h3>
                        <p className="text-xs text-neutral-500">Order flow analysis</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-mono font-medium text-white">
                        {currentScore.toFixed(2)}
                    </div>
                    <div className={`text-[10px] font-mono uppercase tracking-widest ${label.color}`}>{label.text}</div>
                </div>
            </div>

            <p className="text-[11px] text-neutral-600 mb-5 leading-relaxed">
                Real-time measurement of toxic flow order imbalance.
            </p>

            {/* Heatmap Grid */}
            <div className="grid grid-cols-12 gap-1 flex-1 content-start">
                {mockHistory.map((cell) => (
                    <div
                        key={cell.id}
                        className={`aspect-square rounded-sm border ${getHeatColor(cell.score)} transition-colors duration-500`}
                        title={`Score: ${cell.score}`}
                    />
                ))}
                {/* Live Cell Pulse */}
                <div className={`aspect-square rounded-sm border ${getHeatColor(currentScore)} transition-colors duration-200 animate-pulse relative`}>
                    <div className="absolute inset-0 bg-white/20 animate-ping rounded-sm" />
                </div>
            </div>

            <div className="mt-5 flex items-center gap-2 px-3 py-2.5 bg-[#FF4D00]/5 border border-[#FF4D00]/10 rounded-lg">
                <Info className="w-4 h-4 text-[#FF4D00] shrink-0" />
                <p className="text-[11px] text-neutral-400">
                    Dynamic fees scale when VPIN exceeds 60 — protecting LPs from toxic flow.
                </p>
            </div>
        </div>
    );
}

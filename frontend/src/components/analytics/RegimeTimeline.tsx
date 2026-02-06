import { Shield, Clock, Sun, Moon, Zap, AlertTriangle } from 'lucide-react';

interface RegimeTimelineProps {
    currentRegime: string;
}

const HISTORY_MOCK = [
    { time: '04:00', regime: 'Pre-Market', status: 'active' },
    { time: '08:00', regime: 'Pre-Market', status: 'active' },
    { time: '09:30', regime: 'Soft Open', status: 'warning' },
    { time: '10:00', regime: 'Core Session', status: 'safe' },
    { time: '14:00', regime: 'Core Session', status: 'safe' },
    { time: '16:00', regime: 'After Hours', status: 'active' },
    { time: '20:00', regime: 'Overnight', status: 'danger' },
];

export function RegimeTimeline({ currentRegime }: RegimeTimelineProps) {
    const getIcon = (regime: string) => {
        if (regime.includes('Core')) return <Shield className="w-4 h-4 text-green-400" />;
        if (regime.includes('Soft') || regime.includes('Pre')) return <Zap className="w-4 h-4 text-amber-400" />;
        if (regime.includes('Overnight') || regime.includes('Weekend')) return <Moon className="w-4 h-4 text-indigo-400" />;
        return <Clock className="w-4 h-4 text-neutral-400" />;
    };

    const getColor = (regime: string) => {
        if (regime.includes('Core')) return 'bg-green-500';
        if (regime.includes('Soft') || regime.includes('Pre')) return 'bg-amber-500';
        if (regime.includes('Overnight') || regime.includes('Weekend')) return 'bg-indigo-500';
        return 'bg-neutral-500';
    };

    return (
        <div className="rounded-xl bg-[#0a0a0a] border border-white/5 p-6 h-full hover:border-white/10 transition-all">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-lg bg-[#0f0f0f] border border-white/5 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-[#FF4D00]" />
                </div>
                <div>
                    <h3 className="text-base font-medium text-white">Regime Timeline</h3>
                    <p className="text-xs text-neutral-500">NYSE 24h cycle</p>
                </div>
            </div>

            <div className="relative pl-4 border-l border-white/[0.08] space-y-6">
                {HISTORY_MOCK.map((point, i) => (
                    <div key={i} className="relative group">
                        <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full ${getColor(point.regime)} ring-4 ring-[#0a0a0a] group-hover:ring-[#111]`} />
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-[10px] text-neutral-600 font-mono mb-1 block uppercase tracking-wider">{point.time} ET</span>
                                <span className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">{point.regime}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Current realtime point */}
                <div className="relative">
                    <div className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full ${getColor(currentRegime)} ring-4 ring-[#0a0a0a] animate-pulse`} />
                    <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.08] mt-2">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] text-[#FF4D00] font-medium uppercase tracking-widest">Current Live State</span>
                            <div className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${getColor(currentRegime)} opacity-75`}></span>
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${getColor(currentRegime)}`}></span>
                                </span>
                                <span className="text-[10px] text-neutral-500 font-mono">LIVE</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-lg font-medium text-white">
                            {getIcon(currentRegime)}
                            {currentRegime}
                        </div>
                        <p className="text-[11px] text-neutral-600 mt-2 leading-relaxed">
                            Fee parameters enforced for this regime.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

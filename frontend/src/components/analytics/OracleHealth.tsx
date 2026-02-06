import { Activity, Wifi, CheckCircle, AlertTriangle, RefreshCcw } from 'lucide-react';

interface OracleHealthProps {
    lastUpdateTimestamp: number;
    lastPrice: number;
    currentPrice: number;
    stalenessThreshold?: number; // seconds
}

export function OracleHealth({
    lastUpdateTimestamp,
    lastPrice,
    currentPrice,
    stalenessThreshold = 60
}: OracleHealthProps) {
    const now = Math.floor(Date.now() / 1000);
    const lastUpdate = lastUpdateTimestamp || now; // fallback if 0
    const timeSinceUpdate = Math.max(0, now - lastUpdate);
    const isStale = timeSinceUpdate > stalenessThreshold;

    // Calculate Deviation
    // Avoid division by zero
    const safeLastPrice = lastPrice || currentPrice || 1;
    const deviation = Math.abs((currentPrice - safeLastPrice) / safeLastPrice) * 100;

    // Status Logic
    const isHealthy = !isStale && deviation < 1.0; // < 1% deviation considered healthy for demo

    return (
        <div className="rounded-xl bg-[#0a0a0a] border border-white/5 p-6 h-full flex flex-col hover:border-white/10 transition-all">
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0f0f0f] border border-white/5 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-[#FF4D00]" />
                    </div>
                    <div>
                        <h3 className="text-base font-medium text-white">Oracle Health</h3>
                        <p className="text-xs text-neutral-500">Dual-source feeds</p>
                    </div>
                </div>
                <div className={`px-3 py-1.5 rounded-sm text-[10px] font-medium uppercase tracking-widest border ${isHealthy ? 'bg-green-500/5 text-green-400 border-green-500/20' : 'bg-red-500/5 text-red-400 border-red-500/20'}`}>
                    {isHealthy ? 'ONLINE' : 'DEGRADED'}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-neutral-500 text-[10px] uppercase tracking-widest mb-1.5">
                        <Wifi className="w-3 h-3" /> Latency
                    </div>
                    <div className="text-xl font-mono font-medium text-white">
                        {timeSinceUpdate}s
                    </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-4 rounded-lg">
                    <div className="flex items-center gap-2 text-neutral-500 text-[10px] uppercase tracking-widest mb-1.5">
                        <RefreshCcw className="w-3 h-3" /> Deviation
                    </div>
                    <div className="text-xl font-mono font-medium text-white">
                        {deviation.toFixed(3)}%
                    </div>
                </div>
            </div>

            <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500 text-xs">Chainlink Feed</span>
                    <span className="text-green-400 flex items-center gap-1 text-[10px] font-mono">
                        <CheckCircle className="w-3 h-3" /> Connected
                    </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500 text-xs">Pyth Network</span>
                    <span className="text-green-400 flex items-center gap-1 text-[10px] font-mono">
                        <CheckCircle className="w-3 h-3" /> Connected
                    </span>
                </div>

                {/* Deviation Bar */}
                <div className="mt-4 pt-3 border-t border-white/5">
                    <div className="flex justify-between text-[10px] text-neutral-600 mb-1.5 uppercase tracking-widest">
                        <span>Safe Zone</span>
                        <span className="font-mono">{deviation.toFixed(2)} / 1.00%</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 rounded-full ${deviation > 1 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(deviation * 50, 100)}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

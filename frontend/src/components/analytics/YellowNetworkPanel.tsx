import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { Button } from '@/components/ui/button';
import { api, YellowStatusResponse, TradeResponse } from '@/lib/api';
import { CONTRACTS, MARGIN_VAULT_ABI, getEtherscanLink } from '@/lib/contracts';
import { CheckCircle, Loader2, Server, Shield, Wallet, XCircle, Zap, ArrowUpRight } from 'lucide-react';

function isBytes32(value: string): value is `0x${string}` {
    return /^0x[a-fA-F0-9]{64}$/.test(value);
}

interface TxLogEntry {
    action: string;
    amount: number;
    timestamp: number;
    vpin: number;
    signature?: string;
    turnNumber?: number;
}

interface ExtendedYellowStatus extends YellowStatusResponse {
    session: YellowStatusResponse['session'] & {
        txLog?: TxLogEntry[];
    } | null;
}

export function YellowNetworkPanel() {
    const { address, isConnected } = useAccount();
    const [status, setStatus] = useState<ExtendedYellowStatus | null>(null);
    const [allowance, setAllowance] = useState('25');
    const [tradeVolume, setTradeVolume] = useState('1000');
    const [tradeAsset, setTradeAsset] = useState('ETH');
    const [tradeDirection, setTradeDirection] = useState<'BUY' | 'SELL'>('BUY');
    const [lastTradeResult, setLastTradeResult] = useState<TradeResponse | null>(null);
    const [onChainChannelId, setOnChainChannelId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const { writeContract, data: settleHash, isPending: isSettlingOnChain } = useWriteContract();
    const { isLoading: isSettleConfirming, isSuccess: isSettleConfirmed } = useWaitForTransactionReceipt({
        hash: settleHash,
    });

    const refreshStatus = useCallback(async () => {
        try {
            const next = await api.getYellowStatus();
            setStatus(next as ExtendedYellowStatus);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch Yellow status');
        }
    }, []);

    useEffect(() => {
        void refreshStatus();
        const timer = setInterval(() => {
            void refreshStatus();
        }, 5000);
        return () => clearInterval(timer);
    }, [refreshStatus]);

    const runtime = status?.runtime;
    const session = status?.session;
    const txLog = (session as unknown as { txLog?: TxLogEntry[] })?.txLog ?? [];

    const runtimeBadge = useMemo(() => {
        if (!runtime) return { label: 'Unknown', tone: 'text-neutral-400 border-neutral-700 bg-neutral-900/40' };
        if (runtime.connected && runtime.authenticated) return { label: 'Connected', tone: 'text-green-400 border-green-500/30 bg-green-500/10' };
        if (runtime.connected) return { label: 'Auth Pending', tone: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
        return { label: 'Disconnected', tone: 'text-red-400 border-red-500/30 bg-red-500/10' };
    }, [runtime]);

    const startSession = async () => {
        setError(null);
        setIsLoading(true);
        try {
            const started = await api.startYellowSession({
                wallet: address || 'anonymous',
                allowance: Number(allowance),
            });
            setStatus(started as ExtendedYellowStatus);
            if (started.runtime.channelId && isBytes32(started.runtime.channelId)) {
                setOnChainChannelId(started.runtime.channelId);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to start session');
        } finally {
            setIsLoading(false);
        }
    };

    const submitTradeSignal = async () => {
        setError(null);
        setIsLoading(true);
        try {
            // Trigger trade-state update that signs and relays via Yellow
            const result = await api.submitTrade({
                asset: tradeAsset,
                volume: Number(tradeVolume),
                isBuy: tradeDirection === 'BUY',
            });
            setLastTradeResult(result);

            // Also update the session spend if we have an active session
            if (session?.status === 'ACTIVE') {
                await api.spendYellowSession({
                    amount: Number(tradeVolume) * 0.001,
                    action: `${tradeDirection} ${tradeAsset}`,
                });
            }

            // Refresh status to get updated tx log
            await refreshStatus();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to submit trade signal');
        } finally {
            setIsLoading(false);
        }
    };

    const settleSession = async () => {
        setError(null);
        setIsSyncing(true);
        try {
            const settle = await api.settleYellowSession({
                onChainChannelId: onChainChannelId || undefined,
            });
            await refreshStatus();

            if (!settle.onchain.ready) {
                throw new Error(settle.onchain.reason);
            }

            const channelArg = settle.onchain.args[0];
            if (!isBytes32(channelArg)) {
                throw new Error('Invalid settlement channelId. Enter a valid bytes32.');
            }

            writeContract({
                address: CONTRACTS.MARGIN_VAULT,
                abi: MARGIN_VAULT_ABI,
                functionName: 'closeChannel',
                args: [channelArg],
                chainId: 11155111,
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to settle session');
        } finally {
            setIsSyncing(false);
        }
    };

    const spentPercent = session ? Math.min((session.spent / session.allowance) * 100, 100) : 0;

    return (
        <div className="rounded-xl bg-[#0a0a0a] border border-white/5 overflow-hidden">
            {/* Header Band */}
            <div className="px-6 py-4 border-b border-white/5 bg-gradient-to-r from-yellow-500/5 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                        <span className="text-xl">🟡</span>
                    </div>
                    <div>
                        <h3 className="text-base font-medium text-white">Yellow Network Session</h3>
                        <p className="text-xs text-neutral-500">ERC-7824 State Channel · Off-chain Spend · On-chain Settle</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1.5 text-xs font-medium rounded-sm border ${runtimeBadge.tone}`}>
                        {runtimeBadge.label}
                    </div>
                    {session?.status === 'ACTIVE' && (
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            <span className="text-xs text-green-400 font-mono">LIVE</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Channel & Session Info */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Channel</div>
                        <div className="font-mono text-[11px] text-neutral-300 break-all leading-relaxed">
                            {runtime?.channelId ? `${runtime.channelId.slice(0, 10)}...${runtime.channelId.slice(-6)}` : 'N/A'}
                        </div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Session</div>
                        <div className={`font-mono text-sm font-medium ${session?.status === 'ACTIVE' ? 'text-green-400' : session?.status === 'SETTLED' ? 'text-amber-400' : 'text-neutral-500'}`}>
                            {session?.status || 'NONE'}
                        </div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Tx Count</div>
                        <div className="font-mono text-sm font-medium text-white">
                            {session?.txCount ?? 0}
                        </div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Gas Used</div>
                        <div className="font-mono text-sm font-medium text-[#FF4D00]">0 wei</div>
                        <div className="text-[10px] text-neutral-600">All off-chain</div>
                    </div>
                </div>

                {/* Balance Bar */}
                {session && (
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] uppercase tracking-widest text-neutral-500">Session Allowance</span>
                            <span className="text-xs font-mono text-neutral-400">
                                {session.spent.toFixed(2)} / {session.allowance.toFixed(2)} USDC
                            </span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-yellow-500 to-[#FF4D00] transition-all duration-500 rounded-full"
                                style={{ width: `${spentPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-1">
                            <span className="text-[10px] text-neutral-600">Spent: ${session.spent.toFixed(2)}</span>
                            <span className="text-[10px] text-neutral-600">Remaining: ${session.remaining.toFixed(2)}</span>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Start Session */}
                    <div className="flex gap-2">
                        <input
                            value={allowance}
                            onChange={(e) => setAllowance(e.target.value)}
                            className="flex-1 bg-white/[0.03] border border-white/10 rounded-sm px-3 py-2.5 text-sm font-mono text-white placeholder-neutral-600 focus:border-yellow-500/30 focus:outline-none transition-colors"
                            placeholder="Allowance (USDC)"
                        />
                        <Button
                            onClick={startSession}
                            disabled={isLoading || !isConnected}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-medium text-xs uppercase tracking-wider rounded-sm px-5"
                        >
                            {isLoading ? 'Starting...' : 'Start Session'}
                        </Button>
                    </div>

                    {/* Trade State Signal */}
                    <div className="flex gap-2 flex-wrap">
                        {/* Asset Selector */}
                        <select
                            value={tradeAsset}
                            onChange={(e) => setTradeAsset(e.target.value)}
                            className="bg-white/[0.03] border border-white/10 rounded-sm px-3 py-2.5 text-sm font-mono text-white focus:border-yellow-500/30 focus:outline-none"
                        >
                            <option value="ETH">ETH</option>
                            <option value="AAPL">AAPL</option>
                            <option value="TSLA">TSLA</option>
                        </select>

                        {/* Buy/Sell Toggle */}
                        <div className="flex rounded-sm overflow-hidden border border-white/10">
                            <button
                                onClick={() => setTradeDirection('BUY')}
                                className={`px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${tradeDirection === 'BUY'
                                        ? 'bg-green-500/20 text-green-400 border-r border-green-500/30'
                                        : 'bg-white/[0.02] text-neutral-500 border-r border-white/10'
                                    }`}
                            >
                                Buy
                            </button>
                            <button
                                onClick={() => setTradeDirection('SELL')}
                                className={`px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors ${tradeDirection === 'SELL'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-white/[0.02] text-neutral-500'
                                    }`}
                            >
                                Sell
                            </button>
                        </div>

                        {/* Volume Input */}
                        <input
                            value={tradeVolume}
                            onChange={(e) => setTradeVolume(e.target.value)}
                            className="flex-1 min-w-[100px] bg-white/[0.03] border border-white/10 rounded-sm px-3 py-2.5 text-sm font-mono text-white placeholder-neutral-600 focus:border-yellow-500/30 focus:outline-none transition-colors"
                            placeholder="Volume ($)"
                        />

                        {/* Submit Signal Button */}
                        <Button
                            onClick={submitTradeSignal}
                            disabled={isLoading}
                            className="bg-white/5 hover:bg-white/10 text-white border border-white/10 font-medium text-xs uppercase tracking-wider rounded-sm px-5"
                        >
                            <Zap className="w-3 h-3 mr-1.5" />
                            {isLoading ? 'Submitting...' : 'Submit Trade Signal'}
                        </Button>
                    </div>

                    {/* Trade Result */}
                    {lastTradeResult && (
                        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 mt-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-neutral-400">
                                    {lastTradeResult.trade.direction} ${lastTradeResult.trade.volume.toLocaleString()} {lastTradeResult.trade.asset}
                                </span>
                                <span className={`font-mono ${lastTradeResult.riskMetrics.vpinDelta > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                    VPIN: {lastTradeResult.riskMetrics.vpinAfter.toFixed(3)}
                                    ({lastTradeResult.riskMetrics.vpinDelta > 0 ? '+' : ''}{(lastTradeResult.riskMetrics.vpinDelta * 100).toFixed(1)}%)
                                </span>
                                <span className="font-mono text-amber-400">
                                    Fee: {lastTradeResult.riskMetrics.recommendedFee} bps
                                </span>
                                {lastTradeResult.yellow.broadcasted && (
                                    <span className="text-green-400 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Broadcast
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Transaction Log */}
                {txLog.length > 0 && (
                    <div>
                        <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Off-chain Transaction Log</div>
                        <div className="rounded-lg border border-white/5 bg-black/30 overflow-hidden max-h-40 overflow-y-auto">
                            <table className="w-full text-xs font-mono">
                                <thead>
                                    <tr className="text-neutral-600 border-b border-white/5">
                                        <th className="text-left px-3 py-1.5 font-normal">#</th>
                                        <th className="text-left px-3 py-1.5 font-normal">Action</th>
                                        <th className="text-right px-3 py-1.5 font-normal">Amount</th>
                                        <th className="text-right px-3 py-1.5 font-normal">VPIN</th>
                                        <th className="text-right px-3 py-1.5 font-normal">Signature</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {txLog.map((tx, i) => (
                                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors animate-fadeIn">
                                            <td className="px-3 py-1.5 text-neutral-600">{tx.turnNumber ?? i + 1}</td>
                                            <td className="px-3 py-1.5 text-neutral-300">{tx.action}</td>
                                            <td className="px-3 py-1.5 text-right text-white">${tx.amount.toFixed(2)}</td>
                                            <td className="px-3 py-1.5 text-right">
                                                <span className={tx.vpin > 0.6 ? 'text-red-400' : tx.vpin > 0.3 ? 'text-amber-400' : 'text-green-400'}>
                                                    {tx.vpin.toFixed(3)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-1.5 text-right">
                                                {tx.signature ? (
                                                    <span className="text-green-400" title={tx.signature}>
                                                        {tx.signature.slice(0, 8)}...✓
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-600">--</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Settlement Section */}
                <div className="border-t border-white/5 pt-5">
                    <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3 flex items-center gap-2">
                        <ArrowUpRight className="w-3 h-3" />
                        On-chain Settlement
                    </div>

                    <input
                        value={onChainChannelId}
                        onChange={(e) => setOnChainChannelId(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/10 rounded-sm px-3 py-2.5 text-xs font-mono text-white placeholder-neutral-600 focus:border-[#FF4D00]/30 focus:outline-none transition-colors mb-3"
                        placeholder="On-chain channelId (bytes32) for MarginVault.closeChannel"
                    />

                    <Button
                        onClick={settleSession}
                        disabled={
                            isSyncing ||
                            isSettlingOnChain ||
                            isSettleConfirming ||
                            !session ||
                            session.status !== 'ACTIVE' ||
                            !isConnected
                        }
                        className="w-full bg-[#FF4D00] hover:bg-[#ff5e1a] text-white font-medium text-xs uppercase tracking-wider rounded-sm py-3 shadow-[0_0_30px_rgba(255,77,0,0.15)]"
                    >
                        {isSyncing || isSettlingOnChain || isSettleConfirming ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Settling on-chain...
                            </>
                        ) : (
                            'Settle Session On-chain →'
                        )}
                    </Button>
                </div>

                {/* Status Messages */}
                <div className="space-y-2">
                    {!isConnected && (
                        <div className="text-xs text-amber-300 border border-amber-500/20 bg-amber-500/5 rounded-sm px-4 py-2.5 flex items-center gap-2">
                            <Wallet className="w-3.5 h-3.5" />
                            Connect wallet to execute on-chain settlement.
                        </div>
                    )}

                    {isSettleConfirmed && settleHash && (
                        <a
                            href={getEtherscanLink('tx', settleHash)}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs text-green-400 border border-green-500/20 bg-green-500/5 rounded-sm px-4 py-2.5 hover:bg-green-500/10 transition-colors"
                        >
                            <CheckCircle className="w-3.5 h-3.5 inline mr-2" />
                            Settlement tx confirmed — view on Etherscan →
                        </a>
                    )}

                    {error && (
                        <div className="text-xs text-red-400 border border-red-500/20 bg-red-500/5 rounded-sm px-4 py-2.5 flex items-center gap-2">
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, keccak256, encodePacked, toHex, stringToHex, pad } from 'viem';
import { CONTRACTS, GAP_AUCTION_ABI } from '@/lib/contracts';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

interface GapAuctionWidgetProps {
    activeAuctionId: string | null;
    refetch: () => void;
}

export function GapAuctionWidget({ activeAuctionId, refetch }: GapAuctionWidgetProps) {
    const { address } = useAccount();
    const [bidAmount, setBidAmount] = useState('');
    const [salt, setSalt] = useState<`0x${string}` | null>(null);
    const [phase, setPhase] = useState<'commit' | 'reveal'>('commit');

    // Transaction Hooks
    const { writeContract: commit, data: commitHash, isPending: isCommitting, error: commitError } = useWriteContract();
    const { isLoading: isCommitConfirming, isSuccess: isCommitConfirmed } = useWaitForTransactionReceipt({
        hash: commitHash,
    });

    const { writeContract: reveal, data: revealHash, isPending: isRevealing, error: revealError } = useWriteContract();
    const { isLoading: isRevealConfirming, isSuccess: isRevealConfirmed } = useWaitForTransactionReceipt({
        hash: revealHash,
    });

    // Handle stage transitions
    useEffect(() => {
        if (isCommitConfirmed) {
            setPhase('reveal');
            refetch();
        }
        if (isRevealConfirmed) {
            // Auction complete flow
            refetch();
        }
    }, [isCommitConfirmed, isRevealConfirmed, refetch]);

    const handleCommit = () => {
        if (!bidAmount || !address || !activeAuctionId) return;

        // Generate random salt
        const randomSalt = pad(toHex(Math.floor(Math.random() * 1000000000)), { size: 32 });
        setSalt(randomSalt);

        const amount = parseUnits(bidAmount, 6); // Assuming USDC (6 decimals) bidding

        // Calculate commitment hash: hash(bidAmount, salt, bidder)
        const commitment = keccak256(encodePacked(
            ['uint256', 'bytes32', 'address'],
            [amount, randomSalt, address]
        ));

        commit({
            address: CONTRACTS.GAP_AUCTION,
            abi: GAP_AUCTION_ABI,
            functionName: 'commit',
            args: [activeAuctionId as `0x${string}`, commitment],
            chainId: 11155111,
        });
    };

    const handleReveal = () => {
        if (!bidAmount || !salt || !activeAuctionId) return;

        const amount = parseUnits(bidAmount, 6);

        reveal({
            address: CONTRACTS.GAP_AUCTION,
            abi: GAP_AUCTION_ABI,
            functionName: 'reveal',
            args: [activeAuctionId as `0x${string}`, amount, salt],
            chainId: 11155111,
        });
    };

    const getEtherscanLink = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`;

    if (isRevealConfirmed) {
        return (
            <div className="bg-green-500/10 rounded-xl border border-green-500/30 p-6 flex flex-col items-center justify-center text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
                <h2 className="text-xl font-bold text-green-500 mb-2">Bid Revealed Successfully!</h2>
                <p className="text-neutral-400 max-w-xs mb-4">
                    Your bid for {bidAmount} USDC has been counted.
                    If you win, the gap value will be credited to your account.
                </p>
                {revealHash && (
                    <a href={getEtherscanLink(revealHash)} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline flex items-center gap-1 text-sm">
                        View Reveal Tx <ExternalLink className="w-3 h-3" />
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className="bg-amber-500/10 rounded-xl border border-amber-500/30 p-6 relative overflow-hidden transition-all duration-300">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <Clock className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-bold text-amber-500">Gap Auction Active</h2>
                <span className="ml-auto text-xs font-mono text-amber-500/70 border border-amber-500/30 px-2 py-1 rounded">
                    ID: {activeAuctionId ? activeAuctionId.slice(0, 8) + '...' : 'Loading...'}
                </span>
            </div>

            <p className="text-sm text-amber-200 mb-6">
                Price gap detected at market open. Standard swaps are paused.
                Participate in the auction to capture the arbitrage value.
            </p>

            {/* Steps Visualizer */}
            <div className="flex items-center gap-2 mb-6">
                <div className={`flex-1 h-1 rounded-full ${phase === 'commit' ? 'bg-amber-500' : 'bg-green-500'}`} />
                <div className={`flex-1 h-1 rounded-full ${phase === 'reveal' ? 'bg-amber-500' : 'bg-white/10'}`} />
            </div>

            {phase === 'commit' ? (
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-amber-200 block mb-1">Bid Amount (USDC)</label>
                        <input
                            type="number"
                            value={bidAmount}
                            onChange={(e) => setBidAmount(e.target.value)}
                            disabled={isCommitting}
                            placeholder="Enter bid..."
                            className="w-full bg-black/40 border border-amber-500/30 rounded-lg px-4 py-3 text-white outline-none focus:border-amber-500"
                        />
                    </div>

                    <Button
                        onClick={handleCommit}
                        disabled={!bidAmount || isCommitting || isCommitConfirming}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12"
                    >
                        {isCommitting ? 'Committing...' : isCommitConfirming ? 'Confirming...' : 'Step 1: Commit Bid'}
                    </Button>

                    {commitError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 break-all font-mono">
                            {commitError.message.split('\n')[0]}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-black/40 p-4 rounded-lg border border-amber-500/20">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-amber-200">Your Hidden Bid</span>
                            <span className="font-mono text-white">{bidAmount} USDC</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-amber-200/60">Salt</span>
                            <span className="font-mono text-white/60">{salt?.slice(0, 10)}...</span>
                        </div>
                    </div>

                    <Button
                        onClick={handleReveal}
                        disabled={isRevealing || isRevealConfirming}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-12"
                    >
                        {isRevealing ? 'Revealing...' : isRevealConfirming ? 'Confirming...' : 'Step 2: Reveal Bid'}
                    </Button>

                    {commitHash && (
                        <a href={getEtherscanLink(commitHash)} target="_blank" rel="noopener noreferrer" className="flex justify-center text-amber-500/50 hover:text-amber-500 text-xs gap-1 mt-2">
                            Commit Tx Confirmed <CheckCircle className="w-3 h-3" />
                        </a>
                    )}

                    {revealError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 break-all font-mono">
                            {revealError.message.split('\n')[0]}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

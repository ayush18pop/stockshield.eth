// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title GapAuction
 * @notice Commit-reveal auction for gap capture at market open
 */
contract GapAuction {
    using SafeERC20 for IERC20;

    // ============ Enums ============

    enum AuctionPhase {
        INACTIVE,
        COMMIT,
        REVEAL,
        SETTLED
    }

    // ============ Structs ============

    struct Auction {
        bytes32 auctionId;
        address pool;
        uint256 gapSize;
        uint256 poolLiquidity;
        uint256 startTime;
        uint256 commitDeadline;
        uint256 revealDeadline;
        uint256 minBid;
        address winner;
        uint256 winningBid;
        AuctionPhase phase;
    }

    struct Bid {
        bytes32 commitment; // hash(bidAmount, salt, bidder)
        uint256 bidAmount;
        bytes32 salt;
        bool revealed;
        bool valid;
    }

    // ============ Constants ============

    uint256 private constant COMMIT_PERIOD = 2 minutes;
    uint256 private constant REVEAL_PERIOD = 1 minutes;
    uint256 private constant CAPTURE_RATE = 70; // 70% for LPs
    uint256 private constant DECAY_RATE = 40; // 0.4 per minute
    uint256 private constant PRECISION = 100;
    uint256 private constant MIN_GAP_THRESHOLD = 50; // 0.5% in bps

    // ============ State Variables ============

    mapping(bytes32 => Auction) public auctions;
    mapping(bytes32 => mapping(address => Bid)) public bids;
    mapping(address => bool) public authorizedPools;

    address public hook;
    address public governance;
    IERC20 public paymentToken;

    uint256 public auctionCount;

    // ============ Events ============

    event AuctionStarted(
        bytes32 indexed auctionId,
        address indexed pool,
        uint256 gapSize,
        uint256 minBid
    );
    event BidCommitted(bytes32 indexed auctionId, address indexed bidder);
    event BidRevealed(
        bytes32 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );
    event AuctionSettled(
        bytes32 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );

    // ============ Errors ============

    error UnauthorizedPool();
    error AuctionNotActive();
    error InvalidPhase();
    error BidTooLow();
    error AlreadyCommitted();
    error NotRevealed();
    error InvalidReveal();
    error AuctionExpired();

    // ============ Modifiers ============

    modifier onlyAuthorizedPool() {
        if (!authorizedPools[msg.sender] && msg.sender != hook) {
            revert UnauthorizedPool();
        }
        _;
    }

    modifier validPhase(bytes32 auctionId, AuctionPhase required) {
        if (auctions[auctionId].phase != required) revert InvalidPhase();
        _;
    }

    // ============ Constructor ============

    constructor(address _hook, address _governance, address _paymentToken) {
        hook = _hook;
        governance = _governance;
        paymentToken = IERC20(_paymentToken);
    }

    // ============ External Functions ============

    /**
     * @notice Start a gap auction
     * @param pool The pool address
     * @param gapSize The gap size in basis points
     * @param poolLiquidity The total pool liquidity
     */
    function startAuction(
        address pool,
        uint256 gapSize,
        uint256 poolLiquidity
    ) external onlyAuthorizedPool returns (bytes32 auctionId) {
        if (gapSize < MIN_GAP_THRESHOLD) revert BidTooLow();

        auctionId = keccak256(
            abi.encodePacked(pool, gapSize, block.timestamp, auctionCount++)
        );

        uint256 minBid = _calculateMinBid(gapSize, poolLiquidity, 0);

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            pool: pool,
            gapSize: gapSize,
            poolLiquidity: poolLiquidity,
            startTime: block.timestamp,
            commitDeadline: block.timestamp + COMMIT_PERIOD,
            revealDeadline: block.timestamp + COMMIT_PERIOD + REVEAL_PERIOD,
            minBid: minBid,
            winner: address(0),
            winningBid: 0,
            phase: AuctionPhase.COMMIT
        });

        emit AuctionStarted(auctionId, pool, gapSize, minBid);
        return auctionId;
    }

    /**
     * @notice Commit to a bid (Phase 1)
     * @param auctionId The auction identifier
     * @param commitment Hash of (bidAmount, salt, msg.sender)
     */
    function commit(
        bytes32 auctionId,
        bytes32 commitment
    ) external validPhase(auctionId, AuctionPhase.COMMIT) {
        Auction storage auction = auctions[auctionId];

        if (block.timestamp > auction.commitDeadline) {
            auction.phase = AuctionPhase.REVEAL;
            revert InvalidPhase();
        }

        if (bids[auctionId][msg.sender].commitment != bytes32(0)) {
            revert AlreadyCommitted();
        }

        bids[auctionId][msg.sender].commitment = commitment;

        emit BidCommitted(auctionId, msg.sender);
    }

    /**
     * @notice Reveal bid (Phase 2)
     * @param auctionId The auction identifier
     * @param bidAmount The bid amount
     * @param salt Random salt used in commitment
     */
    function reveal(
        bytes32 auctionId,
        uint256 bidAmount,
        bytes32 salt
    ) external {
        Auction storage auction = auctions[auctionId];

        // Transition to reveal phase if commit period ended
        if (
            auction.phase == AuctionPhase.COMMIT &&
            block.timestamp > auction.commitDeadline
        ) {
            auction.phase = AuctionPhase.REVEAL;
        }

        if (auction.phase != AuctionPhase.REVEAL) revert InvalidPhase();
        if (block.timestamp > auction.revealDeadline) revert AuctionExpired();

        Bid storage bid = bids[auctionId][msg.sender];

        if (bid.commitment == bytes32(0)) revert NotRevealed();
        if (bid.revealed) revert AlreadyCommitted();

        // Verify commitment
        bytes32 computedHash = keccak256(
            abi.encodePacked(bidAmount, salt, msg.sender)
        );

        if (computedHash != bid.commitment) revert InvalidReveal();

        // Calculate current minimum bid with decay
        uint256 timeElapsed = block.timestamp - auction.startTime;
        uint256 currentMinBid = _calculateMinBid(
            auction.gapSize,
            auction.poolLiquidity,
            timeElapsed
        );

        // Validate and store bid
        bid.bidAmount = bidAmount;
        bid.salt = salt;
        bid.revealed = true;
        bid.valid = bidAmount >= currentMinBid;

        // Update winner if this is the highest valid bid
        if (bid.valid && bidAmount > auction.winningBid) {
            auction.winner = msg.sender;
            auction.winningBid = bidAmount;
        }

        emit BidRevealed(auctionId, msg.sender, bidAmount);
    }

    /**
     * @notice Settle the auction and distribute proceeds
     */
    function settle(bytes32 auctionId) external {
        Auction storage auction = auctions[auctionId];

        if (
            auction.phase == AuctionPhase.REVEAL &&
            block.timestamp > auction.revealDeadline
        ) {
            auction.phase = AuctionPhase.SETTLED;
        }

        if (auction.phase != AuctionPhase.SETTLED) revert InvalidPhase();

        if (auction.winner != address(0)) {
            // Transfer winning bid from winner to this contract
            paymentToken.safeTransferFrom(
                auction.winner,
                address(this),
                auction.winningBid
            );

            // Transfer to pool/LPs (simplified - would integrate with pool)
            paymentToken.safeTransfer(auction.pool, auction.winningBid);
        }

        emit AuctionSettled(auctionId, auction.winner, auction.winningBid);
    }

    /**
     * @notice Get current minimum bid
     */
    function getMinBid(bytes32 auctionId) external view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        uint256 timeElapsed = block.timestamp - auction.startTime;
        return
            _calculateMinBid(
                auction.gapSize,
                auction.poolLiquidity,
                timeElapsed
            );
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate minimum bid with exponential decay
     * @dev MinBid(t) = Gap × L × CaptureRate × e^(-λt)
     */
    function _calculateMinBid(
        uint256 gapSize,
        uint256 poolLiquidity,
        uint256 timeElapsed
    ) internal pure returns (uint256) {
        // Gap × L × CaptureRate
        uint256 baseValue = (gapSize * poolLiquidity * CAPTURE_RATE) /
            (10000 * PRECISION);

        // Apply exponential decay: e^(-0.4 * t)
        // Simplified approximation: (1 - 0.4t) for small t
        uint256 minutesElapsed = timeElapsed / 60;

        if (minutesElapsed >= 5) {
            return 0; // After 5 minutes, no minimum bid
        }

        // Linear approximation of decay
        uint256 decayFactor = PRECISION - (DECAY_RATE * minutesElapsed);
        return (baseValue * decayFactor) / PRECISION;
    }

    // ============ View Functions ============

    function getAuction(
        bytes32 auctionId
    ) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    function getBid(
        bytes32 auctionId,
        address bidder
    ) external view returns (Bid memory) {
        return bids[auctionId][bidder];
    }

    function isAuctionActive(bytes32 auctionId) external view returns (bool) {
        Auction storage auction = auctions[auctionId];
        return
            auction.phase == AuctionPhase.COMMIT ||
            auction.phase == AuctionPhase.REVEAL;
    }

    // ============ Admin Functions ============

    function authorizePool(address pool) external {
        // Add access control
        authorizedPools[pool] = true;
    }

    function unauthorizePool(address pool) external {
        // Add access control
        authorizedPools[pool] = false;
    }
}

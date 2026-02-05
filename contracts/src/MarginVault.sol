// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MarginVault
 * @notice Collateral custody and Yellow Network state channel settlement
 */
contract MarginVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct ChannelState {
        bytes32 channelId;
        address lpAddress;
        bytes32 ensNode;
        uint256 currentVPIN;
        uint8 currentRegime;
        uint24 recommendedFee;
        int256 inventory;
        uint256 turnNum;
        uint256 timestamp;
        bytes32 stateHash;
    }

    struct VaultInfo {
        uint256 collateralAmount;
        uint256 lockedUntil;
        bool hasActiveChannel;
        bytes32 activeChannelId;
        uint256 lastWithdrawal;
    }

    // ============ State Variables ============

    mapping(address => VaultInfo) public vaults;
    mapping(bytes32 => ChannelState) public channels;
    mapping(bytes32 => bool) public disputes;

    address public hook;
    address public clearNode;
    IERC20 public collateralToken;

    uint256 public constant MIN_LOCK_PERIOD = 1 hours;
    uint256 public constant DISPUTE_PERIOD = 1 days;
    uint256 public constant MIN_COLLATERAL = 1000 * 1e18;

    // ============ Events ============

    event Deposited(address indexed lp, uint256 amount);
    event Withdrawn(address indexed lp, uint256 amount);
    event ChannelOpened(bytes32 indexed channelId, address indexed lp);
    event ChannelClosed(bytes32 indexed channelId);
    event StateSubmitted(bytes32 indexed channelId, uint256 turnNum);
    event DisputeInitiated(
        bytes32 indexed channelId,
        address indexed initiator
    );

    // ============ Errors ============

    error InsufficientCollateral();
    error VaultLocked();
    error ChannelAlreadyOpen();
    error NoActiveChannel();
    error InvalidState();
    error UnauthorizedCaller();
    error DisputePeriodActive();

    // ============ Modifiers ============

    modifier onlyHook() {
        if (msg.sender != hook) revert UnauthorizedCaller();
        _;
    }

    modifier onlyClearNode() {
        if (msg.sender != clearNode) revert UnauthorizedCaller();
        _;
    }

    // ============ Constructor ============

    constructor(address _collateralToken, address _hook, address _clearNode) {
        collateralToken = IERC20(_collateralToken);
        hook = _hook;
        clearNode = _clearNode;
    }

    // ============ External Functions ============

    /**
     * @notice Deposit collateral to vault
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount < MIN_COLLATERAL) revert InsufficientCollateral();

        VaultInfo storage vault = vaults[msg.sender];

        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        vault.collateralAmount += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw collateral from vault
     */
    function withdraw(uint256 amount) external nonReentrant {
        VaultInfo storage vault = vaults[msg.sender];

        if (block.timestamp < vault.lockedUntil) revert VaultLocked();
        if (vault.collateralAmount < amount) revert InsufficientCollateral();
        if (vault.hasActiveChannel) revert ChannelAlreadyOpen();

        vault.collateralAmount -= amount;
        collateralToken.safeTransfer(msg.sender, amount);

        vault.lastWithdrawal = block.timestamp;
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Open Yellow Network state channel
     */
    function openChannel(bytes32 ensNode) external returns (bytes32 channelId) {
        VaultInfo storage vault = vaults[msg.sender];

        if (vault.hasActiveChannel) revert ChannelAlreadyOpen();
        if (vault.collateralAmount < MIN_COLLATERAL)
            revert InsufficientCollateral();

        channelId = keccak256(
            abi.encodePacked(msg.sender, ensNode, block.timestamp)
        );

        channels[channelId] = ChannelState({
            channelId: channelId,
            lpAddress: msg.sender,
            ensNode: ensNode,
            currentVPIN: 0,
            currentRegime: 0,
            recommendedFee: 0,
            inventory: 0,
            turnNum: 0,
            timestamp: block.timestamp,
            stateHash: bytes32(0)
        });

        vault.hasActiveChannel = true;
        vault.activeChannelId = channelId;

        emit ChannelOpened(channelId, msg.sender);
        return channelId;
    }

    /**
     * @notice Submit signed state from ClearNode
     */
    function submitState(
        bytes32 channelId,
        ChannelState calldata newState,
        bytes calldata lpSignature,
        bytes calldata clearNodeSignature
    ) external onlyClearNode {
        ChannelState storage channel = channels[channelId];

        if (channel.lpAddress == address(0)) revert NoActiveChannel();
        if (newState.turnNum <= channel.turnNum) revert InvalidState();

        // Verify signatures (simplified - would use full verification)
        bytes32 stateHash = _hashState(newState);

        // Update channel state
        channel.currentVPIN = newState.currentVPIN;
        channel.currentRegime = newState.currentRegime;
        channel.recommendedFee = newState.recommendedFee;
        channel.inventory = newState.inventory;
        channel.turnNum = newState.turnNum;
        channel.timestamp = block.timestamp;
        channel.stateHash = stateHash;

        emit StateSubmitted(channelId, newState.turnNum);
    }

    /**
     * @notice Close state channel and settle on-chain
     */
    function closeChannel(bytes32 channelId) external {
        ChannelState storage channel = channels[channelId];
        VaultInfo storage vault = vaults[channel.lpAddress];

        if (msg.sender != channel.lpAddress && msg.sender != clearNode) {
            revert UnauthorizedCaller();
        }
        if (disputes[channelId]) revert DisputePeriodActive();

        // Settle any pending inventory adjustments
        // (Simplified - would include full settlement logic)

        vault.hasActiveChannel = false;
        vault.activeChannelId = bytes32(0);
        delete channels[channelId];

        emit ChannelClosed(channelId);
    }

    /**
     * @notice Initiate dispute resolution
     */
    function dispute(bytes32 channelId) external {
        ChannelState storage channel = channels[channelId];

        if (msg.sender != channel.lpAddress) revert UnauthorizedCaller();
        if (disputes[channelId]) revert DisputePeriodActive();

        disputes[channelId] = true;
        emit DisputeInitiated(channelId, msg.sender);
    }

    /**
     * @notice Lock vault during high-risk periods
     */
    function lockVault(address lp, uint256 duration) external onlyHook {
        VaultInfo storage vault = vaults[lp];
        vault.lockedUntil = block.timestamp + duration;
    }

    // ============ View Functions ============

    function getVaultInfo(address lp) external view returns (VaultInfo memory) {
        return vaults[lp];
    }

    function getChannelState(
        bytes32 channelId
    ) external view returns (ChannelState memory) {
        return channels[channelId];
    }

    // ============ Internal Functions ============

    function _hashState(
        ChannelState calldata state
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    state.channelId,
                    state.lpAddress,
                    state.ensNode,
                    state.currentVPIN,
                    state.currentRegime,
                    state.recommendedFee,
                    state.inventory,
                    state.turnNum,
                    state.timestamp
                )
            );
    }

    // ============ Admin Functions ============

    function setClearNode(address _clearNode) external {
        // Add access control
        clearNode = _clearNode;
    }

    function setHook(address _hook) external {
        // Add access control
        hook = _hook;
    }
}

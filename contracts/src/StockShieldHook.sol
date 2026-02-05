// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {toBeforeSwapDelta} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";

/**
 * @title StockShieldHook
 * @notice Uniswap v4 Hook for LP protection in tokenized securities AMMs
 * @dev Implements dynamic fees, circuit breakers, and gap auctions
 */
contract StockShieldHook is BaseHook {
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;

    // ============ Enums ============

    enum Regime {
        CORE_SESSION, // 9:35-16:00 ET
        SOFT_OPEN, // 9:30-9:35 ET
        PRE_MARKET, // 4:00-9:30 ET
        AFTER_HOURS, // 16:00-20:00 ET
        OVERNIGHT, // 20:00-4:00 ET
        WEEKEND, // Fri 20:00 - Mon 4:00 ET
        HOLIDAY
    }

    // ============ Structs ============

    struct MarketState {
        Regime currentRegime;
        uint40 regimeStartTime;
        uint128 lastOraclePrice;
        uint40 lastOracleUpdate;
        uint128 realizedVolatility; // EMA of squared returns
        uint64 vpinScore; // Scaled by 1e6
        int128 inventoryImbalance; // Scaled by 1e18
        uint8 circuitBreakerLevel; // 0-4
        bool inGapAuction;
        uint40 gapAuctionEndTime;
    }

    struct FeeParams {
        uint24 baseFee;
        uint24 alpha; // Volatility sensitivity
        uint24 beta; // VPIN sensitivity
        uint24 delta; // Inventory sensitivity
        uint24 regimeMult; // Regime multiplier
    }

    struct SwapContext {
        uint256 oraclePrice;
        uint256 currentPrice;
        uint256 deviation;
        uint24 dynamicFee;
        bool isValid;
    }

    // ============ Constants ============

    uint256 private constant PRECISION = 1e18;
    uint256 private constant VPIN_PRECISION = 1e6;
    uint256 private constant SMOOTHING_FACTOR = 20;
    uint256 private constant MAX_STALENESS_CORE = 60;
    uint256 private constant MAX_STALENESS_EXTENDED = 120;
    uint256 private constant MAX_DEVIATION_CORE = 300; // 3% in bps
    uint256 private constant MAX_DEVIATION_EXTENDED = 500; // 5% in bps

    uint8 private constant LEVEL_NORMAL = 0;
    uint8 private constant LEVEL_WARNING = 1;
    uint8 private constant LEVEL_CAUTION = 2;
    uint8 private constant LEVEL_DANGER = 3;
    uint8 private constant LEVEL_PAUSE = 4;

    // ============ State Variables ============

    mapping(PoolId => MarketState) public markets;
    mapping(Regime => FeeParams) public regimeFeeParams;

    address public regimeOracle;
    address public priceOracle;
    address public gapAuction;
    address public marginVault;

    // ============ Events ============

    event RegimeChanged(
        PoolId indexed poolId,
        Regime oldRegime,
        Regime newRegime
    );
    event CircuitBreakerTriggered(PoolId indexed poolId, uint8 level);
    event DynamicFeeUpdated(PoolId indexed poolId, uint24 newFee);
    event GapAuctionStarted(PoolId indexed poolId, uint256 endTime);
    event VPINUpdated(PoolId indexed poolId, uint64 newVPIN);

    // ============ Errors ============

    error OracleStale();
    error PriceDeviationTooHigh();
    error TradingPaused();
    error GapAuctionBidTooLow();
    error UnauthorizedCaller();

    // ============ Constructor ============

    constructor(
        IPoolManager _poolManager,
        address _regimeOracle,
        address _priceOracle
    ) BaseHook(_poolManager) {
        regimeOracle = _regimeOracle;
        priceOracle = _priceOracle;
        _initializeFeeParams();
    }

    // ============ Hook Permissions ============

    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
        return
            Hooks.Permissions({
                beforeInitialize: true,
                afterInitialize: true,
                beforeAddLiquidity: true,
                afterAddLiquidity: false,
                beforeRemoveLiquidity: true,
                afterRemoveLiquidity: false,
                beforeSwap: true,
                afterSwap: true,
                beforeDonate: false,
                afterDonate: false,
                beforeSwapReturnDelta: false,
                afterSwapReturnDelta: false,
                afterAddLiquidityReturnDelta: false,
                afterRemoveLiquidityReturnDelta: false
            });
    }

    // ============ Hook Implementations (Override internal functions) ============

    /**
     * @notice Hook called before pool initialization
     * @dev Used to set the dynamic fee flag on pool initialization
     */
    function _beforeInitialize(
        address,
        PoolKey calldata key,
        uint160
    ) internal override returns (bytes4) {
        // Verify the pool is set up for dynamic fees
        // In Uniswap v4, the fee in PoolKey must have the DYNAMIC_FEE_FLAG set
        if (!key.fee.isDynamicFee()) {
            revert("Pool must be initialized with dynamic fee flag");
        }

        return BaseHook.beforeInitialize.selector;
    }

    function _afterInitialize(
        address,
        PoolKey calldata key,
        uint160,
        int24
    ) internal override returns (bytes4) {
        PoolId poolId = key.toId();
        markets[poolId].currentRegime = Regime.CORE_SESSION;
        markets[poolId].regimeStartTime = uint40(block.timestamp);
        markets[poolId].circuitBreakerLevel = LEVEL_NORMAL;

        return BaseHook.afterInitialize.selector;
    }

    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        MarketState storage state = markets[poolId];

        // Step 1: Update regime
        _updateRegime(state);

        // Step 2: Validate trading conditions
        SwapContext memory ctx = _validateSwap(state, poolId);
        if (!ctx.isValid) revert TradingPaused();

        // Step 3: Check gap auction
        if (state.inGapAuction) {
            _validateGapAuction(state, hookData);
        }

        // Step 4: Calculate dynamic fee
        uint24 fee = _calculateDynamicFee(state, ctx);

        emit DynamicFeeUpdated(poolId, fee);

        // Return with OVERRIDE_FEE_FLAG set to enable dynamic fee
        // BeforeSwapDelta is ZERO_DELTA (no delta to hook balances)
        return (
            BaseHook.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            fee | LPFeeLibrary.OVERRIDE_FEE_FLAG
        );
    }

    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        MarketState storage state = markets[poolId];

        // Update volatility
        _updateVolatility(state);

        // Update inventory
        _updateInventory(state, params);

        return (BaseHook.afterSwap.selector, 0);
    }

    function _beforeAddLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal override returns (bytes4) {
        PoolId poolId = key.toId();
        MarketState storage state = markets[poolId];

        // During gap auction, verify participation
        if (state.inGapAuction) {
            // Additional validation logic for gap auction participation
        }

        return BaseHook.beforeAddLiquidity.selector;
    }

    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal override returns (bytes4) {
        PoolId poolId = key.toId();
        MarketState storage state = markets[poolId];

        // Prevent removal during high-risk periods
        if (
            state.currentRegime == Regime.OVERNIGHT ||
            state.currentRegime == Regime.WEEKEND
        ) {
            if (state.circuitBreakerLevel >= LEVEL_CAUTION) {
                revert TradingPaused();
            }
        }

        return BaseHook.beforeRemoveLiquidity.selector;
    }

    // ============ Internal Functions ============

    function _updateRegime(MarketState storage state) internal {
        // Call external regime oracle
        Regime newRegime = _getCurrentRegime();

        if (newRegime != state.currentRegime) {
            emit RegimeChanged(
                PoolId.wrap(bytes32(0)), // Pool ID from context
                state.currentRegime,
                newRegime
            );
            state.currentRegime = newRegime;
            state.regimeStartTime = uint40(block.timestamp);
        }
    }

    function _validateSwapConditions(
        MarketState storage state,
        PoolId poolId
    ) internal view returns (SwapContext memory ctx) {
        // Check circuit breaker
        if (state.circuitBreakerLevel >= LEVEL_PAUSE) {
            ctx.isValid = false;
            return ctx;
        }

        // Get oracle price and check staleness
        (uint256 price, uint256 timestamp) = _getOraclePrice(poolId);
        ctx.oraclePrice = price;

        uint256 maxStaleness = (state.currentRegime == Regime.CORE_SESSION)
            ? MAX_STALENESS_CORE
            : MAX_STALENESS_EXTENDED;

        if (block.timestamp - timestamp > maxStaleness) {
            revert OracleStale();
        }

        // Check price deviation (simplified - would use actual pool price)
        ctx.currentPrice = uint256(state.lastOraclePrice);
        ctx.deviation = _calculateDeviation(ctx.oraclePrice, ctx.currentPrice);

        uint256 maxDeviation = (state.currentRegime == Regime.CORE_SESSION)
            ? MAX_DEVIATION_CORE
            : MAX_DEVIATION_EXTENDED;

        if (ctx.deviation > maxDeviation) {
            revert PriceDeviationTooHigh();
        }

        ctx.isValid = true;
        return ctx;
    }

    function _validateSwap(
        MarketState storage state,
        PoolId poolId
    ) internal view returns (SwapContext memory ctx) {
        return _validateSwapConditions(state, poolId);
    }

    function _calculateDynamicFee(
        MarketState storage state,
        SwapContext memory ctx
    ) internal view returns (uint24) {
        FeeParams memory params = regimeFeeParams[state.currentRegime];

        // Base fee
        uint256 fee = params.baseFee;

        // Volatility component: alpha * sigma^2
        uint256 volComponent = (uint256(params.alpha) *
            state.realizedVolatility) / PRECISION;

        // VPIN component: beta * VPIN
        uint256 vpinComponent = (uint256(params.beta) * state.vpinScore) /
            VPIN_PRECISION;

        // Inventory component: delta * |inventory|
        uint256 invComponent = (uint256(params.delta) *
            _abs(state.inventoryImbalance)) / PRECISION;

        // Regime multiplier
        uint256 regimeAdjustment = (params.regimeMult *
            (volComponent + vpinComponent)) / PRECISION;

        // Combine all components
        fee =
            fee +
            volComponent +
            vpinComponent +
            regimeAdjustment +
            invComponent;

        // Apply cap based on regime
        uint256 maxFee = _getMaxFee(state.currentRegime);
        if (fee > maxFee) {
            fee = maxFee;
        }

        return uint24(fee);
    }

    function _updateVolatility(MarketState storage state) internal {
        (uint256 newPrice, ) = _getOraclePrice(PoolId.wrap(bytes32(0)));

        if (state.lastOraclePrice == 0) {
            state.lastOraclePrice = uint128(newPrice);
            return;
        }

        // Calculate return squared
        int256 priceDiff = int256(newPrice) -
            int256(uint256(state.lastOraclePrice));
        uint256 absReturn = priceDiff >= 0
            ? (uint256(priceDiff) * PRECISION) / uint256(state.lastOraclePrice)
            : (uint256(-priceDiff) * PRECISION) /
                uint256(state.lastOraclePrice);

        uint256 returnSquared = (absReturn * absReturn) / PRECISION;

        // EMA update
        uint256 alpha = (2 * PRECISION) / (SMOOTHING_FACTOR + 1);
        state.realizedVolatility = uint128(
            (returnSquared *
                alpha +
                uint256(state.realizedVolatility) *
                (PRECISION - alpha)) / PRECISION
        );

        state.lastOraclePrice = uint128(newPrice);
        state.lastOracleUpdate = uint40(block.timestamp);
    }

    function _updateInventory(
        MarketState storage state,
        SwapParams calldata params
    ) internal {
        // Update inventory based on swap direction
        int128 inventoryDelta = params.zeroForOne
            ? int128(params.amountSpecified)
            : -int128(params.amountSpecified);
        state.inventoryImbalance += inventoryDelta;
    }

    function _validateGapAuction(
        MarketState storage state,
        bytes calldata hookData
    ) internal view {
        if (block.timestamp > state.gapAuctionEndTime) {
            return; // Auction ended
        }

        // Decode bid from hookData
        if (hookData.length < 32) {
            revert GapAuctionBidTooLow();
        }

        uint256 bid = abi.decode(hookData, (uint256));
        uint256 minBid = _calculateMinGapBid(state);

        if (bid < minBid) {
            revert GapAuctionBidTooLow();
        }
    }

    function _calculateMinGapBid(
        MarketState storage state
    ) internal view returns (uint256) {
        // Simplified calculation - would include pool liquidity
        uint256 timeSinceStart = block.timestamp -
            (state.gapAuctionEndTime - 300); // 5 min auction
        uint256 decayFactor = (timeSinceStart * 40) / 100; // 0.4 per minute decay

        return (1000 * PRECISION) / (1 + decayFactor); // Simplified formula
    }

    function _calculateDeviation(
        uint256 price1,
        uint256 price2
    ) internal pure returns (uint256) {
        if (price2 == 0) return 0;
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        return (diff * 10000) / price2; // Return in basis points
    }

    function _abs(int128 value) internal pure returns (uint128) {
        return value >= 0 ? uint128(value) : uint128(-value);
    }

    function _getMaxFee(Regime regime) internal pure returns (uint256) {
        if (regime == Regime.CORE_SESSION) return 300; // 3%
        if (regime == Regime.PRE_MARKET || regime == Regime.AFTER_HOURS)
            return 500; // 5%
        return 1000; // 10% for overnight/weekend
    }

    // ============ External Oracle Calls ============

    function _getCurrentRegime() internal view returns (Regime) {
        // Call external regime oracle
        // Simplified - would call actual oracle contract
        return Regime.CORE_SESSION;
    }

    function _getOraclePrice(
        PoolId
    ) internal view returns (uint256 price, uint256 timestamp) {
        // Call external price oracle
        // Simplified - would call actual oracle contract
        return (1000 * PRECISION, block.timestamp);
    }

    // ============ Admin Functions ============

    function setRegimeOracle(address _oracle) external {
        // Add access control
        regimeOracle = _oracle;
    }

    function setPriceOracle(address _oracle) external {
        // Add access control
        priceOracle = _oracle;
    }

    function setGapAuction(address _auction) external {
        // Add access control
        gapAuction = _auction;
    }

    function updateVPIN(PoolId poolId, uint64 newVPIN) external {
        // Should be called by authorized off-chain service (Yellow Network)
        markets[poolId].vpinScore = newVPIN;
        emit VPINUpdated(poolId, newVPIN);
    }

    function startGapAuction(PoolId poolId, uint256 duration) external {
        // Should be called by authorized contract
        MarketState storage state = markets[poolId];
        state.inGapAuction = true;
        state.gapAuctionEndTime = uint40(block.timestamp + duration);
        emit GapAuctionStarted(poolId, state.gapAuctionEndTime);
    }

    // ============ Helper Functions for V4 Fee Library ============

    /**
     * @notice Check if a fee has the dynamic fee flag set
     * @dev Uses LPFeeLibrary from v4-core
     */
    function _isDynamicFee(uint24 fee) internal pure returns (bool) {
        return
            (fee & LPFeeLibrary.OVERRIDE_FEE_FLAG) ==
            LPFeeLibrary.OVERRIDE_FEE_FLAG;
    }

    /**
     * @notice Remove the dynamic fee flag to get the actual fee value
     */
    function _getCleanFee(uint24 fee) internal pure returns (uint24) {
        return fee & ~LPFeeLibrary.OVERRIDE_FEE_FLAG;
    }

    /**
     * @notice Validate fee is within acceptable range
     * @dev Max fee is 100% (1000000 in pips format)
     */
    function _isValidFee(uint24 fee) internal pure returns (bool) {
        uint24 cleanFee = _getCleanFee(fee);
        return cleanFee <= 1000000; // 100% max
    }

    function _initializeFeeParams() internal {
        // Core session
        regimeFeeParams[Regime.CORE_SESSION] = FeeParams({
            baseFee: 5, // 0.05%
            alpha: 50, // 0.5
            beta: 30, // 0.3
            delta: 10, // 0.1
            regimeMult: 100 // 1.0
        });

        // Pre-market
        regimeFeeParams[Regime.PRE_MARKET] = FeeParams({
            baseFee: 15,
            alpha: 100,
            beta: 50,
            delta: 20,
            regimeMult: 200
        });

        // After hours
        regimeFeeParams[Regime.AFTER_HOURS] = FeeParams({
            baseFee: 15,
            alpha: 100,
            beta: 50,
            delta: 20,
            regimeMult: 200
        });

        // Overnight
        regimeFeeParams[Regime.OVERNIGHT] = FeeParams({
            baseFee: 30,
            alpha: 150,
            beta: 100,
            delta: 30,
            regimeMult: 400
        });

        // Weekend
        regimeFeeParams[Regime.WEEKEND] = FeeParams({
            baseFee: 50,
            alpha: 200,
            beta: 150,
            delta: 50,
            regimeMult: 600
        });
    }
}

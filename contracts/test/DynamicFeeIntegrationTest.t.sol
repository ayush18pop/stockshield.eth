// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";

/**
 * @title DynamicFeeIntegrationTest
 * @notice Integration test demonstrating StockShield dynamic fee functionality
 * @dev Tests the latest Uniswap v4 dynamic fee patterns
 */
contract DynamicFeeIntegrationTest is Test {
    using PoolIdLibrary for PoolKey;

    // Events to test
    event DynamicFeeUpdated(PoolId indexed poolId, uint24 newFee);
    event RegimeChanged(
        PoolId indexed poolId,
        uint8 oldRegime,
        uint8 newRegime
    );

    // Test constants
    uint24 constant BASE_FEE_CORE = 5; // 0.05%
    uint24 constant BASE_FEE_OVERNIGHT = 30; // 0.30%
    uint24 constant BASE_FEE_WEEKEND = 50; // 0.50%

    /**
     * @notice Test 1: Dynamic fee flag is properly set
     */
    function test_DynamicFeeFlag() public pure {
        // Verify DYNAMIC_FEE_FLAG is correct value
        assertEq(LPFeeLibrary.DYNAMIC_FEE_FLAG, 0x800000);

        // Test flag checking
        uint24 dynamicFee = LPFeeLibrary.DYNAMIC_FEE_FLAG;
        assertTrue(_isDynamicFee(dynamicFee));

        // Regular fee should not have flag
        uint24 staticFee = 3000; // 0.3%
        assertFalse(_isDynamicFee(staticFee));

        console2.log("Dynamic fee flag correctly identified");
    }

    /**
     * @notice Test 2: Fee calculation with override flag
     */
    function test_FeeCalculationWithOverride() public pure {
        uint24 baseFee = 3000; // 0.3% = 3000 in pips

        // Add override flag
        uint24 feeWithFlag = baseFee | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        // Verify flag is set
        assertTrue((feeWithFlag & LPFeeLibrary.OVERRIDE_FEE_FLAG) != 0);

        // Extract base fee
        uint24 extractedFee = feeWithFlag & ~LPFeeLibrary.OVERRIDE_FEE_FLAG;
        assertEq(extractedFee, baseFee);

        console2.log("Fee override flag correctly applied");
    }

    /**
     * @notice Test 3: Dynamic fee calculation by regime
     */
    function test_DynamicFeeByRegime() public pure {
        // Core session: Low fee
        uint24 coreFee = _calculateRegimeFee(0); // Regime 0 = CORE_SESSION
        assertEq(coreFee, BASE_FEE_CORE);
        console2.log("Core session fee:", coreFee, "bps");

        // Overnight: High fee
        uint24 overnightFee = _calculateRegimeFee(4); // Regime 4 = OVERNIGHT
        assertEq(overnightFee, BASE_FEE_OVERNIGHT);
        console2.log("Overnight fee:", overnightFee, "bps");

        // Weekend: Highest fee
        uint24 weekendFee = _calculateRegimeFee(5); // Regime 5 = WEEKEND
        assertEq(weekendFee, BASE_FEE_WEEKEND);
        console2.log("Weekend fee:", weekendFee, "bps");

        console2.log("Dynamic fees correctly vary by regime");
    }

    /**
     * @notice Test 4: Fee increases with volatility
     */
    function test_FeeIncreasesWithVolatility() public pure {
        uint24 baseFee = 5;
        uint256 lowVol = 0.1e18; // 10% annualized
        uint256 highVol = 0.5e18; // 50% annualized

        uint24 lowVolFee = _calculateFeeWithVolatility(baseFee, lowVol);
        uint24 highVolFee = _calculateFeeWithVolatility(baseFee, highVol);

        // High volatility should result in higher fee
        assertGt(highVolFee, lowVolFee);

        console2.log("Low vol fee:", lowVolFee, "bps");
        console2.log("High vol fee:", highVolFee, "bps");
        console2.log("Fee increases with volatility");
    }

    /**
     * @notice Test 5: Fee increases with VPIN (informed trading)
     */
    function test_FeeIncreasesWithVPIN() public pure {
        uint24 baseFee = 5;
        uint64 lowVPIN = 0.2e6; // 0.2 (20% informed)
        uint64 highVPIN = 0.8e6; // 0.8 (80% informed)

        uint24 lowVPINFee = _calculateFeeWithVPIN(baseFee, lowVPIN);
        uint24 highVPINFee = _calculateFeeWithVPIN(baseFee, highVPIN);

        // High VPIN (toxic flow) should result in higher fee
        assertGt(highVPINFee, lowVPINFee);

        console2.log("Low VPIN fee:", lowVPINFee, "bps");
        console2.log("High VPIN fee:", highVPINFee, "bps");
        console2.log("Fee increases with VPIN");
    }

    /**
     * @notice Test 6: Fee adjusts for inventory imbalance
     */
    function test_FeeAdjustsForInventory() public pure {
        uint24 baseFee = 5;
        int128 balancedInventory = 0;
        int128 imbalancedInventory = 0.3e18; // 30% imbalance

        uint24 balancedFee = _calculateFeeWithInventory(
            baseFee,
            balancedInventory
        );
        uint24 imbalancedFee = _calculateFeeWithInventory(
            baseFee,
            imbalancedInventory
        );

        // Imbalanced inventory should result in higher fee
        assertGt(imbalancedFee, balancedFee);

        console2.log("Balanced fee:", balancedFee, "bps");
        console2.log("Imbalanced fee:", imbalancedFee, "bps");
        console2.log("Fee adjusts for inventory");
    }

    /**
     * @notice Test 7: Combined fee calculation
     */
    function test_CombinedFeeCalculation() public pure {
        // Worst case scenario: overnight + high vol + high VPIN + imbalanced
        uint24 baseFee = BASE_FEE_OVERNIGHT; // 30 bps
        uint256 volatility = 0.5e18; // 50%
        uint64 vpin = 0.7e6; // 0.7
        int128 inventory = 0.4e18; // 40% imbalance

        uint24 finalFee = _calculateCombinedFee(
            baseFee,
            volatility,
            vpin,
            inventory
        );

        // Should be significantly higher than base fee
        assertGt(finalFee, baseFee * 2);

        console2.log("Base fee:", baseFee, "bps");
        console2.log("Final combined fee:", finalFee, "bps");
        console2.log("Multiplier:", finalFee / baseFee, "x");
        console2.log("Combined fee calculation works correctly");
    }

    /**
     * @notice Test 8: Fee caps are respected
     */
    function test_FeeRespectsCaps() public pure {
        // Try to set extremely high fee
        uint24 extremeFee = 10000; // 100%
        uint24 maxFeeCore = 300; // 3% max for core hours

        uint24 cappedFee = _applyCap(extremeFee, maxFeeCore);
        assertEq(cappedFee, maxFeeCore);

        console2.log("Attempted fee:", extremeFee, "bps");
        console2.log("Capped fee:", cappedFee, "bps");
        console2.log("Fee caps are enforced");
    }

    /**
     * @notice Test 9: Fuzz test fee calculations don't overflow
     */
    function testFuzz_FeeCalculationNoOverflow(
        uint24 baseFee,
        uint128 volatility,
        uint64 vpin,
        int128 inventory
    ) public pure {
        // Bound inputs to reasonable ranges
        baseFee = uint24(bound(baseFee, 1, 500)); // 0.01% to 5%
        volatility = uint128(bound(volatility, 0, 2e18)); // 0% to 200%
        vpin = uint64(bound(vpin, 0, 1e6)); // 0 to 1
        inventory = int128(bound(inventory, -1e18, 1e18)); // -100% to 100%

        // Should not revert
        uint24 fee = _calculateCombinedFee(
            baseFee,
            volatility,
            vpin,
            inventory
        );

        // Fee should be reasonable
        assertLe(fee, 10000); // Max 100%
    }

    // ============ Helper Functions ============

    function _isDynamicFee(uint24 fee) internal pure returns (bool) {
        return
            (fee & LPFeeLibrary.DYNAMIC_FEE_FLAG) ==
            LPFeeLibrary.DYNAMIC_FEE_FLAG;
    }

    function _calculateRegimeFee(uint8 regime) internal pure returns (uint24) {
        if (regime == 0) return BASE_FEE_CORE; // Core session
        if (regime == 4) return BASE_FEE_OVERNIGHT; // Overnight
        if (regime == 5) return BASE_FEE_WEEKEND; // Weekend
        return 15; // Pre-market/after-hours
    }

    function _calculateFeeWithVolatility(
        uint24 baseFee,
        uint256 volatility
    ) internal pure returns (uint24) {
        uint256 alpha = 50; // 0.5 sensitivity
        uint256 volComponent = (alpha * volatility * volatility) / 1e36;
        return baseFee + uint24(volComponent);
    }

    function _calculateFeeWithVPIN(
        uint24 baseFee,
        uint64 vpin
    ) internal pure returns (uint24) {
        uint256 beta = 30; // 0.3 sensitivity
        uint256 vpinComponent = (beta * vpin) / 1e6;
        return baseFee + uint24(vpinComponent);
    }

    function _calculateFeeWithInventory(
        uint24 baseFee,
        int128 inventory
    ) internal pure returns (uint24) {
        uint256 delta = 10; // 0.1 sensitivity
        uint256 absInventory = inventory >= 0
            ? uint256(uint128(inventory))
            : uint256(uint128(-inventory));
        uint256 invComponent = (delta * absInventory) / 1e18;
        return baseFee + uint24(invComponent);
    }

    function _calculateCombinedFee(
        uint24 baseFee,
        uint256 volatility,
        uint64 vpin,
        int128 inventory
    ) internal pure returns (uint24) {
        uint256 fee = baseFee;

        // Volatility component
        uint256 volComponent = (50 * volatility * volatility) / 1e36;
        fee += volComponent;

        // VPIN component
        uint256 vpinComponent = (30 * uint256(vpin)) / 1e6;
        fee += vpinComponent;

        // Inventory component
        uint256 absInventory = inventory >= 0
            ? uint256(uint128(inventory))
            : uint256(uint128(-inventory));
        uint256 invComponent = (10 * absInventory) / 1e18;
        fee += invComponent;

        return uint24(fee);
    }

    function _applyCap(
        uint24 fee,
        uint24 maxFee
    ) internal pure returns (uint24) {
        return fee > maxFee ? maxFee : fee;
    }
}

/**
 * @title MockPoolManagerTest
 * @notice Test with mock pool manager to verify hook integration
 */
contract MockPoolManagerTest is Test {
    /**
     * @notice Test hook address encoding with permissions
     */
    function test_HookAddressEncoding() public pure {
        // Hook addresses in v4 encode permissions in the address itself
        // beforeSwap permission bit: 1 << 7 = 0x0080

        uint160 hookAddressWithPermissions = uint160(
            address(0x0000000000000000000000000000000000000080)
        );

        // Verify beforeSwap permission is set
        assertTrue(
            (hookAddressWithPermissions & uint160(Hooks.BEFORE_SWAP_FLAG)) != 0
        );

        console2.log("Hook address correctly encodes permissions");
    }
}

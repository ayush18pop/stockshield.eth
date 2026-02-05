// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";

/**
 * @title DynamicFeeSetup
 * @notice Corrected implementation for StockShield LP protection
 */
contract DynamicFeeSetup {
    using PoolIdLibrary for PoolKey;

    IPoolManager public immutable poolManager;
    address public immutable stockShieldHook;

    constructor(IPoolManager _poolManager, address _stockShieldHook) {
        poolManager = _poolManager;
        stockShieldHook = _stockShieldHook;
    }

    /**
     * @notice Initialize pool with DYNAMIC_FEE_FLAG (0x800000)
     */
    function initializePoolWithDynamicFees(
        Currency currency0,
        Currency currency1,
        uint160 sqrtPriceX96
    ) external returns (PoolId poolId) {
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(stockShieldHook)
        });

        _validateHookAddress(key);

        // Initialize now takes only 2 args in latest v4-core
        poolManager.initialize(key, sqrtPriceX96);
        poolId = key.toId();
        return poolId;
    }

    /**
     * @dev StockShield requires beforeSwap (fees) and afterSwap (VPIN/Volatility)
     */
    function _validateHookAddress(PoolKey memory key) internal pure {
        uint160 permissions = uint160(address(key.hooks));

        // StockShield Logic: beforeSwap for the fee, afterSwap for updating VPIN state
        require(
            permissions & uint160(Hooks.BEFORE_SWAP_FLAG) != 0 &&
                permissions & uint160(Hooks.AFTER_SWAP_FLAG) != 0,
            "Hook missing required StockShield permissions"
        );
    }

    /**
     * @notice Fixed SwapParams reference - now uses PoolOperation.SwapParams
     */
    function swapWithDynamicFee(
        PoolKey memory key,
        SwapParams memory params
    ) external {
        // PoolManager calls unlock, which triggers the hook's dynamic fee calculation
        poolManager.unlock(abi.encode(key, params));
    }
}

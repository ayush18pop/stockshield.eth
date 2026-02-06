// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";

/**
 * @title CreatePoolOnly
 * @notice Simple script to just create a pool without adding liquidity
 * @dev Use this to test if pool creation works before trying to add liquidity
 * 
 * Usage:
 * forge script script/CreatePoolOnly.s.sol:CreatePoolOnly \
 *   --rpc-url sepolia --broadcast
 */
contract CreatePoolOnly is Script {
    using CurrencyLibrary for Currency;

    address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Load addresses
        address stockShieldHook = vm.envAddress("STOCK_SHIELD_HOOK");
        address token0 = vm.envAddress("TOKEN0");
        address token1 = vm.envAddress("TOKEN1");

        // Ensure token0 < token1
        if (uint160(token0) > uint160(token1)) {
            (token0, token1) = (token1, token0);
        }

        // USDC address for decimal detection
        address constant_USDC = 0xE7963ce0b7EFEAF47b64B06545304f10Ff24Fe70;

        console2.log("Creating pool:");
        console2.log("  Token0:", token0);
        console2.log("  Token1:", token1);
        console2.log("  Hook:", stockShieldHook);

        vm.startBroadcast(deployerPrivateKey);

        // Configure pool
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(stockShieldHook)
        });

        // Compute sqrtPriceX96 accounting for decimal difference.
        // USDC has 6 decimals, stock tokens have 18 decimals.
        // We want 1 stock token ≈ 1 USDC in human terms.
        // price = amount1_raw / amount0_raw
        // If USDC is token0: price = stock_raw / usdc_raw = 10^18 / 10^6 = 10^12
        //   sqrtPriceX96 = sqrt(10^12) * 2^96 = 10^6 * 2^96
        // If USDC is token1: price = usdc_raw / stock_raw = 10^6 / 10^18 = 10^-12
        //   sqrtPriceX96 = sqrt(10^-12) * 2^96 = 2^96 / 10^6
        uint160 sqrtPriceX96;
        if (token0 == constant_USDC) {
            // USDC is currency0, stock is currency1
            // price = 10^12, sqrt = 10^6, * 2^96
            sqrtPriceX96 = uint160(1e6 * (2**96));
        } else {
            // Stock is currency0, USDC is currency1
            // price = 10^-12, sqrt = 10^-6, * 2^96
            sqrtPriceX96 = uint160((2**96) / 1e6);
        }
        console2.log("  sqrtPriceX96:", uint256(sqrtPriceX96));

        console2.log("Initializing pool...");
        
        try IPoolManager(SEPOLIA_POOL_MANAGER).initialize(poolKey, sqrtPriceX96) {
            console2.log("Pool created successfully!");
        } catch Error(string memory reason) {
            console2.log("Pool creation failed:");
            console2.log(reason);
            revert(reason);
        } catch (bytes memory lowLevelData) {
            console2.log("Pool creation failed with low-level error");
            console2.logBytes(lowLevelData);
            revert("Pool initialization failed");
        }

        vm.stopBroadcast();
    }
}

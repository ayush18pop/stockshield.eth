// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {IPositionManager} from "v4-periphery/src/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {Actions} from "v4-periphery/src/libraries/Actions.sol";
import {IPoolInitializer_v4} from "v4-periphery/src/interfaces/IPoolInitializer_v4.sol";
import {LiquidityAmounts} from "v4-core/test/utils/LiquidityAmounts.sol";

/**
 * @title CreatePoolWithLiquidity
 * @notice Script to create a Uniswap v4 pool with initial liquidity for StockShield
 * @dev This handles the full flow: approvals, pool creation, and liquidity provision
 * 
 * Usage:
 * forge script script/CreatePoolWithLiquidity.s.sol:CreatePoolWithLiquidity \
 *   --rpc-url sepolia --broadcast --verify
 */
contract CreatePoolWithLiquidity is Script {
    using CurrencyLibrary for Currency;

    // Sepolia addresses
    address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant SEPOLIA_POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4; // Official Sepolia PositionManager
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // Your deployed hook address (update after deploying StockShieldHook)
    address stockShieldHook;

    // Token addresses (update with your mock tokens or real tokenized stocks)
    address token0; // USDC or similar
    address token1; // Tokenized stock

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load addresses from environment or use defaults
        stockShieldHook = vm.envOr("STOCK_SHIELD_HOOK", address(0));
        token0 = vm.envOr("TOKEN0", address(0));
        token1 = vm.envOr("TOKEN1", address(0));

        require(stockShieldHook != address(0), "Set STOCK_SHIELD_HOOK env var");
        require(token0 != address(0), "Set TOKEN0 env var");
        require(token1 != address(0), "Set TOKEN1 env var");

        // Ensure token0 < token1 (Uniswap requirement)
        if (uint160(token0) > uint160(token1)) {
            (token0, token1) = (token1, token0);
        }

        console2.log("Creating pool for:");
        console2.log("  Token0:", token0);
        console2.log("  Token1:", token1);
        console2.log("  Hook:", stockShieldHook);

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Approve tokens to Permit2
        _approvePermit2(token0);
        _approvePermit2(token1);

        // Step 2: Approve PositionManager via Permit2
        _approvePositionManager(token0);
        _approvePositionManager(token1);

        // Step 3: Create pool and add liquidity in one multicall
        _createPoolWithLiquidity();

        vm.stopBroadcast();

        console2.log("\n=== Pool created successfully ===");
    }

    function _approvePermit2(address token) internal {
        uint256 currentAllowance = IERC20(token).allowance(msg.sender, PERMIT2);
        if (currentAllowance < type(uint256).max / 2) {
            console2.log("Approving token to Permit2:", token);
            IERC20(token).approve(PERMIT2, type(uint256).max);
        }
    }

    function _approvePositionManager(address token) internal {
        // Check current Permit2 allowance for PositionManager
        (uint160 amount, , ) = IAllowanceTransfer(PERMIT2).allowance(
            msg.sender,
            token,
            SEPOLIA_POSITION_MANAGER
        );

        if (amount < type(uint160).max / 2) {
            console2.log("Approving PositionManager via Permit2 for:", token);
            IAllowanceTransfer(PERMIT2).approve(
                token,
                SEPOLIA_POSITION_MANAGER,
                type(uint160).max,
                type(uint48).max
            );
        }
    }

    function _createPoolWithLiquidity() internal {
        // Configure pool
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG, // 0x800000 - enables dynamic fees
            tickSpacing: 60, // Standard tick spacing for 0.3% pools
            hooks: IHooks(stockShieldHook)
        });

        // Starting price: account for decimal difference (USDC=6, stock=18)
        // If USDC is token0: price = stock_raw/usdc_raw = 10^12, sqrt = 10^6
        // If stock is token0: price = usdc_raw/stock_raw = 10^-12, sqrt = 10^-6
        uint160 sqrtPriceX96;
        if (token0 == 0xE7963ce0b7EFEAF47b64B06545304f10Ff24Fe70) {
            // USDC is currency0
            sqrtPriceX96 = uint160(1e6 * (2**96));
        } else {
            // Stock is currency0
            sqrtPriceX96 = uint160(uint256(2**96) / 1e6);
        }

        // Liquidity parameters
        int24 tickLower = -887220; // Min tick
        int24 tickUpper = 887220;   // Max tick
        
        // Amount of each token to provide (adjust based on your token decimals)
        uint256 amount0Desired = 1000 * 1e6;  // 1000 USDC (6 decimals)
        uint256 amount1Desired = 1000 * 1e18; // 1000 tokens (18 decimals)

        // Calculate liquidity from amounts
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            amount0Desired,
            amount1Desired
        );

        console2.log("Liquidity to add:", liquidity);

        // Prepare multicall params
        bytes[] memory params = new bytes[](2);

        // 1. Initialize pool - use IPoolInitializer_v4 selector
        params[0] = abi.encodeWithSelector(
            IPoolInitializer_v4.initializePool.selector,
            poolKey,
            sqrtPriceX96
        );

        // 2. Add liquidity
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR)
        );

        bytes[] memory mintParams = new bytes[](2);
        
        // MINT_POSITION parameters
        mintParams[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            liquidity,
            amount0Desired, // amount0Max
            amount1Desired, // amount1Max
            msg.sender,     // recipient
            new bytes(0)    // hookData
        );

        // SETTLE_PAIR parameters
        mintParams[1] = abi.encode(poolKey.currency0, poolKey.currency1);

        uint256 deadline = block.timestamp + 3600; // 1 hour from now

        params[1] = abi.encodeWithSelector(
            IPositionManager.modifyLiquidities.selector,
            abi.encode(actions, mintParams),
            deadline
        );

        // Execute multicall
        console2.log("Executing multicall to create pool and add liquidity...");
        IPositionManager(SEPOLIA_POSITION_MANAGER).multicall(params);
    }
}

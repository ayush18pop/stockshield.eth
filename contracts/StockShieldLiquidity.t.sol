// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {StockShieldHook} from "../src/StockShieldHook.sol";
import {RegimeOracle} from "../src/RegimeOracle.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Simple mock ERC20 for testing
contract MockToken is ERC20 {
    uint8 private _decimals;
    
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }
    
    function decimals() public view override returns (uint8) {
        return _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title TestStockShieldLiquidity
 * @notice Comprehensive test for StockShield pool creation and liquidity
 * @dev Run with: forge test --match-contract TestStockShieldLiquidity -vvvv
 */
contract TestStockShieldLiquidity is Test {
    using PoolIdLibrary for PoolKey;
    
    PoolManager manager;
    PoolModifyLiquidityTest modifyLiquidityRouter;
    PoolSwapTest swapRouter;
    
    StockShieldHook hook;
    RegimeOracle regimeOracle;
    
    MockToken token0;
    MockToken token1;
    
    PoolKey poolKey;
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    
    // Constants from v4-core
    uint160 public constant MIN_PRICE_LIMIT = 4295128739;
    uint160 public constant MAX_PRICE_LIMIT = 1461446703485210103287273052203988822378723970342;
    bytes constant ZERO_BYTES = new bytes(0);
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        // Deploy PoolManager
        manager = new PoolManager();
        
        // Deploy test routers
        modifyLiquidityRouter = new PoolModifyLiquidityTest(manager);
        swapRouter = new PoolSwapTest(manager);
        
        // Deploy tokens
        token0 = new MockToken("USDC", "USDC", 6);
        token1 = new MockToken("AAPL", "AAPL", 18);
        
        // Ensure token0 < token1
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }
        
        // Deploy regime oracle
        regimeOracle = new RegimeOracle(address(this));
        
        // Deploy hook - for testing we can use a simple address
        // In production, you'd use HookMiner to get the correct address
        address flags = address(
            uint160(
                Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
                Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG
            )
        );
        
        // Deploy hook at a computed address (simplified for testing)
        bytes memory creationCode = type(StockShieldHook).creationCode;
        bytes memory constructorArgs = abi.encode(manager, address(regimeOracle), address(this));
        bytes memory bytecode = abi.encodePacked(creationCode, constructorArgs);
        
        // For testing, we'll deploy at any address and skip flag validation
        hook = new StockShieldHook(manager, address(regimeOracle), address(this));
        
        // Create pool key
        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
        
        console2.log("Setup complete");
        console2.log("  Token0:", address(token0));
        console2.log("  Token1:", address(token1));
        console2.log("  Hook:", address(hook));
        console2.log("  Manager:", address(manager));
    }

    function testInitializePool() public {
        console2.log("\n=== Testing Pool Initialization ===");
        
        // 1:1 price
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        
        // Initialize pool
        manager.initialize(poolKey, sqrtPriceX96, ZERO_BYTES);
        
        console2.log("Pool initialized successfully!");
    }

    function testAddLiquidity() public {
        console2.log("\n=== Testing Add Liquidity ===");
        
        // Initialize pool first
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        manager.initialize(poolKey, sqrtPriceX96, ZERO_BYTES);
        
        // Mint tokens to alice
        token0.mint(alice, 1000e6);  // 1000 USDC
        token1.mint(alice, 1000e18); // 1000 AAPL
        
        vm.startPrank(alice);
        
        // Approve tokens
        token0.approve(address(modifyLiquidityRouter), type(uint256).max);
        token1.approve(address(modifyLiquidityRouter), type(uint256).max);
        
        // Add liquidity
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: 1000e18,
                salt: 0
            }),
            ZERO_BYTES
        );
        
        vm.stopPrank();
        
        console2.log("Liquidity added successfully!");
    }

    function testSwapWithDynamicFee() public {
        console2.log("\n=== Testing Swap with Dynamic Fee ===");
        
        // Setup: Initialize pool and add liquidity
        testAddLiquidity();
        
        // Mint tokens to bob
        token0.mint(bob, 100e6);
        
        vm.startPrank(bob);
        
        token0.approve(address(swapRouter), type(uint256).max);
        
        // Perform swap
        swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(10e6), // Exact input: 10 USDC
                sqrtPriceLimitX96: MIN_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({
                takeClaims: false,
                settleUsingBurn: false
            }),
            ZERO_BYTES
        );
        
        vm.stopPrank();
        
        console2.log("Swap executed successfully with dynamic fee!");
    }

    function testRemoveLiquidity() public {
        console2.log("\n=== Testing Remove Liquidity ===");
        
        // Setup
        testAddLiquidity();
        
        vm.startPrank(alice);
        
        // Remove liquidity
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: -500e18, // Remove half
                salt: 0
            }),
            ZERO_BYTES
        );
        
        vm.stopPrank();
        
        console2.log("Liquidity removed successfully!");
    }

    function testCircuitBreakerPreventsTrading() public {
        console2.log("\n=== Testing Circuit Breaker ===");
        
        // Setup
        testAddLiquidity();
        
        // Simulate high VPIN to trigger circuit breaker
        hook.updateVPIN(poolKey.toId(), 850000); // 85% VPIN
        
        // Try to swap - should revert
        vm.startPrank(bob);
        token0.mint(bob, 100e6);
        token0.approve(address(swapRouter), type(uint256).max);
        
        vm.expectRevert();
        swapRouter.swap(
            poolKey,
            IPoolManager.SwapParams({
                zeroForOne: true,
                amountSpecified: -int256(10e6),
                sqrtPriceLimitX96: MIN_PRICE_LIMIT
            }),
            PoolSwapTest.TestSettings({
                takeClaims: false,
                settleUsingBurn: false
            }),
            ZERO_BYTES
        );
        
        vm.stopPrank();
        
        console2.log("Circuit breaker working correctly!");
    }

    function testFullLifecycle() public {
        console2.log("\n=== Testing Full Lifecycle ===");
        
        // 1. Initialize
        console2.log("1. Initializing pool...");
        testInitializePool();
        
        // 2. Add liquidity
        console2.log("2. Adding liquidity...");
        testAddLiquidity();
        
        // 3. Perform swaps
        console2.log("3. Performing swaps...");
        testSwapWithDynamicFee();
        
        // 4. Remove liquidity
        console2.log("4. Removing liquidity...");
        testRemoveLiquidity();
        
        console2.log("\n=== Full lifecycle test passed! ===");
    }
}

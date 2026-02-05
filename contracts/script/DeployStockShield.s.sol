// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

import {StockShieldHook} from "../src/StockShieldHook.sol";
import {GapAuction} from "../src/GapAuction.sol";
import {MarginVault} from "../src/MarginVault.sol";
import {RegimeOracle} from "../src/RegimeOracle.sol";
import {DynamicFeeSetup} from "../src/DynamicFeeSetup.sol";

/**
 * @title DeployStockShield
 * @notice Deployment script for StockShield contracts on Sepolia
 * @dev Run with: forge script script/DeployStockShield.s.sol:DeployStockShield --rpc-url sepolia --broadcast --verify
 */
contract DeployStockShield is Script {
    // Sepolia V4 PoolManager address
    address constant SEPOLIA_POOL_MANAGER =
        0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    // CREATE2 deployer for hook address mining
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer address:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy RegimeOracle (governance = deployer for now)
        RegimeOracle regimeOracle = new RegimeOracle(deployer);
        console2.log("RegimeOracle deployed at:", address(regimeOracle));

        // 2. Deploy StockShieldHook with address mining for proper hook flags
        // Required flags for StockShield:
        // - beforeInitialize
        // - afterInitialize
        // - beforeAddLiquidity
        // - beforeRemoveLiquidity
        // - beforeSwap
        // - afterSwap

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
                Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG
        );

        // Mine for a valid hook address
        bytes memory creationCode = type(StockShieldHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            SEPOLIA_POOL_MANAGER,
            address(regimeOracle),
            deployer // price oracle placeholder
        );

        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            creationCode,
            constructorArgs
        );

        console2.log("Computed hook address:", hookAddress);
        console2.log("Salt:", uint256(salt));

        // Deploy using CREATE2
        StockShieldHook hook = new StockShieldHook{salt: salt}(
            IPoolManager(SEPOLIA_POOL_MANAGER),
            address(regimeOracle),
            deployer
        );

        require(address(hook) == hookAddress, "Hook address mismatch");
        console2.log("StockShieldHook deployed at:", address(hook));

        // 3. Deploy GapAuction
        // Using deployer as payment token placeholder (would use USDC/WETH in production)
        GapAuction gapAuction = new GapAuction(
            address(hook),
            deployer,
            deployer // placeholder payment token
        );
        console2.log("GapAuction deployed at:", address(gapAuction));

        // 4. Deploy MarginVault
        // Using deployer as collateral token placeholder
        MarginVault marginVault = new MarginVault(
            deployer, // placeholder collateral token
            address(hook),
            deployer // clearNode
        );
        console2.log("MarginVault deployed at:", address(marginVault));

        // 5. Deploy DynamicFeeSetup
        DynamicFeeSetup feeSetup = new DynamicFeeSetup(
            IPoolManager(SEPOLIA_POOL_MANAGER),
            address(hook)
        );
        console2.log("DynamicFeeSetup deployed at:", address(feeSetup));

        // 6. Configure hook with deployed contracts
        hook.setGapAuction(address(gapAuction));
        console2.log("Hook configured with GapAuction");

        vm.stopBroadcast();

        // Output summary
        console2.log("\n=== DEPLOYMENT SUMMARY ===");
        console2.log("Network: Sepolia");
        console2.log("PoolManager:", SEPOLIA_POOL_MANAGER);
        console2.log("RegimeOracle:", address(regimeOracle));
        console2.log("StockShieldHook:", address(hook));
        console2.log("GapAuction:", address(gapAuction));
        console2.log("MarginVault:", address(marginVault));
        console2.log("DynamicFeeSetup:", address(feeSetup));
    }
}

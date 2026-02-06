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
 * @dev Run with:
 *   PRIVATE_KEY=<key> forge script script/DeployStockShield.s.sol:DeployStockShield \
 *     --rpc-url <sepolia_rpc> --broadcast -vvvv
 *
 * Important: The HookMiner.find() deployer must match the address that
 * actually calls CREATE2. In `forge script --broadcast`, CREATE2 is executed
 * via the CREATE2 Deployer Proxy (0x4e59...), not the EOA. So we pass that
 * proxy address to HookMiner.find().
 */
contract DeployStockShield is Script {
    // ── Sepolia V4 Addresses ────────────────────────────────────────────────
    address constant SEPOLIA_POOL_MANAGER =
        0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Already-deployed contracts (from previous runs)
    address constant DEPLOYED_REGIME_ORACLE =
        0xCC46a9e6FFB834a7a1C126f9D4e803bF418CccA6;
    address constant DEPLOYED_MOCK_USDC =
        0xE7963ce0b7EFEAF47b64B06545304f10Ff24Fe70;
    address constant DEPLOYED_MARGIN_VAULT =
        0x04E3BDfa11Ae10034eEb2d1a30f42734c50A0c2C;

    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer address:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        // ── 1. Reuse existing RegimeOracle ──────────────────────────────────
        address regimeOracle = DEPLOYED_REGIME_ORACLE;
        console2.log("Using existing RegimeOracle:", regimeOracle);

        // ── 2. Mine hook address ────────────────────────────────────────────
        // Required hook flags for StockShield:
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
                Hooks.AFTER_INITIALIZE_FLAG |
                Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
                Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG |
                Hooks.BEFORE_SWAP_FLAG |
                Hooks.AFTER_SWAP_FLAG
        );

        bytes memory creationCode = type(StockShieldHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            SEPOLIA_POOL_MANAGER,
            regimeOracle,
            deployer // price oracle placeholder
        );

        // IMPORTANT: In forge script, CREATE2 is performed via the CREATE2
        // Deployer Proxy (0x4e59...), so we must mine against that address.
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            creationCode,
            constructorArgs
        );

        console2.log("Computed hook address:", hookAddress);
        console2.log("Salt:", uint256(salt));

        vm.startBroadcast(deployerPrivateKey);

        // ── 3. Deploy StockShieldHook via CREATE2 ───────────────────────────
        StockShieldHook hook = new StockShieldHook{salt: salt}(
            IPoolManager(SEPOLIA_POOL_MANAGER),
            regimeOracle,
            deployer
        );

        require(address(hook) == hookAddress, "Hook address mismatch - salt did not match");
        console2.log("StockShieldHook deployed at:", address(hook));

        // ── 4. Deploy GapAuction (payment token = Mock USDC) ────────────────
        GapAuction gapAuction = new GapAuction(
            address(hook),
            deployer,        // governance
            DEPLOYED_MOCK_USDC // payment token
        );
        console2.log("GapAuction deployed at:", address(gapAuction));

        // ── 5. Reuse existing MarginVault (already deployed on Sepolia) ──────
        address marginVault = DEPLOYED_MARGIN_VAULT;
        console2.log("Using existing MarginVault:", marginVault);

        // ── 6. Deploy DynamicFeeSetup ───────────────────────────────────────
        DynamicFeeSetup feeSetup = new DynamicFeeSetup(
            IPoolManager(SEPOLIA_POOL_MANAGER),
            address(hook)
        );
        console2.log("DynamicFeeSetup deployed at:", address(feeSetup));

        // ── 7. Wire contracts together ──────────────────────────────────────
        hook.setGapAuction(address(gapAuction));
        console2.log("Hook configured with GapAuction");
        hook.setYellowSigner(deployer);
        console2.log("Hook configured with Yellow signer:", deployer);

        vm.stopBroadcast();

        // ── Summary ─────────────────────────────────────────────────────────
        console2.log("\n========================================");
        console2.log("     DEPLOYMENT SUMMARY (Sepolia)");
        console2.log("========================================");
        console2.log("PoolManager:      ", SEPOLIA_POOL_MANAGER);
        console2.log("RegimeOracle:     ", regimeOracle);
        console2.log("StockShieldHook:  ", address(hook));
        console2.log("GapAuction:       ", address(gapAuction));
        console2.log("MarginVault:      ", marginVault);
        console2.log("DynamicFeeSetup:  ", address(feeSetup));
        console2.log("========================================");
        console2.log("");
        console2.log("Next steps:");
        console2.log("  1. Update frontend/src/lib/contracts.ts with new addresses");
        console2.log("  2. Run CreatePoolOnly.s.sol to create your first pool");
        console2.log("  3. Run MintTokens.s.sol to faucet test tokens");
    }
}

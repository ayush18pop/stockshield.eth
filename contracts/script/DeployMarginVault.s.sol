// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarginVault} from "../src/MarginVault.sol";

/**
 * @title DeployMarginVault
 * @notice Standalone deployment script for MarginVault on Sepolia
 * @dev Run with:
 *   PRIVATE_KEY=<key> forge script script/DeployMarginVault.s.sol:DeployMarginVault \
 *     --rpc-url sepolia --broadcast -vvvv
 *
 * Environment variables:
 *   PRIVATE_KEY           - Deployer private key
 *   STOCK_SHIELD_HOOK     - (optional) Hook address, defaults to existing deployment
 *   COLLATERAL_TOKEN      - (optional) Collateral token, defaults to Mock USDC
 */
contract DeployMarginVault is Script {
    // Already-deployed contracts from previous runs
    address constant DEPLOYED_MOCK_USDC =
        0xE7963ce0b7EFEAF47b64B06545304f10Ff24Fe70;
    address constant DEPLOYED_STOCK_SHIELD_HOOK =
        0x70FC6bDE4c265bd00b6fC75A8582f8cD90307Ac0;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer address:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        // Resolve addresses from env or fall back to defaults
        address collateralToken = _envOr("COLLATERAL_TOKEN", DEPLOYED_MOCK_USDC);
        address hook = _envOr("STOCK_SHIELD_HOOK", DEPLOYED_STOCK_SHIELD_HOOK);

        console2.log("Collateral token:", collateralToken);
        console2.log("Hook:", hook);
        console2.log("ClearNode (deployer):", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy MarginVault
        MarginVault vault = new MarginVault(
            collateralToken,    // collateral = Mock USDC
            hook,               // hook = StockShieldHook
            deployer            // clearNode = deployer for demo
        );

        console2.log("");
        console2.log("========================================");
        console2.log("     MARGIN VAULT DEPLOYED (Sepolia)");
        console2.log("========================================");
        console2.log("MarginVault:", address(vault));
        console2.log("Collateral:", collateralToken);
        console2.log("Hook:", hook);
        console2.log("ClearNode:", deployer);
        console2.log("========================================");
        console2.log("");
        console2.log("Next steps:");
        console2.log("  1. Add MARGIN_VAULT_ADDRESS=", address(vault), " to backend .env");
        console2.log("  2. Update frontend/src/lib/contracts.ts MARGIN_VAULT address");
        console2.log("  3. Call hook.setMarginVault(address) if the hook has that setter");

        vm.stopBroadcast();
    }

    /// @dev Read an address env var, returning `fallback_` if not set
    function _envOr(string memory key, address fallback_) internal view returns (address) {
        try vm.envAddress(key) returns (address val) {
            return val;
        } catch {
            return fallback_;
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RegimeOracle} from "../src/RegimeOracle.sol";

/**
 * @title DeployRegimeOracle
 * @notice Deploy only the RegimeOracle contract with fixed _timestampToDate
 * @dev Environment variables required:
 *      - PRIVATE_KEY: Deployer's private key (with Sepolia ETH)
 * 
 * Run: forge script script/DeployRegimeOracle.s.sol:DeployRegimeOracle \
 *        --rpc-url $SEPOLIA_RPC_URL --broadcast
 */
contract DeployRegimeOracle is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer address:", deployer);
        console2.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy RegimeOracle with governance = deployer
        RegimeOracle regimeOracle = new RegimeOracle(deployer);
        
        console2.log("");
        console2.log("=== DEPLOYMENT SUCCESSFUL ===");
        console2.log("RegimeOracle deployed at:", address(regimeOracle));
        console2.log("");
        
        // Test the current regime
        RegimeOracle.Regime currentRegime = regimeOracle.getCurrentRegime();
        console2.log("Current Regime:", uint(currentRegime));

        vm.stopBroadcast();
    }
}

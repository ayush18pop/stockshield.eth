// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockTokenizedStock} from "../src/mocks/MockTokenizedStock.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/**
 * @title DeployMockTokens
 * @notice Deploy mock tokenized stocks and USDC for testing
 */
contract DeployMockTokens is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock USDC
        MockUSDC usdc = new MockUSDC();
        console2.log("MockUSDC deployed at:", address(usdc));

        // Mint initial USDC supply to deployer
        usdc.mint(deployer, 1_000_000 * 1e6); // 1M USDC
        console2.log("Minted 1M USDC to deployer");

        // Deploy tokenized stocks

        // 1. Apple (tAAPL)
        MockTokenizedStock tAAPL = new MockTokenizedStock(
            "Tokenized Apple Inc",
            "tAAPL",
            "AAPL",
            "NASDAQ",
            18
        );
        tAAPL.mint(deployer, 10000 * 1e18); // 10,000 shares
        console2.log("tAAPL deployed at:", address(tAAPL));

        // 2. Tesla (tTSLA)
        MockTokenizedStock tTSLA = new MockTokenizedStock(
            "Tokenized Tesla Inc",
            "tTSLA",
            "TSLA",
            "NASDAQ",
            18
        );
        tTSLA.mint(deployer, 10000 * 1e18);
        console2.log("tTSLA deployed at:", address(tTSLA));

        // 3. NVIDIA (tNVDA)
        MockTokenizedStock tNVDA = new MockTokenizedStock(
            "Tokenized NVIDIA Corp",
            "tNVDA",
            "NVDA",
            "NASDAQ",
            18
        );
        tNVDA.mint(deployer, 10000 * 1e18);
        console2.log("tNVDA deployed at:", address(tNVDA));

        // 4. Google (tGOOGL)
        MockTokenizedStock tGOOGL = new MockTokenizedStock(
            "Tokenized Alphabet Inc",
            "tGOOGL",
            "GOOGL",
            "NASDAQ",
            18
        );
        tGOOGL.mint(deployer, 10000 * 1e18);
        console2.log("tGOOGL deployed at:", address(tGOOGL));

        // 5. Microsoft (tMSFT)
        MockTokenizedStock tMSFT = new MockTokenizedStock(
            "Tokenized Microsoft Corp",
            "tMSFT",
            "MSFT",
            "NASDAQ",
            18
        );
        tMSFT.mint(deployer, 10000 * 1e18);
        console2.log("tMSFT deployed at:", address(tMSFT));

        vm.stopBroadcast();

        // Summary
        console2.log("\n=== MOCK TOKENS DEPLOYED ===");
        console2.log("MockUSDC:", address(usdc));
        console2.log("tAAPL:", address(tAAPL));
        console2.log("tTSLA:", address(tTSLA));
        console2.log("tNVDA:", address(tNVDA));
        console2.log("tGOOGL:", address(tGOOGL));
        console2.log("tMSFT:", address(tMSFT));
    }
}

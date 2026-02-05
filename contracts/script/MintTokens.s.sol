// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

interface IMockUSDC {
    function faucet(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

interface IMockTokenizedStock {
    function faucet(uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title MintTokens
 * @notice Mint test tokens to your wallet
 * @dev Run: source .env && forge script script/MintTokens.s.sol:MintTokens --rpc-url $SEPOLIA_RPC_URL --broadcast
 */
contract MintTokens is Script {
    // Deployed token addresses on Sepolia (with faucet function)
    address constant USDC = 0xc9b62Ff3Ca454a31f7107EDc5CA013c713f5eA4B;
    address constant tAAPL = 0xA7c512e81963a4907AF5729EabC4Ddf321205Cde;
    address constant tTSLA = 0xb6Df0585Fa15bfa0c942D8C175532CDbc3104fb3;
    address constant tNVDA = 0x372712995Fc96F259dE6E1A6f74F06B10E6A6063;
    address constant tMSFT = 0x1C1C3974d35304396cDD93136bfAD06b13E65AB3;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("Wallet address:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // Mint USDC via faucet (anyone can call this)
        IMockUSDC usdc = IMockUSDC(USDC);
        usdc.faucet(10000 * 1e6); // 10,000 USDC
        console2.log("Minted 10,000 USDC via faucet");

        // Mint tTSLA via faucet (max 1000 per call)
        IMockTokenizedStock tsla = IMockTokenizedStock(tTSLA);
        tsla.faucet(100 * 1e18); // 100 tTSLA
        console2.log("Minted 100 tTSLA via faucet");

        // Mint tAAPL via faucet
        IMockTokenizedStock aapl = IMockTokenizedStock(tAAPL);
        aapl.faucet(100 * 1e18); // 100 tAAPL
        console2.log("Minted 100 tAAPL via faucet");

        vm.stopBroadcast();

        // Show balances
        console2.log("\n=== BALANCES ===");
        console2.log("USDC:", usdc.balanceOf(deployer) / 1e6);
        console2.log("tTSLA:", tsla.balanceOf(deployer) / 1e18);
        console2.log("tAAPL:", aapl.balanceOf(deployer) / 1e18);
    }
}

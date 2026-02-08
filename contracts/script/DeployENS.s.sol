// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {StockShieldResolver} from "../src/ens/StockShieldResolver.sol";
import {VaultRegistry} from "../src/ens/VaultRegistry.sol";
import {ReputationManager} from "../src/ens/ReputationManager.sol";
import {ProtocolRegistry} from "../src/ens/ProtocolRegistry.sol";
import {MockENS} from "../src/mocks/MockENS.sol";
import {IENS, IStockShieldResolver} from "../src/ens/VaultRegistry.sol";

/**
 * @title DeployENS
 * @notice Deploys the full StockShield ENS stack on Sepolia:
 *
 *   1. MockENS registry   — our own ENS registry (we don't own stockshield.eth
 *                            on the canonical Sepolia ENS)
 *   2. StockShieldResolver — custom resolver with CCIP-Read, reputation,
 *                            vault metadata, and protocol config storage
 *   3. Pool subdomains     — aapl/tsla/nvda/googl/msft.stockshield.eth
 *                            each with full text records
 *   4. VaultRegistry       — on-chain vault subdomain registration
 *   5. ReputationManager   — hook-driven trader reputation via ENS records
 *   6. ProtocolRegistry    — oracle + fee config stored as ENS records
 *
 * @dev Run:
 *   source .env && forge script script/DeployENS.s.sol:DeployENS \
 *     --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
 *     --broadcast -vvvv
 */
contract DeployENS is Script {
    // ── Already-deployed StockShield contracts ──────────────────────────────
    address constant STOCK_SHIELD_HOOK = 0x98B8158Bd631E9dDC14650284b38CcB1a16F3Ac0;
    address constant REGIME_ORACLE     = 0xCC46a9e6FFB834a7a1C126f9D4e803bF418CccA6;

    // ── Mock token addresses ────────────────────────────────────────────────
    address constant USDC   = 0xE7963ce0b7EFEAF47b64B06545304f10Ff24Fe70;
    address constant tAAPL  = 0x7D5A3d5C66a4422E3AFf7860e3bE709585068298;
    address constant tTSLA  = 0x9935de3B97C2154e5dF32C9D2FEcA276e9f30896;
    address constant tNVDA  = 0xC836831e6e72D9C98e46799C830C2Ac75daC2471;
    address constant tGOOGL = 0x21Fbe2d4f6c87315381176B14B99a36276DE971f;
    address constant tMSFT  = 0x4BefeAeBba1EefA79748146eCc9c2204613e3CbB;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        console2.log("=== StockShield ENS Deployment ===");
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);

        // =====================================================================
        // 1. Deploy MockENS Registry
        // =====================================================================
        MockENS ensRegistry = new MockENS(deployer);
        console2.log("MockENS Registry:", address(ensRegistry));

        // =====================================================================
        // 2. Deploy StockShieldResolver
        // =====================================================================
        string memory gatewayUrl =
            "https://stockshield.xyz/api/ens/resolve/{sender}/{data}.json";
        StockShieldResolver resolver = new StockShieldResolver(gatewayUrl);
        console2.log("StockShieldResolver:", address(resolver));

        // =====================================================================
        // 3. Register stockshield.eth in our MockENS
        //    namehash("eth")              = keccak(0x00 || keccak("eth"))
        //    namehash("stockshield.eth")   = keccak(ethNode || keccak("stockshield"))
        // =====================================================================
        ensRegistry.setSubnodeOwner(bytes32(0), keccak256("eth"), deployer);
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));

        ensRegistry.setSubnodeOwner(ethNode, keccak256("stockshield"), deployer);
        bytes32 ssNode = keccak256(abi.encodePacked(ethNode, keccak256("stockshield")));

        ensRegistry.setResolver(ssNode, address(resolver));

        // Root text records
        resolver.setAddr(ssNode, STOCK_SHIELD_HOOK);
        resolver.setText(ssNode, "description",
            "StockShield Protocol - Dynamic fee hook for tokenized stock trading on Uniswap v4");
        resolver.setText(ssNode, "url", "https://stockshield.xyz");
        console2.log("Registered stockshield.eth");

        // =====================================================================
        // 4. Register pool subdomains with text records
        // =====================================================================
        _registerPool(ensRegistry, resolver, ssNode, "aapl",  tAAPL,  "AAPL",  "Apple Inc.",      deployer);
        _registerPool(ensRegistry, resolver, ssNode, "tsla",  tTSLA,  "TSLA",  "Tesla Inc.",      deployer);
        _registerPool(ensRegistry, resolver, ssNode, "nvda",  tNVDA,  "NVDA",  "NVIDIA Corp.",    deployer);
        _registerPool(ensRegistry, resolver, ssNode, "googl", tGOOGL, "GOOGL", "Alphabet Inc.",   deployer);
        _registerPool(ensRegistry, resolver, ssNode, "msft",  tMSFT,  "MSFT",  "Microsoft Corp.", deployer);

        // =====================================================================
        // 5. Register vaults.stockshield.eth + deploy VaultRegistry
        // =====================================================================
        ensRegistry.setSubnodeOwner(ssNode, keccak256("vaults"), deployer);
        bytes32 vaultsNode = keccak256(abi.encodePacked(ssNode, keccak256("vaults")));
        ensRegistry.setResolver(vaultsNode, address(resolver));

        VaultRegistry vaultRegistry = new VaultRegistry(
            IENS(address(ensRegistry)),
            IStockShieldResolver(address(resolver)),
            vaultsNode
        );
        console2.log("VaultRegistry:", address(vaultRegistry));

        // Hand vaults subdomain to VaultRegistry
        ensRegistry.setSubnodeOwner(ssNode, keccak256("vaults"), address(vaultRegistry));

        // =====================================================================
        // 6. Deploy ReputationManager
        // =====================================================================
        ReputationManager reputationManager = new ReputationManager(address(resolver));
        reputationManager.setHookAddress(STOCK_SHIELD_HOOK);
        console2.log("ReputationManager:", address(reputationManager));

        // =====================================================================
        // 7. Deploy ProtocolRegistry
        // =====================================================================
        ProtocolRegistry protocolRegistry = new ProtocolRegistry(address(resolver));
        console2.log("ProtocolRegistry:", address(protocolRegistry));

        // Keep resolver ownership with deployer for demo flexibility
        console2.log("Resolver ownership: deployer (for demo)");

        vm.stopBroadcast();

        // =====================================================================
        // Summary
        // =====================================================================
        console2.log("");
        console2.log("=== DEPLOYMENT SUMMARY ===");
        console2.log("MockENS Registry:    ", address(ensRegistry));
        console2.log("StockShieldResolver: ", address(resolver));
        console2.log("VaultRegistry:       ", address(vaultRegistry));
        console2.log("ReputationManager:   ", address(reputationManager));
        console2.log("ProtocolRegistry:    ", address(protocolRegistry));
        console2.log("");
        console2.log("Pool subdomains registered:");
        console2.log("  aapl.stockshield.eth  tsla.stockshield.eth");
        console2.log("  nvda.stockshield.eth  googl.stockshield.eth");
        console2.log("  msft.stockshield.eth  vaults.stockshield.eth");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal: register one pool subdomain with full text records
    // ─────────────────────────────────────────────────────────────────────────
    function _registerPool(
        MockENS ensRegistry,
        StockShieldResolver resolver,
        bytes32 parentNode,
        string memory label,
        address tokenAddr,
        string memory ticker,
        string memory companyName,
        address deployer
    ) internal {
        bytes32 labelHash = keccak256(bytes(label));

        ensRegistry.setSubnodeOwner(parentNode, labelHash, deployer);
        bytes32 node = keccak256(abi.encodePacked(parentNode, labelHash));
        ensRegistry.setResolver(node, address(resolver));

        // Address record -> hook contract
        resolver.setAddr(node, STOCK_SHIELD_HOOK);

        // Text records matching frontend ENS_TEXT_KEYS (useENS.ts)
        resolver.setText(node, "pool.hook",     vm.toString(STOCK_SHIELD_HOOK));
        resolver.setText(node, "pool.token",    vm.toString(tokenAddr));
        resolver.setText(node, "pool.quote",    vm.toString(USDC));
        resolver.setText(node, "pool.chainId",  "11155111");
        resolver.setText(node, "pool.ticker",   ticker);
        resolver.setText(node, "pool.exchange", "NYSE");
        resolver.setText(node, "pool.regime",   "dynamic");
        resolver.setText(node, "pool.baseFee",  "5");
        resolver.setText(node, "description",   string.concat(
            "StockShield ", companyName, " (", ticker, "/USDC) pool - dynamic fees on Uniswap v4"
        ));
        resolver.setText(node, "url", string.concat("https://stockshield.xyz/pools/", label));

        console2.log(string.concat("  ", label, ".stockshield.eth -> ", ticker));
    }
}

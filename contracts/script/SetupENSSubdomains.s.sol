// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

/**
 * @title SetupENSSubdomains
 * @notice Sets up pool subdomains under stockshield.eth on Sepolia ENS
 *   - aapl.stockshield.eth, tsla.stockshield.eth, etc.
 *   - Sets text records for each pool (pool.hook, pool.token, etc.)
 *   - Uses the real Sepolia ENS registry + public resolver
 *
 * @dev Prerequisites:
 *   1. stockshield.eth must be registered on Sepolia ENS
 *   2. Deployer must own stockshield.eth
 *
 * @dev Run:
 *   source .env && forge script script/SetupENSSubdomains.s.sol:SetupENSSubdomains \
 *     --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
 *     --broadcast --slow -vvv
 */

// Minimal ENS interfaces
interface IENS {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns (bytes32);
    function setResolver(bytes32 node, address resolver) external;
    function owner(bytes32 node) external view returns (address);
    function resolver(bytes32 node) external view returns (address);
}

interface IPublicResolver {
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function setAddr(bytes32 node, address a) external;
}

contract SetupENSSubdomains is Script {
    // ── Sepolia ENS addresses ───────────────────────────────────────────────
    address constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address constant PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;

    // ── Already-deployed StockShield contracts ──────────────────────────────
    address constant STOCK_SHIELD_HOOK = 0x98B8158Bd631E9dDC14650284b38CcB1a16F3Ac0;

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

        console2.log("=== StockShield ENS Subdomain Setup ===");
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance);

        IENS ens = IENS(ENS_REGISTRY);
        IPublicResolver resolver = IPublicResolver(PUBLIC_RESOLVER);

        // Compute stockshield.eth namehash
        // namehash("eth") = keccak256(bytes32(0) || keccak256("eth"))
        // namehash("stockshield.eth") = keccak256(namehash("eth") || keccak256("stockshield"))
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));
        bytes32 stockshieldNode = keccak256(abi.encodePacked(ethNode, keccak256("stockshield")));

        console2.log("stockshield.eth node:", vm.toString(stockshieldNode));

        // Verify ownership
        address owner = ens.owner(stockshieldNode);
        console2.log("Current owner of stockshield.eth:", owner);
        require(owner == deployer, "Deployer does not own stockshield.eth");

        vm.startBroadcast(deployerPrivateKey);

        // Set public resolver for stockshield.eth if not already set
        address currentResolver = ens.resolver(stockshieldNode);
        if (currentResolver != PUBLIC_RESOLVER) {
            console2.log("Setting public resolver for stockshield.eth");
            ens.setResolver(stockshieldNode, PUBLIC_RESOLVER);
        }

        // Set root text records
        resolver.setAddr(stockshieldNode, STOCK_SHIELD_HOOK);
        resolver.setText(stockshieldNode, "description",
            "StockShield Protocol - Dynamic fee hook for tokenized stock trading on Uniswap v4");
        resolver.setText(stockshieldNode, "url", "https://stockshield.xyz");
        console2.log("Set stockshield.eth root records");

        // Register pool subdomains
        _registerPool(ens, resolver, stockshieldNode, "aapl",  tAAPL,  "AAPL",  "Apple Inc.",      deployer);
        _registerPool(ens, resolver, stockshieldNode, "tsla",  tTSLA,  "TSLA",  "Tesla Inc.",      deployer);
        _registerPool(ens, resolver, stockshieldNode, "nvda",  tNVDA,  "NVDA",  "NVIDIA Corp.",    deployer);
        _registerPool(ens, resolver, stockshieldNode, "googl", tGOOGL, "GOOGL", "Alphabet Inc.",   deployer);
        _registerPool(ens, resolver, stockshieldNode, "msft",  tMSFT,  "MSFT",  "Microsoft Corp.", deployer);

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== SETUP COMPLETE ===");
        console2.log("Pool subdomains registered:");
        console2.log("  aapl.stockshield.eth");
        console2.log("  tsla.stockshield.eth");
        console2.log("  nvda.stockshield.eth");
        console2.log("  googl.stockshield.eth");
        console2.log("  msft.stockshield.eth");
        console2.log("");
        console2.log("Verify on ENS app: https://app.ens.domains");
    }

    /// @dev Register one pool subdomain with text records
    function _registerPool(
        IENS ens,
        IPublicResolver resolver,
        bytes32 parentNode,
        string memory label,
        address tokenAddr,
        string memory ticker,
        string memory companyName,
        address deployer
    ) internal {
        bytes32 labelHash = keccak256(bytes(label));

        // Create subdomain owned by deployer
        bytes32 node = ens.setSubnodeOwner(parentNode, labelHash, deployer);

        // Set public resolver
        ens.setResolver(node, address(resolver));

        // Set address record -> points to hook
        resolver.setAddr(node, STOCK_SHIELD_HOOK);

        // Set text records matching frontend ENS_TEXT_KEYS
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

        console2.log(string.concat("  Registered ", label, ".stockshield.eth"));
    }
}

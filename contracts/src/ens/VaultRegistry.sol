// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IENS {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns (bytes32);
    function owner(bytes32 node) external view returns (address);
    function setResolver(bytes32 node, address resolver) external;
    function setTTL(bytes32 node, uint64 ttl) external;
}

interface IStockShieldResolver {
    function setAddr(bytes32 node, address a) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

contract VaultRegistry is Ownable {
    IENS public ens;
    IStockShieldResolver public resolver;
    bytes32 public rootNode; // e.g. namehash("vaults.stockshield.eth")

    event VaultRegistered(bytes32 indexed node, string label, address vaultAddress);

    constructor(IENS _ens, IStockShieldResolver _resolver, bytes32 _rootNode) Ownable(msg.sender) {
        ens = _ens;
        resolver = _resolver;
        rootNode = _rootNode;
    }

    function registerVault(string calldata label, address vaultAddress) external onlyOwner {
        bytes32 labelHash = keccak256(bytes(label));
        bytes32 node = keccak256(abi.encodePacked(rootNode, labelHash));

        // Create subdomain: label.vaults.stockshield.eth
        // We assume this contract owns 'rootNode' in ENS.
        ens.setSubnodeOwner(rootNode, labelHash, address(this));

        // Set resolver
        ens.setResolver(node, address(resolver));
        
        // Set address record in resolver
        resolver.setAddr(node, vaultAddress);
        
        // Transfer ownership to vault owner? Or keep it?
        // Let's keep it owned by the registry for now, or transfer to vault creator.
        // For simplicity, keep it owned by registry so we can update it.
        
        emit VaultRegistered(node, label, vaultAddress);
    }

    function updateVaultAddress(string calldata label, address newAddress) external onlyOwner {
        bytes32 labelHash = keccak256(bytes(label));
        bytes32 node = keccak256(abi.encodePacked(rootNode, labelHash));
        resolver.setAddr(node, newAddress);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}

interface IResolver {
    function addr(bytes32 node) external view returns (address);
    function text(bytes32 node, string calldata key) external view returns (string memory);
    function contenthash(bytes32 node) external view returns (bytes memory);
}

error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData);

contract StockShieldResolver is Ownable, IExtendedResolver, IResolver {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    string public gatewayUrl;

    mapping(bytes32 => address) private _addresses;
    mapping(bytes32 => mapping(string => string)) private _texts;
    mapping(bytes32 => bytes) private _contenthashes;
    
    // Custom StockShield Data
    mapping(bytes32 => uint256) public reputationScores;
    
    struct VaultMetadata {
        address owner;
        uint256 channelId;
        uint256 createdAt;
        uint256 totalVolume;
        uint256 totalFees;
        bool active;
    }
    mapping(bytes32 => VaultMetadata) public vaultMetadata;
    mapping(string => bytes) public protocolConfigs;

    event AddressChanged(bytes32 indexed node, address newAddress);
    event TextChanged(bytes32 indexed node, string indexed key, string value);
    event ContenthashChanged(bytes32 indexed node, bytes hash);
    event ReputationUpdated(bytes32 indexed node, uint256 newScore);
    event VaultMetadataUpdated(bytes32 indexed node, address owner);

    constructor(string memory _gatewayUrl) Ownable(msg.sender) {
        gatewayUrl = _gatewayUrl;
    }

    function setGatewayUrl(string calldata _gatewayUrl) external onlyOwner {
        gatewayUrl = _gatewayUrl;
    }

    // Unrestricted setter for demo purposes; normally access controlled
    function setAddr(bytes32 node, address a) external {
        _addresses[node] = a;
        emit AddressChanged(node, a);
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        _texts[node][key] = value;
        emit TextChanged(node, key, value);
    }

    function setContenthash(bytes32 node, bytes calldata hash) external {
        _contenthashes[node] = hash;
        emit ContenthashChanged(node, hash);
    }

    function setReputationScore(bytes32 node, uint256 score) external {
        reputationScores[node] = score;
        emit ReputationUpdated(node, score);
    }

    function setVaultMetadata(bytes32 node, VaultMetadata calldata metadata) external {
        vaultMetadata[node] = metadata;
        emit VaultMetadataUpdated(node, metadata.owner);
    }

    function setProtocolConfig(string calldata key, bytes calldata config) external onlyOwner {
        protocolConfigs[key] = config;
    }

    // IResolver implementation
    function addr(bytes32 node) external view returns (address) {
        return _addresses[node];
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _texts[node][key];
    }

    function contenthash(bytes32 node) external view returns (bytes memory) {
        return _contenthashes[node];
    }

    // Custom getters
    function getReputationScore(bytes32 node) external view returns (uint256) {
        return reputationScores[node];
    }

    function getVaultMetadata(bytes32 node) external view returns (VaultMetadata memory) {
        return vaultMetadata[node];
    }

    function getProtocolConfig(string calldata key) external view returns (bytes memory) {
        return protocolConfigs[key];
    }

    // CCIP-Read Implementation
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        // If we have local data (e.g. addr), we could return it. 
        // But for CCIP-read demo, we can force offchain lookup if data is missing.
        // Simplified: always revert with OffchainLookup if not a simple view we handle?
        // Actually, we should check if we can handle it.
        // For simplicity, we just use local storage for now as CCIP gateway isn't fully set up in this step.
        // But the plan says "revert OffchainLookup".
        
        // If we implement full EIP-3668, we decod 'data' to see function selector.
        bytes4 selector = bytes4(data[:4]);
        
        // If it's addr(bytes32), check if we have it.
        if (selector == IResolver.addr.selector) {
            (bytes32 node) = abi.decode(data[4:], (bytes32));
            if (_addresses[node] != address(0)) {
                return abi.encode(_addresses[node]);
            }
        }
        
        // Fallback to OffchainLookup
        string[] memory urls = new string[](1);
        urls[0] = gatewayUrl;
        
        revert OffchainLookup(
            address(this),
            urls,
            data,
            this.resolveCallback.selector,
            data
        );
    }

    function resolveCallback(bytes calldata response, bytes calldata extraData) external view returns (bytes memory) {
        // In a real implementation, verify signature of 'response' against a signer.
        // Here we just decode and return.
        // response is abi.encoded result.
        return response;
    }
    
    // EIP-165
    function supportsInterface(bytes4 interfaceID) external pure returns (bool) {
        return interfaceID == type(IExtendedResolver).interfaceId || interfaceID == type(IResolver).interfaceId;
    }
}

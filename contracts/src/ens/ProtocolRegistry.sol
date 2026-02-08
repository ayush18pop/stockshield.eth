// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IStockShieldResolver {
    function setProtocolConfig(string calldata key, bytes calldata config) external;
}

contract ProtocolRegistry is Ownable {
    IStockShieldResolver public resolver;

    struct OracleConfig {
        address chainlink;
        address pyth;
        address twap;
        uint256 staleness_threshold;
    }

    struct FeeConfig {
        uint256 alpha;
        uint256 beta;
        uint256 gamma;
        uint256 delta;
    }

    constructor(address _resolver) Ownable(msg.sender) {
        resolver = IStockShieldResolver(_resolver);
    }

    function setOracleConfig(OracleConfig calldata config) external onlyOwner {
        bytes memory data = abi.encode(config);
        resolver.setProtocolConfig("oracle", data);
    }

    function setFeeConfig(FeeConfig calldata config) external onlyOwner {
        bytes memory data = abi.encode(config);
        resolver.setProtocolConfig("fee", data);
    }
}

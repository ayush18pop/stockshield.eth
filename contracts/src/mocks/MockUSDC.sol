// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC stablecoin for testing
 */
contract MockUSDC is ERC20 {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() ERC20("Mock USD Coin", "USDC") {
        owner = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDC uses 6 decimals
    }

    /**
     * @notice Mint USDC (for testing)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Anyone can mint themselves some test USDC
     */
    function faucet(uint256 amount) external {
        require(amount <= 10000 * 1e6, "Max 10k USDC per faucet");
        _mint(msg.sender, amount);
    }
}

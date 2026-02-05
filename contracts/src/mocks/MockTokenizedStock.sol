// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockTokenizedStock
 * @notice Mock ERC20 representing a tokenized stock for testing
 * @dev Each token represents 1 share of the underlying stock
 */
contract MockTokenizedStock is ERC20 {
    uint8 private _decimals;
    address public owner;

    // Stock metadata
    string public stockSymbol;
    string public stockExchange;

    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @param name_ Token name (e.g., "Tokenized Apple Inc")
     * @param symbol_ Token symbol (e.g., "tAAPL")
     * @param stockSymbol_ Underlying stock symbol (e.g., "AAPL")
     * @param stockExchange_ Stock exchange (e.g., "NYSE", "NASDAQ")
     * @param decimals_ Token decimals (typically 18)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory stockSymbol_,
        string memory stockExchange_,
        uint8 decimals_
    ) ERC20(name_, symbol_) {
        owner = msg.sender;
        stockSymbol = stockSymbol_;
        stockExchange = stockExchange_;
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens (simulates stock deposit)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /**
     * @notice Burn tokens (simulates stock withdrawal)
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
        emit Burned(from, amount);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IStockShieldResolver {
    function setReputationScore(bytes32 node, uint256 score) external;
    function getReputationScore(bytes32 node) external view returns (uint256);
}

contract ReputationManager is Ownable {
    IStockShieldResolver public resolver;
    address public hookAddress;

    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant BASE_SCORE = 500;
    uint256 public constant TOXIC_PENALTY = 50; // -5% (50/1000)
    uint256 public constant BENIGN_REWARD = 10; // +1% (10/1000)

    event ReputationUpdated(address indexed trader, uint256 newScore, bool isToxic);

    constructor(address _resolver) Ownable(msg.sender) {
        resolver = IStockShieldResolver(_resolver);
    }

    function setHookAddress(address _hook) external onlyOwner {
        hookAddress = _hook;
    }

    modifier onlyHook() {
        require(msg.sender == hookAddress, "Only hook can update reputation");
        _;
    }

    function updateReputation(address trader, bool isToxic) external onlyHook {
        bytes32 node = keccak256(abi.encodePacked(trader)); // Simplified mapping: trader address -> node hash directly?
        // Usually node = namehash("alice.traders.stockshield.eth")
        // But hook only knows address.
        // We need a way to map address to node.
        // For simplicity in this HackMoney hack, we'll hash the address itself as the node key for reputation storage
        // strictly for internal lookup, even if it doesn't match an ENS namehash perfectly.
        // OR we store mapping(address => bytes32 node) here.
        
        // Let's assume we use address hash for now.
        
        uint256 currentScore = resolver.getReputationScore(node);
        if (currentScore == 0) {
            currentScore = BASE_SCORE;
        }

        uint256 newScore;
        if (isToxic) {
            if (currentScore > TOXIC_PENALTY) {
                newScore = currentScore - TOXIC_PENALTY;
            } else {
                newScore = 0;
            }
        } else {
            newScore = currentScore + BENIGN_REWARD;
            if (newScore > MAX_SCORE) {
                newScore = MAX_SCORE;
            }
        }

        resolver.setReputationScore(node, newScore);
        emit ReputationUpdated(trader, newScore, isToxic);
    }

    function getReputationScore(address trader) external view returns (uint256) {
        bytes32 node = keccak256(abi.encodePacked(trader));
        return resolver.getReputationScore(node);
    }
}

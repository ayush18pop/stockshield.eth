// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

interface IUniversalRouter {
    function execute(bytes calldata commands, bytes[] calldata inputs) external payable;
}

interface IPositionManager {
    function burn(uint256 tokenId) external;
}

contract RemoveLiquidity is Script {
    // Sepolia Deployed Addresses
    address constant UNIVERSAL_ROUTER = 0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b;
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        IUniversalRouter router = IUniversalRouter(UNIVERSAL_ROUTER);
        IPositionManager posManager = IPositionManager(POSITION_MANAGER);

        // Position IDs with liquidity amounts from your pools
        uint256[] memory positionIds = new uint256[](4);
        uint128[] memory liquidities = new uint128[](4);
        
        positionIds[0] = 23043;
        liquidities[0] = 4500000000;
        
        positionIds[1] = 23040;
        liquidities[1] = 350000000;
        
        positionIds[2] = 23038;
        liquidities[2] = 100000000;
        
        positionIds[3] = 23037;
        liquidities[3] = 170153;

        // Remove liquidity from all positions
        for (uint256 i = 0; i < positionIds.length; i++) {
            console.log("Removing liquidity for position:", i);
            
            // Encode DECREASE_LIQUIDITY parameters
            bytes memory decreaseLiquidityInput = abi.encode(
                positionIds[i],
                liquidities[i],
                uint256(0),
                uint256(0)
            );
            
            // Encode COLLECT parameters
            bytes memory collectInput = abi.encode(
                positionIds[i],
                user,
                uint128(type(uint128).max),
                uint128(type(uint128).max)
            );
            
            bytes[] memory inputs = new bytes[](2);
            inputs[0] = decreaseLiquidityInput;
            inputs[1] = collectInput;
            
            bytes memory commands = hex"0204"; // DECREASE_LIQUIDITY + COLLECT
            
            try router.execute(commands, inputs) {
                console.log("Successfully removed liquidity for position:", i);
                
                // Burn the position NFT
                try posManager.burn(positionIds[i]) {
                    console.log("Burned position:", i);
                } catch Error(string memory reason) {
                    console.log("Failed to burn position", i, ":", reason);
                }
            } catch Error(string memory reason) {
                console.log("Failed to remove liquidity for position", i, ":", reason);
            }
        }

        vm.stopBroadcast();
    }
}

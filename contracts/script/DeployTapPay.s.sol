// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TapPay} from "../src/TapPay.sol";

/// @notice Deploys TapPay to the chain behind --rpc-url.
/// @dev Reads DEPLOYER_PK from the environment so the key is never passed on
///      the command line. Run with:
///      forge script script/DeployTapPay.s.sol --rpc-url base_sepolia --broadcast
contract DeployTapPay is Script {
    function run() external returns (TapPay tapPay) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");

        vm.startBroadcast(deployerKey);
        tapPay = new TapPay();
        vm.stopBroadcast();

        console.log("TapPay deployed at:", address(tapPay));
        console.log("chainId:", block.chainid);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TapSwapPay} from "../src/TapSwapPay.sol";

/// @notice Deploys the Base Sepolia Uniswap adapter for the existing TapPay contract.
contract DeployTapSwapPay is Script {
    address internal constant TAP_PAY = 0x4c679b2dE8AE517fF12AA34A1bE0F81913678792;
    address internal constant SWAP_ROUTER_02 = 0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4;
    address internal constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external returns (TapSwapPay adapter) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PK");

        vm.startBroadcast(deployerKey);
        adapter = new TapSwapPay(TAP_PAY, SWAP_ROUTER_02, PERMIT2, WETH, USDC);
        vm.stopBroadcast();

        console.log("TapSwapPay deployed at:", address(adapter));
        console.log("chainId:", block.chainid);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITapSwapRouter} from "../../src/interfaces/ITapSwapRouter.sol";
import {MockERC20Permit} from "./MockERC20Permit.sol";

contract MockSwapRouter is ITapSwapRouter {
    using SafeERC20 for IERC20;

    address public immutable WETH;
    uint256 public amountIn;
    mapping(address caller => uint256 amount) public nativeRefund;

    constructor(address weth) {
        WETH = weth;
    }

    function setAmountIn(uint256 nextAmountIn) external {
        amountIn = nextAmountIn;
    }

    function exactOutput(ExactOutputParams calldata params) external payable returns (uint256) {
        require(amountIn <= params.amountInMaximum, "too much input");
        address tokenOut = _pathAddress(params.path, 0);
        address tokenIn = _pathAddress(params.path, params.path.length - 20);

        if (msg.value == 0) {
            IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        } else {
            require(tokenIn == WETH && msg.value == params.amountInMaximum, "bad native input");
            nativeRefund[msg.sender] = msg.value - amountIn;
        }

        MockERC20Permit(tokenOut).mint(params.recipient, params.amountOut);
        return amountIn;
    }

    function refundETH() external payable {
        uint256 refund = nativeRefund[msg.sender];
        nativeRefund[msg.sender] = 0;
        (bool sent,) = msg.sender.call{value: refund}("");
        require(sent, "refund failed");
    }

    function _pathAddress(bytes calldata path, uint256 offset) private pure returns (address value) {
        assembly ("memory-safe") {
            value := shr(96, calldataload(add(path.offset, offset)))
        }
    }
}

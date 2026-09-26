// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPermit2} from "../../src/interfaces/IPermit2.sol";

contract MockPermit2 is IPermit2 {
    using SafeERC20 for IERC20;

    mapping(address owner => mapping(address token => mapping(address spender => uint160 amount))) public allowance;
    bool public rejectPermits;

    function setRejectPermits(bool reject) external {
        rejectPermits = reject;
    }

    function permit(address owner, PermitSingle calldata permitSingle, bytes calldata) external {
        if (rejectPermits) revert("permit rejected");
        allowance[owner][permitSingle.details.token][permitSingle.spender] = permitSingle.details.amount;
    }

    function transferFrom(address from, address to, uint160 amount, address token) external {
        uint160 approved = allowance[from][token][msg.sender];
        require(approved >= amount, "permit allowance");
        allowance[from][token][msg.sender] = approved - amount;
        IERC20(token).safeTransferFrom(from, to, amount);
    }
}

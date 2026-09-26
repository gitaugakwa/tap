// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TapPay} from "./TapPay.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {ITapSwapRouter} from "./interfaces/ITapSwapRouter.sol";

contract TapSwapPay is ReentrancyGuard {
    using SafeERC20 for IERC20;

    event SwapPaid(
        address indexed merchant,
        bytes32 indexed nonce,
        address indexed payer,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );

    error InvalidConfiguration();
    error InvalidSettlementToken();
    error InvalidMaximumInput();
    error InvalidRoute();
    error InvalidPermit();
    error PermitExpiryOverflow();
    error ExcessiveInput();
    error RefundFailed();

    TapPay public immutable TAP_PAY;
    ITapSwapRouter public immutable ROUTER;
    IPermit2 public immutable PERMIT2;
    address public immutable WETH;
    address public immutable SETTLEMENT_TOKEN;

    constructor(address tapPay, address router, address permit2, address weth, address settlementToken) {
        if (
            tapPay == address(0) || router == address(0) || permit2 == address(0) || weth == address(0)
                || settlementToken == address(0) || weth == settlementToken
        ) revert InvalidConfiguration();

        TAP_PAY = TapPay(tapPay);
        ROUTER = ITapSwapRouter(router);
        PERMIT2 = IPermit2(permit2);
        WETH = weth;
        SETTLEMENT_TOKEN = settlementToken;
    }

    function payWithNative(
        TapPay.PaymentRequest calldata req,
        bytes calldata requestSignature,
        uint256 amountInMaximum,
        bytes calldata path
    ) external payable nonReentrant returns (uint256 amountIn) {
        if (amountInMaximum == 0 || msg.value != amountInMaximum) revert InvalidMaximumInput();
        _validateRequestAndPath(req, WETH, path);

        amountIn = _swap(path, req.amount, amountInMaximum, amountInMaximum);
        ROUTER.refundETH();
        _settle(req, requestSignature);

        uint256 refund = amountInMaximum - amountIn;
        if (refund != 0) {
            (bool sent,) = msg.sender.call{value: refund}("");
            if (!sent) revert RefundFailed();
        }

        _emitSwapPaid(req, WETH, amountIn);
    }

    function payWithToken(
        TapPay.PaymentRequest calldata req,
        bytes calldata requestSignature,
        address tokenIn,
        uint256 amountInMaximum,
        bytes calldata path,
        IPermit2.PermitSingle calldata permitSingle,
        bytes calldata permitSignature
    ) external nonReentrant returns (uint256 amountIn) {
        if (amountInMaximum == 0 || amountInMaximum > type(uint160).max) {
            revert InvalidMaximumInput();
        }
        if (req.expiry > type(uint48).max) revert PermitExpiryOverflow();
        if (
            permitSingle.details.token != tokenIn || permitSingle.details.amount != amountInMaximum
                || permitSingle.details.expiration != uint48(req.expiry) || permitSingle.spender != address(this)
                || permitSingle.sigDeadline != req.expiry
        ) revert InvalidPermit();
        _validateRequestAndPath(req, tokenIn, path);

        try PERMIT2.permit(msg.sender, permitSingle, permitSignature) {} catch {}
        PERMIT2.transferFrom(msg.sender, address(this), uint160(amountInMaximum), tokenIn);

        IERC20 input = IERC20(tokenIn);
        input.forceApprove(address(ROUTER), amountInMaximum);
        amountIn = _swap(path, req.amount, amountInMaximum, 0);
        input.forceApprove(address(ROUTER), 0);

        _settle(req, requestSignature);
        uint256 refund = amountInMaximum - amountIn;
        if (refund != 0) input.safeTransfer(msg.sender, refund);

        _emitSwapPaid(req, tokenIn, amountIn);
    }

    function _swap(bytes calldata path, uint256 amountOut, uint256 amountInMaximum, uint256 value)
        private
        returns (uint256 amountIn)
    {
        amountIn = ROUTER.exactOutput{value: value}(
            ITapSwapRouter.ExactOutputParams({
                path: path, recipient: address(this), amountOut: amountOut, amountInMaximum: amountInMaximum
            })
        );
        if (amountIn > amountInMaximum) revert ExcessiveInput();
    }

    function _settle(TapPay.PaymentRequest calldata req, bytes calldata requestSignature) private {
        IERC20 settlement = IERC20(req.token);
        settlement.forceApprove(address(TAP_PAY), req.amount);
        TAP_PAY.pay(req, requestSignature);
        settlement.forceApprove(address(TAP_PAY), 0);
    }

    function _emitSwapPaid(TapPay.PaymentRequest calldata req, address tokenIn, uint256 amountIn) private {
        emit SwapPaid(req.merchant, req.nonce, msg.sender, tokenIn, amountIn, req.token, req.amount);
    }

    function _validateRequestAndPath(TapPay.PaymentRequest calldata req, address tokenIn, bytes calldata path)
        private
        view
    {
        if (req.token != SETTLEMENT_TOKEN) revert InvalidSettlementToken();
        if (tokenIn == address(0) || tokenIn == SETTLEMENT_TOKEN) revert InvalidRoute();
        if (path.length < 43 || (path.length - 20) % 23 != 0) revert InvalidRoute();
        if (_pathAddress(path, 0) != SETTLEMENT_TOKEN) revert InvalidRoute();
        if (_pathAddress(path, path.length - 20) != tokenIn) revert InvalidRoute();
    }

    function _pathAddress(bytes calldata path, uint256 offset) private pure returns (address value) {
        assembly ("memory-safe") {
            value := shr(96, calldataload(add(path.offset, offset)))
        }
    }

    receive() external payable {}
}

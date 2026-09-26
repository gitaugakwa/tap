// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TapPay is EIP712 {
    using SafeERC20 for IERC20;

    struct PaymentRequest {
        address merchant;
        address token;
        uint256 amount;
        bytes32 nonce;
        uint64 expiry;
        string merchantName;
    }

    event Paid(address indexed merchant, bytes32 indexed nonce, address indexed payer, address token, uint256 amount);

    error Expired();
    error ZeroAmount();
    error NonceUsed();
    error BadSignature();

    bytes32 public constant PAYMENT_REQUEST_TYPEHASH = keccak256(
        "PaymentRequest(address merchant,address token,uint256 amount,bytes32 nonce,uint64 expiry,string merchantName)"
    );

    mapping(address merchant => mapping(bytes32 nonce => bool)) private _used;

    constructor() EIP712("TapPay", "1") {}

    function hashRequest(PaymentRequest calldata req) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PAYMENT_REQUEST_TYPEHASH,
                    req.merchant,
                    req.token,
                    req.amount,
                    req.nonce,
                    req.expiry,
                    keccak256(bytes(req.merchantName))
                )
            )
        );
    }

    function isPaid(address merchant, bytes32 nonce) external view returns (bool) {
        return _used[merchant][nonce];
    }

    function payWithPermit(
        PaymentRequest calldata req,
        bytes calldata sig,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        try IERC20Permit(req.token).permit(msg.sender, address(this), req.amount, deadline, v, r, s) {} catch {}
        _settle(req, sig);
    }

    function pay(PaymentRequest calldata req, bytes calldata sig) external {
        _settle(req, sig);
    }

    function _settle(PaymentRequest calldata req, bytes calldata sig) internal {
        if (block.timestamp >= req.expiry) revert Expired();
        if (req.amount == 0) revert ZeroAmount();
        if (_used[req.merchant][req.nonce]) revert NonceUsed();
        if (!SignatureChecker.isValidSignatureNow(req.merchant, hashRequest(req), sig)) revert BadSignature();

        _used[req.merchant][req.nonce] = true;
        IERC20(req.token).safeTransferFrom(msg.sender, req.merchant, req.amount);
        emit Paid(req.merchant, req.nonce, msg.sender, req.token, req.amount);
    }
}

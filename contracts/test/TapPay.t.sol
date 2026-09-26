// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {Test} from "forge-std/Test.sol";
import {TapPay} from "../src/TapPay.sol";
import {MockERC1271Wallet} from "./mocks/MockERC1271Wallet.sol";
import {MockERC20Permit} from "./mocks/MockERC20Permit.sol";

contract TapPayTest is Test {
    event Paid(address indexed merchant, bytes32 indexed nonce, address indexed payer, address token, uint256 amount);

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    uint256 private constant AMOUNT = 5_000_000;
    uint256 private constant MERCHANT_PK = 0xA11CE;
    uint256 private constant PAYER_PK = 0xB0B;
    uint256 private constant WRONG_PK = 0xBAD;

    TapPay private tapPay;
    MockERC20Permit private token;
    TapPay.PaymentRequest private request;
    address private merchant;
    address private payer;

    function setUp() public {
        tapPay = new TapPay();
        token = new MockERC20Permit();
        merchant = vm.addr(MERCHANT_PK);
        payer = vm.addr(PAYER_PK);
        request = TapPay.PaymentRequest({
            merchant: merchant,
            token: address(token),
            amount: AMOUNT,
            nonce: keccak256("charge-1"),
            expiry: uint64(block.timestamp + 120),
            merchantName: "yoyogi-market.tap.eth"
        });
        token.mint(payer, 100_000_000);
    }

    function test_PayWithPermit_HappyPath() public {
        bytes memory requestSignature = _signRequest(request, MERCHANT_PK);
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(AMOUNT, request.expiry, PAYER_PK);
        uint256 payerBalance = token.balanceOf(payer);

        vm.expectEmit(true, true, true, true, address(tapPay));
        emit Paid(merchant, request.nonce, payer, address(token), AMOUNT);
        vm.prank(payer);
        tapPay.payWithPermit(request, requestSignature, request.expiry, v, r, s);

        assertEq(token.balanceOf(merchant), AMOUNT);
        assertEq(token.balanceOf(payer), payerBalance - AMOUNT);
        assertTrue(tapPay.isPaid(merchant, request.nonce));
        assertEq(token.allowance(payer, address(tapPay)), 0);
    }

    function test_Pay_HappyPath() public {
        bytes memory requestSignature = _signRequest(request, MERCHANT_PK);
        uint256 payerBalance = token.balanceOf(payer);

        vm.prank(payer);
        token.approve(address(tapPay), AMOUNT);
        vm.expectEmit(true, true, true, true, address(tapPay));
        emit Paid(merchant, request.nonce, payer, address(token), AMOUNT);
        vm.prank(payer);
        tapPay.pay(request, requestSignature);

        assertEq(token.balanceOf(merchant), AMOUNT);
        assertEq(token.balanceOf(payer), payerBalance - AMOUNT);
        assertTrue(tapPay.isPaid(merchant, request.nonce));
        assertEq(token.allowance(payer, address(tapPay)), 0);
    }

    function test_RevertWhen_Replay() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        _approveAndPay(request, signature);

        vm.expectRevert(TapPay.NonceUsed.selector);
        vm.prank(payer);
        tapPay.pay(request, signature);
    }

    function test_RevertWhen_Expired() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        vm.warp(request.expiry);

        vm.expectRevert(TapPay.Expired.selector);
        vm.prank(payer);
        tapPay.pay(request, signature);
    }

    function test_RevertWhen_ZeroAmount() public {
        request.amount = 0;
        bytes memory signature = _signRequest(request, MERCHANT_PK);

        vm.expectRevert(TapPay.ZeroAmount.selector);
        vm.prank(payer);
        tapPay.pay(request, signature);
    }

    function test_RevertWhen_WrongSigner() public {
        _expectBadSignature(request, _signRequest(request, WRONG_PK));
    }

    function test_RevertWhen_TamperedAmount() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        request.amount += 1;
        _expectBadSignature(request, signature);
    }

    function test_RevertWhen_TamperedToken() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        request.token = address(new MockERC20Permit());
        _expectBadSignature(request, signature);
    }

    function test_RevertWhen_TamperedName() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        request.merchantName = "tampered.tap.eth";
        _expectBadSignature(request, signature);
    }

    function test_RevertWhen_TamperedNonce() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        request.nonce = keccak256("tampered");
        _expectBadSignature(request, signature);
    }

    function test_RevertWhen_TamperedExpiry() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        request.expiry += 1;
        _expectBadSignature(request, signature);
    }

    function test_RevertWhen_TamperedMerchant() public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);
        request.merchant = vm.addr(WRONG_PK);
        _expectBadSignature(request, signature);
    }

    function test_RevertWhen_WrongChain() public {
        bytes32 digest = _hashRequestForChain(request, block.chainid + 1);
        _expectBadSignature(request, _signDigest(digest, MERCHANT_PK));
    }

    function test_PermitFrontRun_StillSettles() public {
        bytes memory requestSignature = _signRequest(request, MERCHANT_PK);
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(AMOUNT, request.expiry, PAYER_PK);

        vm.prank(payer);
        token.permit(payer, address(tapPay), AMOUNT, request.expiry, v, r, s);
        vm.prank(payer);
        tapPay.payWithPermit(request, requestSignature, request.expiry, v, r, s);

        assertEq(token.balanceOf(merchant), AMOUNT);
        assertTrue(tapPay.isPaid(merchant, request.nonce));
        assertEq(token.allowance(payer, address(tapPay)), 0);
    }

    function test_RevertWhen_NoAllowance() public {
        bytes memory requestSignature = _signRequest(request, MERCHANT_PK);
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(AMOUNT, request.expiry, WRONG_PK);

        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector, address(tapPay), uint256(0), AMOUNT
            )
        );
        vm.prank(payer);
        tapPay.payWithPermit(request, requestSignature, request.expiry, v, r, s);
    }

    function test_SmartWalletMerchant_ERC1271() public {
        MockERC1271Wallet wallet = new MockERC1271Wallet(merchant);
        request.merchant = address(wallet);
        bytes memory signature = _signRequest(request, MERCHANT_PK);

        _approveAndPay(request, signature);

        assertEq(token.balanceOf(address(wallet)), AMOUNT);
        assertTrue(tapPay.isPaid(address(wallet), request.nonce));
    }

    function test_HashParity_FixedVector() public {
        string memory json = vm.readFile("test/fixtures/hash-vector.json");
        uint256 chainId = vm.parseJsonUint(json, ".chainId");
        address verifyingContract = vm.parseJsonAddress(json, ".verifyingContract");
        TapPay.PaymentRequest memory vectorRequest = TapPay.PaymentRequest({
            merchant: vm.parseJsonAddress(json, ".request.merchant"),
            token: vm.parseJsonAddress(json, ".request.token"),
            amount: vm.parseUint(vm.parseJsonString(json, ".request.amount")),
            nonce: vm.parseJsonBytes32(json, ".request.nonce"),
            expiry: uint64(vm.parseUint(vm.parseJsonString(json, ".request.expiry"))),
            merchantName: vm.parseJsonString(json, ".request.merchantName")
        });

        vm.chainId(chainId);
        deployCodeTo("TapPay.sol", verifyingContract);

        assertEq(TapPay(verifyingContract).hashRequest(vectorRequest), vm.parseJsonBytes32(json, ".digest"));
    }

    function testFuzz_TamperAnyField(uint8 field, bytes32 mutation) public {
        bytes memory signature = _signRequest(request, MERCHANT_PK);

        if (field % 6 == 0) {
            address changed = address(uint160(uint256(mutation)));
            request.merchant = changed == request.merchant ? address(uint160(uint256(mutation)) ^ 1) : changed;
        } else if (field % 6 == 1) {
            address changed = address(uint160(uint256(mutation)));
            request.token = changed == request.token ? address(uint160(uint256(mutation)) ^ 1) : changed;
        } else if (field % 6 == 2) {
            uint256 changed = uint256(mutation);
            if (changed == 0 || changed == request.amount) changed = request.amount + 1;
            request.amount = changed;
        } else if (field % 6 == 3) {
            request.nonce = mutation == request.nonce ? bytes32(uint256(mutation) ^ 1) : mutation;
        } else if (field % 6 == 4) {
            uint64 changed = uint64(bound(uint256(mutation), block.timestamp + 1, type(uint64).max));
            request.expiry = changed == request.expiry ? request.expiry + 1 : changed;
        } else {
            request.merchantName = string(abi.encodePacked(mutation));
        }

        _expectBadSignature(request, signature);
    }

    function _approveAndPay(TapPay.PaymentRequest memory req, bytes memory signature) private {
        vm.prank(payer);
        token.approve(address(tapPay), req.amount);
        vm.prank(payer);
        tapPay.pay(req, signature);
    }

    function _expectBadSignature(TapPay.PaymentRequest memory req, bytes memory signature) private {
        vm.expectRevert(TapPay.BadSignature.selector);
        vm.prank(payer);
        tapPay.pay(req, signature);
    }

    function _signRequest(TapPay.PaymentRequest memory req, uint256 privateKey) private view returns (bytes memory) {
        return _signDigest(tapPay.hashRequest(req), privateKey);
    }

    function _signPermit(uint256 value, uint256 deadline, uint256 privateKey)
        private
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash =
            keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(tapPay), value, token.nonces(payer), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(privateKey, digest);
    }

    function _signDigest(bytes32 digest, uint256 privateKey) private pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _hashRequestForChain(TapPay.PaymentRequest memory req, uint256 chainId) private view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, keccak256("TapPay"), keccak256("1"), chainId, address(tapPay))
        );
        bytes32 structHash = keccak256(
            abi.encode(
                tapPay.PAYMENT_REQUEST_TYPEHASH(),
                req.merchant,
                req.token,
                req.amount,
                req.nonce,
                req.expiry,
                keccak256(bytes(req.merchantName))
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
}

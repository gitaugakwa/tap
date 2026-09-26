// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {TapPay} from "../src/TapPay.sol";
import {TapSwapPay} from "../src/TapSwapPay.sol";
import {IPermit2} from "../src/interfaces/IPermit2.sol";
import {MockERC20Permit} from "./mocks/MockERC20Permit.sol";
import {MockPermit2} from "./mocks/MockPermit2.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";

contract TapSwapPayTest is Test {
    event SwapPaid(
        address indexed merchant,
        bytes32 indexed nonce,
        address indexed payer,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut
    );

    uint256 private constant AMOUNT_OUT = 5_000_000;
    uint256 private constant AMOUNT_IN = 7_000_000;
    uint256 private constant MAX_INPUT = 8_000_000;
    uint256 private constant MERCHANT_PK = 0xA11CE;
    uint256 private constant PAYER_PK = 0xB0B;

    TapPay private tapPay;
    TapSwapPay private swapPay;
    MockERC20Permit private usdc;
    MockERC20Permit private input;
    MockERC20Permit private weth;
    MockPermit2 private permit2;
    MockSwapRouter private router;
    TapPay.PaymentRequest private request;
    address private merchant;
    address private payer;

    function setUp() public {
        tapPay = new TapPay();
        usdc = new MockERC20Permit();
        input = new MockERC20Permit();
        weth = new MockERC20Permit();
        permit2 = new MockPermit2();
        router = new MockSwapRouter(address(weth));
        swapPay = new TapSwapPay(address(tapPay), address(router), address(permit2), address(weth), address(usdc));

        merchant = vm.addr(MERCHANT_PK);
        payer = vm.addr(PAYER_PK);
        request = TapPay.PaymentRequest({
            merchant: merchant,
            token: address(usdc),
            amount: AMOUNT_OUT,
            nonce: keccak256("swap-charge-1"),
            expiry: uint64(block.timestamp + 120),
            merchantName: "yoyogi-market.tap.eth"
        });

        input.mint(payer, 100_000_000);
        vm.prank(payer);
        input.approve(address(permit2), type(uint256).max);
        router.setAmountIn(AMOUNT_IN);
        vm.deal(payer, 10 ether);
    }

    function test_PayWithToken_ExactSettlementAndRefund() public {
        bytes memory signature = _signRequest(request);
        bytes memory path = _path(address(input));
        IPermit2.PermitSingle memory permitSingle = _permit(address(input), MAX_INPUT);
        uint256 payerBefore = input.balanceOf(payer);

        vm.expectEmit(true, true, true, true, address(swapPay));
        emit SwapPaid(merchant, request.nonce, payer, address(input), AMOUNT_IN, address(usdc), AMOUNT_OUT);
        vm.prank(payer);
        uint256 spent =
            swapPay.payWithToken(request, signature, address(input), MAX_INPUT, path, permitSingle, hex"1234");

        assertEq(spent, AMOUNT_IN);
        assertEq(input.balanceOf(payer), payerBefore - AMOUNT_IN);
        assertEq(input.balanceOf(address(swapPay)), 0);
        assertEq(usdc.balanceOf(merchant), AMOUNT_OUT);
        assertEq(usdc.balanceOf(address(swapPay)), 0);
        assertTrue(tapPay.isPaid(merchant, request.nonce));
    }

    function test_PayWithNative_ExactSettlementAndRefund() public {
        uint256 nativeIn = 0.004 ether;
        uint256 nativeMax = 0.005 ether;
        router.setAmountIn(nativeIn);
        uint256 payerBefore = payer.balance;
        bytes memory signature = _signRequest(request);

        vm.expectEmit(true, true, true, true, address(swapPay));
        emit SwapPaid(merchant, request.nonce, payer, address(weth), nativeIn, address(usdc), AMOUNT_OUT);
        vm.prank(payer);
        uint256 spent = swapPay.payWithNative{value: nativeMax}(request, signature, nativeMax, _path(address(weth)));

        assertEq(spent, nativeIn);
        assertEq(payer.balance, payerBefore - nativeIn);
        assertEq(address(swapPay).balance, 0);
        assertEq(usdc.balanceOf(merchant), AMOUNT_OUT);
        assertTrue(tapPay.isPaid(merchant, request.nonce));
    }

    function test_PayWithToken_PermitFrontRunStillSettles() public {
        IPermit2.PermitSingle memory permitSingle = _permit(address(input), MAX_INPUT);
        bytes memory signature = _signRequest(request);
        permit2.permit(payer, permitSingle, hex"1234");
        permit2.setRejectPermits(true);

        vm.prank(payer);
        swapPay.payWithToken(
            request, signature, address(input), MAX_INPUT, _path(address(input)), permitSingle, hex"1234"
        );

        assertEq(usdc.balanceOf(merchant), AMOUNT_OUT);
    }

    function test_RevertWhen_RouteBoundariesAreWrong() public {
        IPermit2.PermitSingle memory permitSingle = _permit(address(input), MAX_INPUT);
        bytes memory wrongOutput = abi.encodePacked(address(weth), uint24(3000), address(input));
        bytes memory wrongInput = abi.encodePacked(address(usdc), uint24(3000), address(weth));
        bytes memory signature = _signRequest(request);

        vm.expectRevert(TapSwapPay.InvalidRoute.selector);
        vm.prank(payer);
        swapPay.payWithToken(request, signature, address(input), MAX_INPUT, wrongOutput, permitSingle, hex"1234");

        vm.expectRevert(TapSwapPay.InvalidRoute.selector);
        vm.prank(payer);
        swapPay.payWithToken(request, signature, address(input), MAX_INPUT, wrongInput, permitSingle, hex"1234");
    }

    function test_RevertWhen_PermitDoesNotMatchPayment() public {
        IPermit2.PermitSingle memory permitSingle = _permit(address(input), MAX_INPUT);
        permitSingle.spender = address(0xBAD);
        bytes memory signature = _signRequest(request);

        vm.expectRevert(TapSwapPay.InvalidPermit.selector);
        vm.prank(payer);
        swapPay.payWithToken(
            request, signature, address(input), MAX_INPUT, _path(address(input)), permitSingle, hex"1234"
        );
    }

    function test_RevertWhen_RequestSettlementTokenChanges() public {
        request.token = address(input);
        bytes memory signature = _signRequest(request);

        vm.expectRevert(TapSwapPay.InvalidSettlementToken.selector);
        vm.prank(payer);
        swapPay.payWithNative{value: MAX_INPUT}(request, signature, MAX_INPUT, _path(address(weth)));
    }

    function test_RevertWhen_SlippageExceedsMaximum() public {
        router.setAmountIn(MAX_INPUT + 1);
        uint256 payerBefore = input.balanceOf(payer);
        bytes memory signature = _signRequest(request);

        vm.expectRevert(bytes("too much input"));
        vm.prank(payer);
        swapPay.payWithToken(
            request,
            signature,
            address(input),
            MAX_INPUT,
            _path(address(input)),
            _permit(address(input), MAX_INPUT),
            hex"1234"
        );

        assertEq(input.balanceOf(payer), payerBefore);
        assertEq(usdc.balanceOf(merchant), 0);
        assertFalse(tapPay.isPaid(merchant, request.nonce));
    }

    function test_RevertWhen_ReplayedAndRollBackSwap() public {
        bytes memory signature = _signRequest(request);
        IPermit2.PermitSingle memory permitSingle = _permit(address(input), MAX_INPUT);
        vm.prank(payer);
        swapPay.payWithToken(
            request, signature, address(input), MAX_INPUT, _path(address(input)), permitSingle, hex"1234"
        );
        uint256 payerAfterFirst = input.balanceOf(payer);
        uint256 merchantAfterFirst = usdc.balanceOf(merchant);

        vm.expectRevert(TapPay.NonceUsed.selector);
        vm.prank(payer);
        swapPay.payWithToken(
            request, signature, address(input), MAX_INPUT, _path(address(input)), permitSingle, hex"1234"
        );

        assertEq(input.balanceOf(payer), payerAfterFirst);
        assertEq(usdc.balanceOf(merchant), merchantAfterFirst);
    }

    function test_RevertWhen_RequestExpiresAndRollBackSwap() public {
        vm.warp(request.expiry);
        uint256 payerBefore = input.balanceOf(payer);
        bytes memory signature = _signRequest(request);

        vm.expectRevert(TapPay.Expired.selector);
        vm.prank(payer);
        swapPay.payWithToken(
            request,
            signature,
            address(input),
            MAX_INPUT,
            _path(address(input)),
            _permit(address(input), MAX_INPUT),
            hex"1234"
        );

        assertEq(input.balanceOf(payer), payerBefore);
        assertEq(usdc.balanceOf(merchant), 0);
    }

    function test_RevertWhen_NativeValueDoesNotMatchMaximum() public {
        bytes memory signature = _signRequest(request);

        vm.expectRevert(TapSwapPay.InvalidMaximumInput.selector);
        vm.prank(payer);
        swapPay.payWithNative{value: MAX_INPUT - 1}(request, signature, MAX_INPUT, _path(address(weth)));
    }

    function test_RevertWhen_PermitExpiryCannotRepresentRequestExpiry() public {
        request.expiry = uint64(type(uint48).max) + 1;
        IPermit2.PermitSingle memory permitSingle = _permit(address(input), MAX_INPUT);
        bytes memory signature = _signRequest(request);

        vm.expectRevert(TapSwapPay.PermitExpiryOverflow.selector);
        vm.prank(payer);
        swapPay.payWithToken(
            request, signature, address(input), MAX_INPUT, _path(address(input)), permitSingle, hex"1234"
        );
    }

    function test_RevertWhen_PathIsMalformed() public {
        bytes memory signature = _signRequest(request);

        vm.expectRevert(TapSwapPay.InvalidRoute.selector);
        vm.prank(payer);
        swapPay.payWithNative{value: MAX_INPUT}(request, signature, MAX_INPUT, hex"1234");
    }

    function _permit(address token, uint256 amount) private view returns (IPermit2.PermitSingle memory) {
        return IPermit2.PermitSingle({
            details: IPermit2.PermitDetails({
                token: token, amount: uint160(amount), expiration: uint48(request.expiry), nonce: 0
            }),
            spender: address(swapPay),
            sigDeadline: request.expiry
        });
    }

    function _path(address tokenIn) private view returns (bytes memory) {
        return abi.encodePacked(address(usdc), uint24(3000), tokenIn);
    }

    function _signRequest(TapPay.PaymentRequest memory req) private view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(MERCHANT_PK, tapPay.hashRequest(req));
        return abi.encodePacked(r, s, v);
    }
}

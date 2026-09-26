// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPermissionedRegistry} from
    "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";
import {Test} from "forge-std/Test.sol";

import {ITapResolver} from "../src/interfaces/ITapResolver.sol";
import {TapMerchantRegistrar} from "../src/TapMerchantRegistrar.sol";
import {MockPermissionedRegistry} from "./mocks/MockPermissionedRegistry.sol";
import {MockTapResolver} from "./mocks/MockTapResolver.sol";

contract TapMerchantRegistrarTest is Test {
    /// @dev namehash("tap.eth"), computed with viem and cross-checked against its
    ///      own namehash() helper.
    bytes32 internal constant PARENT_NODE =
        0x2761d081665f4bf315f9cd14c4cc1396e527b6d04d11590b8c5eb8514da4fd92;
    /// @dev namehash("yoyogi-market.tap.eth"), same source.
    bytes32 internal constant YOYOGI_NODE =
        0x8f11487adbad09ee53757ab9520f7cb6488091c0d72af10bb165908472f1fb91;

    string internal constant LABEL = "yoyogi-market";
    string internal constant DISPLAY_NAME = "Takoyaki Stand";

    event MerchantRegistered(
        uint256 indexed tokenId, string label, address indexed owner, string displayName
    );

    MockPermissionedRegistry internal registry;
    MockTapResolver internal resolver;
    TapMerchantRegistrar internal registrar;

    address internal merchant = makeAddr("merchant");

    function setUp() public {
        registry = new MockPermissionedRegistry();
        resolver = new MockTapResolver();
        registrar = new TapMerchantRegistrar(
            IPermissionedRegistry(address(registry)), ITapResolver(address(resolver)), PARENT_NODE
        );
    }

    function test_Register_HappyPath() public {
        uint256 expectedTokenId = registry.expectedTokenId(0);

        vm.expectEmit(true, true, true, true);
        emit MerchantRegistered(expectedTokenId, LABEL, merchant, DISPLAY_NAME);
        uint256 tokenId = registrar.register(LABEL, merchant, DISPLAY_NAME);

        assertEq(tokenId, expectedTokenId, "returns the registry's token id");

        (
            string memory label,
            address owner,
            IRegistry subregistry,
            address resolverArg,
            uint256 roleBitmap,
            uint64 expiry
        ) = registry.lastRegister();
        assertEq(label, LABEL, "label");
        assertEq(owner, merchant, "owner");
        assertEq(address(subregistry), address(0), "no subregistry for a leaf name");
        assertEq(resolverArg, address(resolver), "our resolver");
        assertEq(roleBitmap, RegistryRolesLib.ROLE_SET_RESOLVER, "least privilege (D19)");
        assertEq(expiry, type(uint64).max, "never expires (D18)");

        assertEq(resolver.setAddrCount(), 1, "one address record written");
        assertEq(resolver.lastAddrNode(), YOYOGI_NODE, "address written against the child node");
        assertEq(resolver.lastCoinType(), 60, "ETH coin type");
        assertEq(resolver.lastAddressBytes(), abi.encodePacked(merchant), "owner's address");

        assertEq(resolver.setTextCount(), 1, "one text record written");
        assertEq(resolver.lastTextNode(), YOYOGI_NODE, "text written against the child node");
        assertEq(resolver.lastTextKey(), "name", "display-name key (D17)");
        assertEq(resolver.lastTextValue(), DISPLAY_NAME, "display name");
    }

    /// @dev Replaces docs/03's test_DnsEncoding: records are keyed by namehash, not by
    ///      a DNS-encoded name (D27). Pins the EIP-137 child-namehash computation
    ///      against a vector produced independently by viem.
    function test_Namehash() public view {
        assertEq(registrar.nodeOf(LABEL), YOYOGI_NODE, "child namehash matches viem");
        assertEq(registrar.PARENT_NODE(), PARENT_NODE, "parent node stored as given");
        assertEq(
            registrar.nodeOf(LABEL),
            keccak256(abi.encodePacked(PARENT_NODE, keccak256(bytes(LABEL)))),
            "node is keccak256(parentNode ++ labelhash)"
        );
    }

    function test_RevertWhen_Taken() public {
        registrar.register(LABEL, merchant, DISPLAY_NAME);

        vm.expectRevert(abi.encodeWithSelector(TapMerchantRegistrar.NameNotAvailable.selector, LABEL));
        registrar.register(LABEL, merchant, DISPLAY_NAME);
    }

    function test_RevertWhen_InvalidLabel() public {
        string[8] memory invalid = [
            "", // empty
            "ab", // too short
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", // 33 chars
            "Yoyogi", // uppercase
            "a.b", // dot
            "-abc", // leading hyphen
            "abc-", // trailing hyphen
            unicode"ábc" // non-ASCII (4 UTF-8 bytes, so it clears the length check)
        ];

        for (uint256 i; i < invalid.length; ++i) {
            assertFalse(registrar.isValidLabel(invalid[i]), "should be rejected");
            vm.expectRevert(
                abi.encodeWithSelector(TapMerchantRegistrar.InvalidLabel.selector, invalid[i])
            );
            registrar.register(invalid[i], merchant, DISPLAY_NAME);
        }
    }

    function test_ValidLabelBoundaries() public view {
        assertTrue(registrar.isValidLabel("abc"), "3 chars is the minimum");
        assertTrue(
            registrar.isValidLabel("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"), "32 chars is the maximum"
        );
        assertTrue(registrar.isValidLabel("a-b"), "inner hyphen allowed");
        assertTrue(registrar.isValidLabel("a0z"), "digits allowed");
    }

    function test_RevertWhen_ZeroOwner() public {
        vm.expectRevert(TapMerchantRegistrar.InvalidOwner.selector);
        registrar.register(LABEL, address(0), DISPLAY_NAME);
    }

    function test_RevertWhen_BadDisplayName() public {
        vm.expectRevert(TapMerchantRegistrar.InvalidDisplayName.selector);
        registrar.register(LABEL, merchant, "");

        string memory tooLong = new string(65);
        vm.expectRevert(TapMerchantRegistrar.InvalidDisplayName.selector);
        registrar.register(LABEL, merchant, tooLong);
    }

    function test_DisplayNameBoundary() public {
        string memory maxLength = new string(64);
        registrar.register(LABEL, merchant, maxLength);
        assertEq(resolver.setTextCount(), 1, "64 bytes is accepted");
    }

    function test_IsAvailable_TracksRegistryState() public {
        assertTrue(registrar.isAvailable(LABEL), "available before registration");
        registrar.register(LABEL, merchant, DISPLAY_NAME);
        assertFalse(registrar.isAvailable(LABEL), "taken after registration");
    }

    function test_NothingWritten_WhenValidationFails() public {
        vm.expectRevert(TapMerchantRegistrar.InvalidOwner.selector);
        registrar.register(LABEL, address(0), DISPLAY_NAME);

        assertEq(registry.registerCount(), 0, "no registration attempted");
        assertEq(resolver.setAddrCount(), 0, "no address record written");
        assertEq(resolver.setTextCount(), 0, "no text record written");
    }
}

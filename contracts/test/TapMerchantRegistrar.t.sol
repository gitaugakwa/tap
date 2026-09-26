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
    /// @dev DNS-encoded "tap.eth": one length byte per label, null-terminated. This is
    ///      the form the resolver deployed on Sepolia takes (D28).
    bytes internal constant PARENT_DNS = hex"037461700365746800";
    /// @dev DNS-encoded "yoyogi-market.tap.eth". This exact vector is in docs/03 and
    ///      was reproduced independently here.
    bytes internal constant YOYOGI_DNS = hex"0d796f796f67692d6d61726b6574037461700365746800";

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
            IPermissionedRegistry(address(registry)), ITapResolver(address(resolver)), PARENT_DNS
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

        assertEq(resolver.setAddressCount(), 1, "one address record written");
        assertEq(resolver.lastAddrName(), YOYOGI_DNS, "address written against the child name");
        assertEq(resolver.lastCoinType(), 60, "ETH coin type");
        assertEq(resolver.lastAddressBytes(), abi.encodePacked(merchant), "owner's address");

        assertEq(resolver.setTextCount(), 1, "one text record written");
        assertEq(resolver.lastTextName(), YOYOGI_DNS, "text written against the child name");
        assertEq(resolver.lastTextKey(), "name", "display-name key (D17)");
        assertEq(resolver.lastTextValue(), DISPLAY_NAME, "display name");
    }

    /// @dev Pins the DNS encoding against docs/03's published vector. The live resolver
    ///      keys records by this, not by a namehash (D28), so a regression here would
    ///      silently write records nobody can resolve.
    function test_DnsEncoding() public view {
        assertEq(registrar.dnsNameOf(LABEL), YOYOGI_DNS, "matches the docs/03 vector");
        assertEq(registrar.parentDns(), PARENT_DNS, "parent stored as given");
        assertEq(
            registrar.dnsNameOf(LABEL),
            abi.encodePacked(uint8(bytes(LABEL).length), LABEL, PARENT_DNS),
            "one length byte, the label, then the parent"
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
        assertEq(resolver.setAddressCount(), 0, "no address record written");
        assertEq(resolver.setTextCount(), 0, "no text record written");
    }
}

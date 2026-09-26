// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPermissionedRegistry} from
    "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";
import {RegistryRolesLib} from "@ensdomains/contracts-v2/registry/libraries/RegistryRolesLib.sol";

import {ITapResolver} from "./interfaces/ITapResolver.sol";

/// @notice Issues merchant subnames under our ENSv2 UserRegistry and writes their
///         address and display-name records.
/// @dev Registration is free and permissionless for the hackathon: first come, first
///      served. The merchant receives only `ROLE_SET_RESOLVER` on their own subname,
///      so they can later graduate to a resolver of their own.
contract TapMerchantRegistrar {
    error InvalidLabel(string label);
    error InvalidOwner();
    error InvalidDisplayName();
    error NameNotAvailable(string label);

    event MerchantRegistered(
        uint256 indexed tokenId, string label, address indexed owner, string displayName
    );

    /// @dev ENSIP-9 coin type for ETH.
    uint256 public constant COIN_TYPE_ETH = 60;
    /// @dev The text record the SDK reads the merchant's display name from.
    string public constant DISPLAY_NAME_KEY = "name";
    /// @dev Least privilege: the merchant may repoint their resolver, nothing more.
    uint256 public constant MERCHANT_ROLES = RegistryRolesLib.ROLE_SET_RESOLVER;

    uint256 public constant MIN_LABEL_LENGTH = 3;
    uint256 public constant MAX_LABEL_LENGTH = 32;
    uint256 public constant MAX_DISPLAY_NAME_LENGTH = 64;

    /// @notice Our UserRegistry for the parent name.
    IPermissionedRegistry public immutable REGISTRY;
    /// @notice Our PermissionedResolver.
    ITapResolver public immutable RESOLVER;
    /// @notice The DNS-encoded parent name, e.g. "tap.eth" as \x03tap\x03eth\x00.
    bytes public parentDns;

    constructor(IPermissionedRegistry registry, ITapResolver resolver, bytes memory parentDns_) {
        REGISTRY = registry;
        RESOLVER = resolver;
        parentDns = parentDns_;
    }

    /// @notice Whether `label` can still be registered.
    function isAvailable(string calldata label) public view returns (bool) {
        IPermissionedRegistry.State memory state =
            REGISTRY.getState(uint256(keccak256(bytes(label))));
        return state.status == IPermissionedRegistry.Status.AVAILABLE;
    }

    /// @notice The DNS-encoded form of `label` under the parent name.
    /// @dev One length byte, the label, then the already-encoded parent.
    function dnsNameOf(string calldata label) public view returns (bytes memory) {
        return abi.encodePacked(uint8(bytes(label).length), label, parentDns);
    }

    /// @notice Register `label` to `owner` and write its records.
    /// @param label 3-32 characters of [a-z0-9-], not starting or ending with "-".
    /// @param owner The address the name resolves to, and the owner of the subname.
    /// @param displayName The merchant's human-readable name, 1-64 bytes.
    /// @return tokenId The registry token ID of the new subname.
    function register(string calldata label, address owner, string calldata displayName)
        external
        returns (uint256 tokenId)
    {
        if (!isValidLabel(label)) revert InvalidLabel(label);
        if (owner == address(0)) revert InvalidOwner();
        uint256 displayNameLength = bytes(displayName).length;
        if (displayNameLength == 0 || displayNameLength > MAX_DISPLAY_NAME_LENGTH) {
            revert InvalidDisplayName();
        }
        if (!isAvailable(label)) revert NameNotAvailable(label);

        tokenId = REGISTRY.register(
            label,
            owner,
            IRegistry(address(0)),
            address(RESOLVER),
            MERCHANT_ROLES,
            type(uint64).max
        );

        bytes memory dnsName = dnsNameOf(label);
        RESOLVER.setAddress(dnsName, COIN_TYPE_ETH, abi.encodePacked(owner));
        RESOLVER.setText(dnsName, DISPLAY_NAME_KEY, displayName);

        emit MerchantRegistered(tokenId, label, owner, displayName);
    }

    /// @notice Whether `label` is a valid merchant label.
    /// @dev ASCII-only [a-z0-9-], so a valid label is already ENS-normalized.
    function isValidLabel(string calldata label) public pure returns (bool) {
        bytes calldata raw = bytes(label);
        if (raw.length < MIN_LABEL_LENGTH || raw.length > MAX_LABEL_LENGTH) return false;
        if (raw[0] == "-" || raw[raw.length - 1] == "-") return false;
        for (uint256 i; i < raw.length; ++i) {
            bytes1 char = raw[i];
            bool isLower = char >= "a" && char <= "z";
            bool isDigit = char >= "0" && char <= "9";
            if (!isLower && !isDigit && char != "-") return false;
        }
        return true;
    }
}

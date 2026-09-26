// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice The subset of the ENSv2 PermissionedResolver that TapMerchantRegistrar calls.
/// @dev Signatures mirror `PermissionedResolver` in the vendored contracts-v2 checkout:
///      records are keyed by the ENS namehash (`node`), not a DNS-encoded name.
interface ITapResolver {
    /// @notice Set the address record for `coinType` on `node`.
    /// @param node The namehash of the name to write.
    /// @param coinType The ENSIP-9 coin type (60 for ETH).
    /// @param addressBytes The address, ABI-packed.
    function setAddr(bytes32 node, uint256 coinType, bytes calldata addressBytes) external;

    /// @notice Set the text record for `key` on `node`.
    /// @param node The namehash of the name to write.
    /// @param key The text record key.
    /// @param value The text record value.
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

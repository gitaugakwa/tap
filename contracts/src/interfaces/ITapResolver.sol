// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice The subset of the ENSv2 PermissionedResolver that TapMerchantRegistrar calls.
/// @dev Matches the resolver **deployed on Sepolia** (D28), which keys records by a
///      DNS-encoded name. Note the newer contracts-v2 source in lib/ has since moved to
///      `setAddr(bytes32 node, ...)`; that version is not what is live, so do not
///      "correct" these signatures against the vendored source.
interface ITapResolver {
    /// @notice Set the address record for `coinType` on `name`.
    /// @param name The DNS-encoded name to write, e.g. \x03tap\x03eth\x00.
    /// @param coinType The ENSIP-9 coin type (60 for ETH).
    /// @param addressBytes The address, ABI-packed.
    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes)
        external;

    /// @notice Set the text record for `key` on `name`.
    /// @param name The DNS-encoded name to write.
    /// @param key The text record key.
    /// @param value The text record value.
    function setText(bytes calldata name, string calldata key, string calldata value) external;
}

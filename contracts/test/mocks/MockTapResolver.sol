// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal stand-in for the ENSv2 PermissionedResolver deployed on Sepolia.
/// @dev Records the arguments of the last setAddress/setText so tests can assert the
///      registrar wrote the right records against the right DNS-encoded name.
contract MockTapResolver {
    bytes public lastAddrName;
    uint256 public lastCoinType;
    bytes public lastAddressBytes;
    uint256 public setAddressCount;

    bytes public lastTextName;
    string public lastTextKey;
    string public lastTextValue;
    uint256 public setTextCount;

    function setAddress(bytes calldata name, uint256 coinType, bytes calldata addressBytes)
        external
    {
        lastAddrName = name;
        lastCoinType = coinType;
        lastAddressBytes = addressBytes;
        setAddressCount++;
    }

    function setText(bytes calldata name, string calldata key, string calldata value) external {
        lastTextName = name;
        lastTextKey = key;
        lastTextValue = value;
        setTextCount++;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal stand-in for the ENSv2 PermissionedResolver.
/// @dev Records the arguments of the last setAddr/setText so tests can assert the
///      registrar wrote the right records against the right node.
contract MockTapResolver {
    bytes32 public lastAddrNode;
    uint256 public lastCoinType;
    bytes public lastAddressBytes;
    uint256 public setAddrCount;

    bytes32 public lastTextNode;
    string public lastTextKey;
    string public lastTextValue;
    uint256 public setTextCount;

    function setAddr(bytes32 node, uint256 coinType, bytes calldata addressBytes) external {
        lastAddrNode = node;
        lastCoinType = coinType;
        lastAddressBytes = addressBytes;
        setAddrCount++;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        lastTextNode = node;
        lastTextKey = key;
        lastTextValue = value;
        setTextCount++;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPermissionedRegistry} from
    "@ensdomains/contracts-v2/registry/interfaces/IPermissionedRegistry.sol";
import {IRegistry} from "@ensdomains/contracts-v2/registry/interfaces/IRegistry.sol";

/// @notice Minimal stand-in for an ENSv2 PermissionedRegistry.
/// @dev Implements only the two functions TapMerchantRegistrar calls, and records the
///      arguments of the last register() so tests can assert on them. Deliberately does
///      not declare `is IPermissionedRegistry`: dispatch is by selector, so matching
///      signatures is enough, and the real interface drags in the whole ERC1155 and
///      access-control surface that none of these tests exercise.
contract MockPermissionedRegistry {
    struct RegisterCall {
        string label;
        address owner;
        IRegistry subregistry;
        address resolver;
        uint256 roleBitmap;
        uint64 expiry;
    }

    RegisterCall public lastRegister;
    uint256 public registerCount;

    mapping(uint256 labelhash => bool) internal _taken;

    /// @dev Token IDs are arbitrary but distinct, so tests can assert the registrar
    ///      returns and emits whatever the registry handed back.
    uint256 internal constant TOKEN_ID_BASE = 1000;

    function register(
        string calldata label,
        address owner,
        IRegistry subregistry,
        address resolver,
        uint256 roleBitmap,
        uint64 expiry
    ) external returns (uint256 tokenId) {
        lastRegister = RegisterCall(label, owner, subregistry, resolver, roleBitmap, expiry);
        _taken[uint256(keccak256(bytes(label)))] = true;
        tokenId = TOKEN_ID_BASE + registerCount;
        registerCount++;
    }

    function getState(uint256 anyId)
        external
        view
        returns (IPermissionedRegistry.State memory state)
    {
        state.status = _taken[anyId]
            ? IPermissionedRegistry.Status.REGISTERED
            : IPermissionedRegistry.Status.AVAILABLE;
    }

    /// @notice Force a label into a given status, for cases the happy path cannot reach.
    function setStatus(string calldata label, bool taken) external {
        _taken[uint256(keccak256(bytes(label)))] = taken;
    }

    function expectedTokenId(uint256 index) external pure returns (uint256) {
        return TOKEN_ID_BASE + index;
    }
}

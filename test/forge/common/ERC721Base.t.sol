// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;

import "test/forge/utils/Test.sol";

import {EIP712Base} from "contracts/common/EIP712Base.sol";

contract EIP712Test is Test {
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            bytes(
                "EIP712Domain(string name,string version,address verifyingContract,bytes32 salt)"
            )
        );

    EIP712Mock internal eip712;

    function setUp() public {
        eip712 = new EIP712Mock();
    }

    function testInitializeEIP712() public {
        string memory name = "Name";
        bytes32 domainSeperator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(name)),
                keccak256(bytes(eip712.ERC712_VERSION())),
                address(eip712),
                bytes32(_chainId())
            )
        );

        eip712.exposed_initializeEIP712(name);

        assertEq(eip712.getDomainSeperator(), domainSeperator);
    }

    function testCannotInitializeEIP712_AlreadyInited() public {
        eip712.exposed_initializeEIP712("");

        vm.expectRevert("already inited");

        eip712.exposed_initializeEIP712("");
    }

    function testGetChainId() public {
        assertEq(eip712.getChainId(), _chainId());
    }

    function _chainId() internal pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function testToTypedMessageHash() public {
        bytes32 messageHash = keccak256("placeholder");
        bytes32 typedMessageHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                eip712.getDomainSeperator(),
                messageHash
            )
        );

        assertEq(
            eip712.exposedToTypedMessageHash(messageHash),
            typedMessageHash
        );
    }
}

contract EIP712Mock is EIP712Base {
    function exposed_initializeEIP712(
        string calldata name
    ) external initializer {
        _initializeEIP712(name);
    }

    function exposedToTypedMessageHash(
        bytes32 messageHash
    ) external view returns (bytes32) {
        return toTypedMessageHash(messageHash);
    }
}

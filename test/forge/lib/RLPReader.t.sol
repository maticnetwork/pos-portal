// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.2;
pragma experimental ABIEncoderV2;

import "test/forge/utils/Test.sol";

import {RLPReader} from "contracts/lib/RLPReader.sol";

contract RLPReaderTest is Test {
  RLPReaderUser internal rlpReaderUser;

  // Use to access RLPReaderUser's memory pointer.
  // Note: The memory pointer must be recorded manually in RLPReaderUser beforehand.
  function _memPtr() internal view returns (uint256) {
    return rlpReaderUser.memPtr();
  }

  function setUp() public {
    rlpReaderUser = new RLPReaderUser();
  }

  function testToRlpItem() public {
    bytes memory rlp = hex"ff";

    RLPReader.RLPItem memory item = rlpReaderUser.toRlpItem(rlp);

    assertEq(item.len, 1);
    // the first 32 bytes are the length
    assertEq(item.memPtr, _memPtr() + 32);
  }

  function testCannotToUintStrict() public {
    bytes memory rlp = abi.encode(uint256(1337));

    vm.expectRevert();
    rlpReaderUser.toUintStrict(rlp);
  }

  function testToUintStrict() public {
    bytes memory rlp = abi.encode(uint256(1337));
    rlp = abi.encodePacked(hex"00", rlp);

    assertEq(rlpReaderUser.toUintStrict(rlp), 1337);
  }

  function testIsList() public {
    // short
    bytes memory rlp = abi.encodePacked(RLPReader.LIST_SHORT_START);
    assertTrue(rlpReaderUser.isList(rlp));

    // long
    rlp = abi.encodePacked(RLPReader.LIST_LONG_START);
    assertTrue(rlpReaderUser.isList(rlp));

    // not
    rlp = abi.encodePacked(RLPReader.STRING_SHORT_START);
    assertFalse(rlpReaderUser.isList(rlp));
  }

  function testCannotIterator() public {
    bytes memory rlp = abi.encodePacked(RLPReader.STRING_SHORT_START);

    vm.expectRevert();
    rlpReaderUser.iterator(rlp);
  }

  function testIterator() public {
    bytes memory rlp = abi.encodePacked(RLPReader.LIST_SHORT_START);

    RLPReader.Iterator memory it = rlpReaderUser.iterator(rlp);

    assertEq(it.item.len, rlp.length);
    assertEq(it.item.memPtr, _memPtr() + 32);
    // data starts after one byte
    assertEq(it.nextPtr, _memPtr() + 32 + 1);
  }

  function testHasNext() public {
    // no
    bytes memory rlp = abi.encodePacked(RLPReader.LIST_SHORT_START);
    assertFalse(rlpReaderUser.hasNext(rlp));

    // yes
    rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );
    assertTrue(rlpReaderUser.hasNext(rlp));
  }

  function testCannotNext() public {
    bytes memory rlp = abi.encodePacked(RLPReader.LIST_SHORT_START);

    vm.expectRevert();
    rlpReaderUser.next(rlp);
  }

  function testNext() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    RLPReader.RLPItem memory item = rlpReaderUser.next(rlp);

    assertEq(item.len, 1);
    assertEq(item.memPtr, _memPtr() + 32 + 1);
  }

  function testRlpLen() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    assertEq(rlpReaderUser.rlpLen(rlp), rlp.length);
  }

  function testPayloadLocation() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    (uint256 memPtr, uint256 len) = rlpReaderUser.payloadLocation(rlp);

    assertEq(memPtr, _memPtr() + 32 + 1);
    assertEq(len, rlp.length - 1);
  }

  function testPayloadLen() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    assertEq(rlpReaderUser.payloadLen(rlp), rlp.length - 1);
  }

  function testCannotToList() public {
    bytes memory rlp = abi.encodePacked(RLPReader.STRING_SHORT_START);

    vm.expectRevert();
    rlpReaderUser.toList(rlp);
  }

  function testToList() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    RLPReader.RLPItem[] memory items = rlpReaderUser.toList(rlp);

    assertEq(items.length, 1);
    assertEq(items[0].len, 1);
    assertEq(items[0].memPtr, _memPtr() + 32 + 1);
  }

  function testRlpBytesKeccak256() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    assertEq(rlpReaderUser.rlpBytesKeccak256(rlp), keccak256(rlp));
  }

  function testPayloadKeccak256() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    assertEq(
      rlpReaderUser.payloadKeccak256(rlp),
      keccak256(
        abi.encodePacked(RLPReader.LIST_SHORT_START, RLPReader.LIST_SHORT_START)
      )
    );
  }

  function testToRlpBytes() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.LIST_SHORT_START,
      RLPReader.LIST_SHORT_START
    );

    assertEq(rlpReaderUser.toRlpBytes(rlp), rlp);
  }

  function testCannotToBoolean() public {
    bytes memory rlp = new bytes(2);

    vm.expectRevert();
    rlpReaderUser.toBoolean(rlp);
  }

  function testToBoolean() public {
    bytes memory rlp = abi.encodePacked(RLPReader.STRING_SHORT_START);
    assertFalse(rlpReaderUser.toBoolean(rlp));

    rlp = hex"00";
    assertFalse(rlpReaderUser.toBoolean(rlp));

    rlp = hex"01";
    assertTrue(rlpReaderUser.toBoolean(rlp));
  }

  function testCannotToAddress() public {
    bytes memory rlp;

    vm.expectRevert();
    rlpReaderUser.toAddress(rlp);
  }

  function testToAddress() public {
    bytes memory rlp = abi.encodePacked(hex"00", address(999));

    assertEq(rlpReaderUser.toAddress(rlp), address(999));
  }

  function testCannotToUint() public {
    bytes memory rlp;

    vm.expectRevert();
    rlpReaderUser.toUint(rlp);
  }

  function testToUint() public {
    bytes memory rlp = hex"02";
    assertEq(rlpReaderUser.toUint(rlp), 2);

    rlp = abi.encode(uint256(1337));
    assertEq(rlpReaderUser.toUint(rlp), 1337);
  }

  function testCannotToBytes() public {
    bytes memory rlp;

    vm.expectRevert();
    rlpReaderUser.toBytes(rlp);
  }

  function testToBytes() public {
    bytes memory rlp = abi.encodePacked(
      RLPReader.STRING_SHORT_START,
      string("hello world")
    );

    assertEq(rlpReaderUser.toBytes(rlp), bytes("hello world"));
  }
}

// Note: Each function acts as its own setUp. Values are received from tests, then assigned to local variables.
contract RLPReaderUser {
  uint256 public memPtr;

  // For recording memory pointer, so it can be asserted from tests.
  function _recMemPtr(bytes memory item) internal {
    uint256 _memPtr;
    assembly {
      _memPtr := item
    }
    memPtr = _memPtr;
  }

  function next(
    bytes calldata value
  ) external returns (RLPReader.RLPItem memory) {
    bytes memory _item = value;

    _recMemPtr(_item);

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    RLPReader.Iterator memory self = RLPReader.iterator(item);

    return RLPReader.next(self);
  }

  function hasNext(bytes calldata value) external returns (bool) {
    bytes memory _item = value;

    _recMemPtr(_item);

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    RLPReader.Iterator memory self = RLPReader.iterator(item);

    return RLPReader.hasNext(self);
  }

  function toRlpItem(
    bytes calldata value
  ) external returns (RLPReader.RLPItem memory) {
    bytes memory item = value;

    _recMemPtr(item);

    return RLPReader.toRlpItem(item);
  }

  function iterator(
    bytes calldata value
  ) external returns (RLPReader.Iterator memory) {
    bytes memory _item = value;

    _recMemPtr(_item);

    RLPReader.RLPItem memory self = RLPReader.toRlpItem(_item);

    return RLPReader.iterator(self);
  }

  function rlpLen(bytes calldata value) external pure returns (uint256) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.rlpLen(item);
  }

  function payloadLocation(
    bytes calldata value
  ) external returns (uint256, uint256) {
    bytes memory _item = value;

    _recMemPtr(_item);

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.payloadLocation(item);
  }

  function payloadLen(bytes calldata value) external pure returns (uint256) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.payloadLen(item);
  }

  function toList(
    bytes calldata value
  ) external returns (RLPReader.RLPItem[] memory) {
    bytes memory _item = value;

    _recMemPtr(_item);

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.toList(item);
  }

  function isList(bytes calldata value) external pure returns (bool) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.isList(item);
  }

  function rlpBytesKeccak256(
    bytes calldata value
  ) external pure returns (bytes32) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.rlpBytesKeccak256(item);
  }

  function payloadKeccak256(
    bytes calldata value
  ) external pure returns (bytes32) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.rlpBytesKeccak256(item);
  }

  function toRlpBytes(
    bytes calldata value
  ) external pure returns (bytes memory) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.toRlpBytes(item);
  }

  function toBoolean(bytes calldata value) external pure returns (bool) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.toBoolean(item);
  }

  function toAddress(bytes calldata value) external pure returns (address) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.toAddress(item);
  }

  function toUint(bytes calldata value) external pure returns (uint256) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.toUint(item);
  }

  function toUintStrict(bytes calldata value) external pure returns (uint256) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.toUintStrict(item);
  }

  function toBytes(bytes calldata value) external pure returns (bytes memory) {
    bytes memory _item = value;

    RLPReader.RLPItem memory item = RLPReader.toRlpItem(_item);

    return RLPReader.toBytes(item);
  }
}

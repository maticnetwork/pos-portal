pragma solidity ^0.6.6;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ICheckpointManager} from "./ICheckpointManager.sol";

contract MockCheckpointManager is ICheckpointManager {
    using SafeMath for uint256;

    uint256 public currentCheckpointNumber = 0;

    function setCheckpoint(bytes32 rootHash, uint256 start, uint256 end) public {
        HeaderBlock memory headerBlock = HeaderBlock({
            root: rootHash,
            start: start,
            end: end,
            createdAt: now,
            proposer: msg.sender
        });

        currentCheckpointNumber = currentCheckpointNumber.add(1);
        headerBlocks[currentCheckpointNumber] = headerBlock;
    }
}

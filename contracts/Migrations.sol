pragma solidity 0.6.6;


contract Migrations {
    address public owner;
    uint256 public last_completed_migration;

    constructor() public {
        owner = msg.sender;
    }

    modifier restricted() {
        require(msg.sender == owner, "Sender should be owner");
        _;
    }

    function setCompleted(uint256 completed) public restricted {
        last_completed_migration = completed;
    }
}

pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../child/IStateReceiver.sol";
import "./ChildPotatoFarm.sol";

// This contract receives the deposit of potatoes from pos bridge
// then plants the potatoes for user using custom state sync
contract ChildPotatoMigrator is IStateReceiver {
  IERC20 potato;
  ChildPotatoFarm farm;
  constructor(address potato_, address farm_) public {
    potato = IERC20(potato_);
    farm = ChildPotatoFarm(farm_);
  }

  function onStateReceive(uint, bytes calldata data) external override {
    (address user, uint amount) = abi.decode(data, (address, uint));
    potato.approve(address(farm), amount);
    farm.plantFor(user, amount);
  }
}

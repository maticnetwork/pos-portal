pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../root/StateSender/IStateSender.sol";
import "../../root/RootChainManager/IRootChainManager.sol";

contract RootPotatoMigrator {
  IStateSender stateSender;
  IERC20 potato;
  IRootChainManager rootChainManager;
  address erc20Predicate;
  address childPotatoMigrator;

  constructor(
    address stateSender_,
    address potato_,
    address rootChainManager_,
    address erc20Predicate_,
    address childPotatoMigrator_
  ) public {
    stateSender = IStateSender(stateSender_);
    potato = IERC20(potato_);
    rootChainManager = IRootChainManager(rootChainManager_);
    erc20Predicate = erc20Predicate_;
    childPotatoMigrator = childPotatoMigrator_;
  }

  function plantOnChildFarm(uint amount) external {
    potato.transferFrom(
      msg.sender,
      address(this),
      amount
    );

    potato.approve(erc20Predicate, amount);

    rootChainManager.depositFor(
      childPotatoMigrator,
      address(potato),
      abi.encode(amount)
    );

    stateSender.syncState(
      childPotatoMigrator,
      abi.encode(msg.sender, amount)
    );
  }
}

pragma solidity 0.6.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../root/StateSender/IStateSender.sol";
import "../../root/RootChainManager/IRootChainManager.sol";

// This contract enables deposit and plant deom single tx on ethereum chain
// First potatoes are transferred to this contract
// Then they are deposited to ChildPotatoMigrator contract
// Then a custom state sync is sent to ChildPotatoMigrator, using this the potatoes will be planted on matic chain
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

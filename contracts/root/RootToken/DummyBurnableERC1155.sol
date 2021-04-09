pragma solidity 0.6.6;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IBurnableERC1155} from "./IBurnableERC1155.sol";
import {NativeMetaTransaction} from "../../common/NativeMetaTransaction.sol";
import {ContextMixin} from "../../common/ContextMixin.sol";
import {AccessControlMixin} from "../../common/AccessControlMixin.sol";

contract DummyBurnableERC1155 is
    ERC1155,
    AccessControlMixin,
    NativeMetaTransaction,
    ContextMixin,
    IBurnableERC1155
{
    bytes32 public constant PREDICATE_ROLE = keccak256("PREDICATE_ROLE");

    constructor(string memory uri_) public ERC1155(uri_) {
        _setupContractId("DummyBurnableERC1155");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(PREDICATE_ROLE, _msgSender());

        _initializeEIP712(uri_);
    }

    // Read <IBurnableERC1155:mint>, carefully
     function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external override only(PREDICATE_ROLE) {
        _mint(account, id, amount, data);
    }

    function burn(
        address account,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external override only(PREDICATE_ROLE) {

        if(data.length > 0) {
            // do something interesting with data you received from L2
        }

        _burn(account, id, amount);

    }

    function burnBatch(
        address account,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external override only(PREDICATE_ROLE) {

        if(data.length > 0) {
            // do something interesting with data you received from L2
        }

        _burnBatch(account, ids, amounts);

    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        internal
        override
    {

        if(from != address(0) && to != address(0) && data.length > 0) {
            // do something interesting with data that you
            // received
            //
            // This hook is being made available for you so that when
            // some one attempts to exit tokens from L2 ( not a burn )
            // along with some arbitrary metadata, you can catch that
            // and perform any thing you need to perform on that piece of data
            // in this block
        }

    }

    function _msgSender()
        internal
        override
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }
}

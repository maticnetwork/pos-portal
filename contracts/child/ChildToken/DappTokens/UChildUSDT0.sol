pragma solidity 0.6.6;

import {UChildERC20} from "../UpgradeableChildERC20/UChildERC20.sol";
import {IERC7802, IERC165} from "./IERC7802.sol";
import {WithBlockedList} from "./WithBlockedList.sol";
import {ContextMixin} from "../../../common/ContextMixin.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";

contract UChildUSDT0 is UChildERC20, IERC7802, WithBlockedList {
    uint256 public USDT0_VERSION;

    event LogSetOFTContract(address indexed oftContract);

    constructor() public {
        USDT0_VERSION = 9999;
    }

    function upgradeToUSDT0(address newAdmin, address oftContract) public {
        require(newAdmin != address(0), "USDT0: newAdmin == 0");
        require(oftContract != address(0), "USDT0: oft == 0");
        require(USDT0_VERSION == 0, "USDT0: Already upgraded");
        require(getRoleMemberCount(DEFAULT_ADMIN_ROLE) == 0, "USDT0: Already initialized");

        _setupRole(DEFAULT_ADMIN_ROLE, newAdmin);
        setName("USDT0");
        setSymbol("USDT0");
        _setupContractId("USDT0");
        _setDomainSeperator("USDT0");
        _initializeBlockedList(newAdmin);
        if (_msgSender() != newAdmin) {
            _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        }
        _setOFTContract(oftContract);
        if (_msgSender() != newAdmin) {
            renounceRole(DEFAULT_ADMIN_ROLE, _msgSender());
        }
        USDT0_VERSION = 1;
    }

    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    // --- Approve by signature ---
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(owner != address(0), "USDT0: HOLDER-ZERO");

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                domainSeperator,
                keccak256(
                    abi.encode(
                        PERMIT_TYPEHASH,
                        owner,
                        spender,
                        value,
                        nonces[owner]++,
                        deadline
                    )
                )
        ));

        require(owner == ecrecover(digest, v, r, s), "USDT0: INVALID-PERMIT");
        require(deadline == 0 || now <= deadline, "USDT0: PERMIT-EXPIRED");
        require(msg.sender != address(this), "USDT0: PERMIT_META_TX_DISABLED");

        _approve(owner, spender, value);
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by OAPP contract
     * @param user user address for whom deposit is being done
     * @param amount amount of tokens to mint
     */
    function crosschainMint(address user, uint256 amount)
        external
        override
        only(DEPOSITOR_ROLE)
    {
        _mint(user, amount);
        emit CrosschainMint(user, amount, _msgSender());
    }

    /**
     * @notice Burn tokens through a crosschain transfer.
     * @param user user address for whom burn is being done
     * @param amount amount of tokens to burn
     */
    function crosschainBurn(address user, uint256 amount)
        external
        override
        only(DEPOSITOR_ROLE)
    {
        _burn(user, amount);
        emit CrosschainBurn(user, amount, _msgSender());
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal virtual override {
        require(!isBlocked[from] || hasRole(DEFAULT_ADMIN_ROLE, _msgSender()), "USDT0: from is blocked");
        require(
            to != address(this),
            "USDT0: transfer to the contract address"
        );
    }

    function transferFrom(
        address _sender,
        address _recipient,
        uint256 _amount
    ) public virtual override onlyNotBlocked returns (bool) {
        return super.transferFrom(_sender, _recipient, _amount);
    }

    function multiTransfer (
        address[] calldata _recipients,
        uint256[] calldata _values
    ) external {
        require(
            _recipients.length == _values.length,
            "USDT0: multiTransfer mismatch"
        );
        for (uint256 i = 0; i < _recipients.length; i++) {
            _transfer(_msgSender(), _recipients[i], _values[i]);
        }
    }

    function mint(address _destination, uint256 _amount) public virtual only(DEFAULT_ADMIN_ROLE) {
        _mint(_destination, _amount);
        emit Mint(_destination, _amount);
    }

    function redeem(uint256 _amount) public virtual only(DEFAULT_ADMIN_ROLE) {
        _burn(_msgSender(), _amount);
        emit Redeem(_amount);
    }

    function destroyBlockedFunds(address _blockedUser) public only(DEFAULT_ADMIN_ROLE) {
        require(isBlocked[_blockedUser], "USDT0: user is not blocked");
        uint256 blockedFunds = balanceOf(_blockedUser);
        _burn(_blockedUser, blockedFunds);
        emit DestroyedBlockedFunds(_blockedUser, blockedFunds);
    }

    /**
     * @notice Sets the OFT contract address by granting it the DEPOSITOR_ROLE
     * @dev Can only be called by accounts with DEFAULT_ADMIN_ROLE
     * @param _oftContract The address of the OFT contract
     */
    function setOFTContract(address _oftContract) external only(DEFAULT_ADMIN_ROLE) {
        _setOFTContract(_oftContract);
        emit LogSetOFTContract(_oftContract);
    }

    function _setOFTContract(address _oftContract) internal {
        // Revoke DEPOSITOR_ROLE from all current holders
        uint256 count = getRoleMemberCount(DEPOSITOR_ROLE);
        for (uint256 i = 0; i < count; i++) {
            // Always get index 0 since the array shifts after each revocation
            address currentDepositor = getRoleMember(DEPOSITOR_ROLE, 0);
            revokeRole(DEPOSITOR_ROLE, currentDepositor);
        }

        // Grant DEPOSITOR_ROLE to the new OFT contract
        grantRole(DEPOSITOR_ROLE, _oftContract);
    }

    /**
     * @notice Returns the OFT contract address (the address with DEPOSITOR_ROLE)
     * @return The address of the OFT contract
     */
    function oftContract() external view returns (address) {
        uint256 count = getRoleMemberCount(DEPOSITOR_ROLE);
        if (count > 0) {
            return getRoleMember(DEPOSITOR_ROLE, 0);
        }
        return address(0);
    }

    function supportsInterface(bytes4 interfaceId) external view override returns (bool) {
        // interface identifiers for EIP7802 and EIP165
        return interfaceId == 0x33331994|| interfaceId == 0x01ffc9a7;
    }

    // This is to support Native meta transactions
    // never use msg.sender directly, use _msgSender() instead
    function _msgSender()
        internal
        override(UChildERC20, Context)
        view
        returns (address payable sender)
    {
        return ContextMixin.msgSender();
    }

    event Mint(address indexed _destination, uint256 _amount);
    event Redeem(uint256 _amount);
    event DestroyedBlockedFunds(address indexed _blockedUser, uint256 _balance);
}

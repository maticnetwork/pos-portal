pragma solidity 0.6.6;

interface IRootChainManager {
    struct TokenStoppageStatus {
        bool isDepositDisabled;
        bool isExitDisabled;
        uint256 lastExitBlockNumber;
    }

    event TokenMapped(
        address indexed rootToken,
        address indexed childToken,
        bytes32 indexed tokenType
    );

    event PredicateRegistered(
        bytes32 indexed tokenType,
        address indexed predicateAddress
    );

    event StoppageStatusChanged(
        address indexed rootToken,
        bool isDepositDisabled,
        bool isExitDisabled,
        uint256 lastExitBlockNumber
    );

    function registerPredicate(bytes32 tokenType, address predicateAddress)
        external;

    function mapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external;

    function cleanMapToken(
        address rootToken,
        address childToken
    ) external;

    function remapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external;

    function depositEtherFor(address user) external payable;

    function depositFor(
        address user,
        address rootToken,
        bytes calldata depositData
    ) external;

    function exit(bytes calldata inputData) external;
}

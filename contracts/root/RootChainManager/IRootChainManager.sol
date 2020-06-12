pragma solidity "0.6.6";


interface IRootChainManager {
    event TokenMapped(
        address indexed rootToken,
        address indexed childToken,
        bytes32 indexed tokenType
    );

    event PredicateRegistered(bytes32 tokenType, address predicateAddress);

    // event Locked(
    //   address indexed user,
    //   address indexed rootToken,
    //   uint256 indexed amount
    // );

    // event Exited(
    //   address indexed user,
    //   address indexed rootToken,
    //   uint256 indexed amount
    // );

    function registerPredicate(bytes32 tokenType, address predicateAddress)
        external;

    function typeToPredicate(bytes32 tokenType) external view returns (address);

    function mapToken(
        address rootToken,
        address childToken,
        bytes32 tokenType
    ) external;

    function rootToChildToken(address rootToken)
        external
        view
        returns (address);

    function childToRootToken(address childToken)
        external
        view
        returns (address);

    function tokenToType(address rootToken) external view returns (bytes32);

    // function depositEther() external payable;
    // function deposit(address rootToken, uint256 amount) external;

    function depositEtherFor(address user, uint256 amount) external payable;

    function depositFor(
        address user,
        address rootToken,
        bytes calldata depositData
    ) external;

    function exit(bytes calldata inputData) external;

    function processedExits(bytes32 exitHash) external view returns (bool);
}

pragma solidity ^0.6.6;


interface ITokenPredicate {
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external;

    function validateExitLog(bytes calldata burnLogRLP) external pure;

    function exitTokens(bytes calldata burnLogRLP) external;
}

pragma solidity ^0.6.6;

import {RLPReader} from "../../lib/RLPReader.sol";


interface ITokenPredicate {
    function lockTokens(
        address depositor,
        address depositReceiver,
        address rootToken,
        bytes calldata depositData
    ) external;

    function validateExitLog(address msgSender, bytes calldata logRLPList) external pure;

    function exitTokens(address msgSender, address rootToken, bytes calldata logRLPList) external;
}

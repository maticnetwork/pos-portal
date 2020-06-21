pragma solidity ^0.6.6;

contract Initializable {
    bool inited = false;

    modifier initializer() {
        require(!inited, "already inited");
        inited = true;
        _;
    }
}

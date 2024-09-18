import * as ethers from "ethers";

const { AbiCoder, toUtf8Bytes, RLP } = ethers.utils;

const erc20TransferEventSig =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const erc721TransferEventSig =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const erc721WithdrawnBatchEventSig =
  "0xf871896b17e9cb7a64941c62c188a4f5c621b86800e3d15452ece01ce56073df";
const erc721TransferWithMetadataEventSig =
  "0xf94915c6d1fd521cee85359239227480c7e8776d7caf1fc3bacad5c269b66a14";
const erc1155TransferSingleEventSig =
  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
const erc1155TransferBatchEventSig =
  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";
const erc1155ChainExitEventSig =
  "0xc7b80b68f1c661da97dbd7e6e143a0c7c587dfc522cb2ac508b9084fecc492bc";

const abi = new AbiCoder();

interface iGetLogs {
  (obj: {
    from?: string;
    to?: string;
    operator?: string;
    user?: string;
    metaData?: string;
    data?: string;
    amount?: ethers.utils.BigNumber;
    amounts?: ethers.utils.BigNumber[];
    tokenId?: ethers.utils.BigNumber;
    tokenIds?: ethers.utils.BigNumber[];
    overrideSig?: string;
  }): string;
}

const getERC20TransferLog: iGetLogs = ({ overrideSig, from, to, amount }) => {
  return RLP.encode([
    "0x00",
    [overrideSig || erc20TransferEventSig, from, to],
    amount!.toHexString(),
  ]);
};

export const getERC721TransferLog: iGetLogs = ({
  overrideSig,
  from,
  to,
  tokenId,
}) => {
  return RLP.encode([
    "0x00",
    [overrideSig || erc721TransferEventSig, from, to, tokenId!.toHexString()],
  ]);
};

export const getERC721WithdrawnBatchLog: iGetLogs = ({
  overrideSig,
  user,
  tokenIds,
}) => {
  return RLP.encode([
    "0x00",
    [overrideSig || erc721WithdrawnBatchEventSig, user],
    abi.encode(["uint256[]"], [tokenIds!.map((t) => t.toHexString())]),
  ]);
};

export const getERC721TransferWithMetadataLog: iGetLogs = ({
  overrideSig,
  from,
  to,
  tokenId,
  metaData,
}) => {
  return RLP.encode([
    "0x00",
    [
      overrideSig || erc721TransferWithMetadataEventSig,
      from,
      to,
      tokenId!.toHexString(),
    ],
    // ABI encoded metadata, because that's how dummy root token expects it
    //
    // @note Two level serialisation is required because we're emitting
    // event with `bytes` field, which will be serialised by EVM itself
    // as `abi.encode(data)`, result into final level of serialised form
    //
    // Before that actual metadata we're interested in passing cross
    // chain needs to be serialised, which is what gets emitted via event
    // on L2
    abi.encode(["bytes"], [abi.encode(["string"], [metaData])]),
  ]);
};

export const getERC1155TransferSingleLog: iGetLogs = ({
  overrideSig,
  operator,
  from,
  to,
  tokenId,
  amount,
}) => {
  return RLP.encode([
    "0x00",
    [overrideSig || erc1155TransferSingleEventSig, operator, from, to],
    abi.encode(["uint256", "uint256"], [tokenId!.toHexString(), amount!.toHexString()]),
  ]);
};

export const getERC1155TransferBatchLog: iGetLogs = ({
  overrideSig,
  operator,
  from,
  to,
  tokenIds,
  amounts,
}) => {
  return RLP.encode([
    "0x00",
    [overrideSig || erc1155TransferBatchEventSig, operator, from, to],
    abi.encode(
      ["uint256[]", "uint256[]"],
      [tokenIds!.map((t) => t.toHexString()), amounts!.map((a) => a.toHexString())]
    ),
  ]);
};

export const getERC1155ChainExitLog: iGetLogs = ({
  overrideSig,
  to,
  tokenIds,
  amounts,
  data,
}) => {
  return RLP.encode([
    "0x00",
    [overrideSig || erc1155ChainExitEventSig, to],
    abi.encode(
      ["uint256[]", "uint256[]", "bytes"],
      [
        tokenIds!.map((t) => t.toHexString()),
        amounts!.map((a) => a.toHexString()),
        `0x${Buffer.from(
          toUtf8Bytes((data as string) || "Hello World")
        ).toString("hex")}`,
      ]
    ),
  ]);
};

function main() {
  const [cmd, args] = process.argv.slice(2);
  switch (cmd) {
    case "erc20Transfer": {
      const [from, to, amount, overrideSig] = abi.decode(
        ["address", "address", "uint256", "bytes32"],
        args
      );
      console.log(getERC20TransferLog({ from, to, amount, overrideSig }));
      break;
    }
    case "erc721Transfer": {
      const [from, to, tokenId, overrideSig] = abi.decode(
        ["address", "address", "uint256", "bytes32"],
        args
      );
      console.log(getERC721TransferLog({ from, to, tokenId, overrideSig }));
      break;
    }
    case "erc721TransferWithMetadata": {
      const [from, to, tokenId, metaData, overrideSig] = abi.decode(
        ["address", "address", "uint256", "string", "bytes32"],
        args
      );
      console.log(
        getERC721TransferWithMetadataLog({
          from,
          to,
          tokenId,
          metaData,
          overrideSig,
        })
      );
      break;
    }
    case "erc1155TransferSingle": {
      const [operator, from, to, tokenId, amount, overrideSig] = abi.decode(
        ["address", "address", "address", "uint256", "uint256", "bytes32"],
        args
      );
      console.log(
        getERC1155TransferSingleLog({
          operator,
          from,
          to,
          tokenId,
          amount,
          overrideSig,
        })
      );
      break;
    }
    case "erc1155TransferBatch": {
      const [operator, from, to, tokenIds, amounts, overrideSig] = abi.decode(
        ["address", "address", "address", "uint256[]", "uint256[]", "bytes32"],
        args
      );
      console.log(
        getERC1155TransferBatchLog({
          operator,
          from,
          to,
          tokenIds,
          amounts,
          overrideSig,
        })
      );
      break;
    }

    default: {
      console.error("invalid cmd");
      break;
    }
  }
}
main();
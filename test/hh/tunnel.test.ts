import chai, { expect } from "chai";
import { Signer, utils, ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { MockCheckpointManager } from "../../typechain-types/contracts/root/MockCheckpointManager";
import { MockStateSender } from "../../typechain-types/contracts/test/MockStateSender.sol/";
import {
  MockStateReceiver,
  TestChildTunnel,
  TestRootTunnel,
} from "../../typechain-types/contracts/test/";
import { buildPayloadForExit } from "./payload/payload";

const { AbiCoder, keccak256, toUtf8Bytes, randomBytes } = utils;
const abi = new AbiCoder();

const messageSentTopic = keccak256(toUtf8Bytes("MessageSent(bytes)"));

describe("tunnel test", () => {
  let alice: Signer;
  let bob: Signer;

  let rootTunnel: TestRootTunnel;
  let childTunnel: TestChildTunnel;
  let mockCheckpointManager: MockCheckpointManager;
  let mockStateSender: MockStateSender;
  let mockStateReceiver: MockStateReceiver;

  let sendMessageTxn: ContractTransaction;
  const sendMessageNumber = ethers.BigNumber.from(randomBytes(32));

  before(async () => {
    [alice, bob] = await ethers.getSigners();
    rootTunnel = (await (
      await ethers.getContractFactory("TestRootTunnel")
    ).deploy()) as TestRootTunnel;
    childTunnel = (await (
      await ethers.getContractFactory("TestChildTunnel")
    ).deploy()) as TestChildTunnel;

    mockCheckpointManager = (await (
      await ethers.getContractFactory("MockCheckpointManager")
    ).deploy()) as MockCheckpointManager;
    mockStateSender = (await (
      await ethers.getContractFactory("MockStateSender")
    ).deploy()) as MockStateSender;

    await expect(
      rootTunnel.setStateSender(ethers.constants.AddressZero)
    ).to.be.revertedWith("RootTunnel: BAD_NEW_STATE_SENDER");
    await rootTunnel.setStateSender(mockStateSender.address);
    await expect(
      rootTunnel.setCheckpointManager(ethers.constants.AddressZero)
    ).to.be.revertedWith("RootTunnel: BAD_NEW_CHECKPOINT_MANAGER");
    await rootTunnel.setCheckpointManager(mockCheckpointManager.address);
    await expect(
      rootTunnel.setChildTunnel(ethers.constants.AddressZero)
    ).to.be.revertedWith("RootTunnel: INVALID_CHILD_TUNNEL_ADDRESS");
    await rootTunnel.setChildTunnel(childTunnel.address);

    await childTunnel.grantRole(
      await childTunnel.STATE_SYNCER_ROLE(),
      mockStateSender.address
    );
  });

  it("tunnel initial state", async () => {
    expect(await childTunnel.number()).to.eq(0);
    expect(await rootTunnel.receivedNumber()).to.eq(0);
  });

  it("send message to L2 - type1", async () => {
    const message = abi.encode(
      ["bytes32", "uint256"],
      [await childTunnel.TYPE1(), "4"]
    );
    await rootTunnel.sendMessageToChild(message);
    expect(await childTunnel.number()).to.eq(4);
  });

  it("send message to L2 - type2", async () => {
    await rootTunnel.sendMessageToChild(
      abi.encode(["bytes32", "uint256"], [await childTunnel.TYPE1(), "4"])
    );
    expect(await childTunnel.number()).to.eq(8);

    await rootTunnel.sendMessageToChild(
      abi.encode(["bytes32", "uint256"], [await childTunnel.TYPE2(), "3"])
    );
    expect(await childTunnel.number()).to.eq(5);
  });

  it("send message to L2 - invalid sync type", async () => {
    await rootTunnel.sendMessageToChild(
      abi.encode(["bytes32", "uint256"], [randomBytes(32), "1"])
    );
    expect(await childTunnel.number()).to.eq(5); // no change
    await rootTunnel.sendMessageToChild(
      abi.encode(["bytes32", "uint256"], [await childTunnel.TYPE1(), "4"])
    );
    expect(await childTunnel.number()).to.eq(9);
    await rootTunnel.sendMessageToChild(
      abi.encode(["bytes32", "uint256"], [randomBytes(32), "1"])
    );
    expect(await childTunnel.number()).to.eq(9); // no change
  });

  it("send message to L1", async () => {
    sendMessageTxn = await childTunnel.sendMessage(
      abi.encode(["uint256"], [sendMessageNumber])
    );
    const receipt = await sendMessageTxn.wait();
    expect(receipt.logs[0].topics.includes(messageSentTopic)).to.be.true;
  });

  it("submit checkpoint and match checkpoint details", async () => {
    const { root: rootHash } = await buildPayloadForExit(
      sendMessageTxn.hash,
      messageSentTopic,
      (await mockCheckpointManager.currentCheckpointNumber()).toNumber()
    );
    await mockCheckpointManager.setCheckpoint(
      rootHash,
      sendMessageTxn.blockNumber! - 1,
      sendMessageTxn.blockNumber! + 1
    );
    expect(
      await mockCheckpointManager.headerBlocks(
        await mockCheckpointManager.currentCheckpointNumber()
      )
    ).to.include(rootHash);
  });

  it("be able to call receive message", async () => {
    const { burnProof } = await await buildPayloadForExit(
      sendMessageTxn.hash,
      messageSentTopic,
      (await mockCheckpointManager.currentCheckpointNumber()).toNumber()
    );

    const receiveTxn = await rootTunnel.receiveMessage(burnProof);

    expect((await receiveTxn.wait()).logs[0].topics).to.include(
      keccak256(toUtf8Bytes("MessageReceivedFromChild(uint256)"))
    );
    expect(await rootTunnel.receivedNumber()).to.eq(sendMessageNumber);
  });

  it("receive message fail on same message", async () => {
    const { burnProof } = await await buildPayloadForExit(
      sendMessageTxn.hash,
      messageSentTopic,
      (await mockCheckpointManager.currentCheckpointNumber()).toNumber()
    );

    await expect(rootTunnel.receiveMessage(burnProof)).to.be.revertedWith(
      "RootTunnel: EXIT_ALREADY_PROCESSED"
    );
  });
});

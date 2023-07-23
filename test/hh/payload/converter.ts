import { BigNumber } from "ethers";
import { ethers } from "hardhat";
// import { utils } from "../utils";

export class Converter {
  static toHex(amount: BigNumber | string | number) {
    const dataType = typeof amount;
    if (dataType === "number") {
      amount = ethers.BigNumber.from(amount);
    } else if (dataType === "string") {
      if ((amount as string).slice(0, 2) === "0x") {
        return amount;
      }
      amount = ethers.BigNumber.from(amount);
    }
    if (ethers.BigNumber.isBigNumber(amount)) {
      return "0x" + amount.toString();
    } else {
      throw new Error(`Invalid value ${amount}, value is not a number.`);
    }
  }
}

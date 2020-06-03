import {Contract, Signer, utils} from "ethers";

import {getDb, BRE} from "./misc-utils";
import {tEthereumAddress, eContractid} from "./types";
import {Example} from "../types/Example";
import {LendingPoolAddressesProvider} from "../types/LendingPoolAddressesProvider";

export const registerContractInJsonDb = async (
  contractId: string,
  contractInstance: Contract
) => {
  const currentNetwork = BRE.network.name;
  if (
    currentNetwork !== "buidlerevm" &&
    currentNetwork !== "soliditycoverage"
  ) {
    console.log(`*** ${contractId} ***\n`);
    console.log(`Network: ${currentNetwork}`);
    console.log(`tx: ${contractInstance.deployTransaction.hash}`);
    console.log(`contract address: ${contractInstance.address}`);
    console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
    console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
    console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
    console.log(`\n******`);
    console.log();
  }

  await getDb()
    .set(`${contractId}.${currentNetwork}`, {
      address: contractInstance.address,
      deployer: contractInstance.deployTransaction.from,
    })
    .write();
};

export const getEthersSigners = async (): Promise<Signer[]> =>
  await Promise.all(await BRE.ethers.signers());

export const getEthersSignersAddresses = async (): Promise<
  tEthereumAddress[]
> =>
  await Promise.all(
    (await BRE.ethers.signers()).map((signer) => signer.getAddress())
  );

export const getCurrentBlock = async () => {
  return BRE.ethers.provider.getBlockNumber();
};

export const decodeAbiNumber = (data: string): number =>
  parseInt(utils.defaultAbiCoder.decode(["uint256"], data).toString());

const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> =>
  (await (await BRE.ethers.getContract(contractName)).deploy(
    ...args
  )) as ContractType;

const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> =>
  (await (await BRE.ethers.getContract(contractName)).attach(
    address
  )) as ContractType;

export const deployExampleContract = async () =>
  await deployContract<Example>(eContractid.Example, []);

export const deployLendingPoolAddressesProvider = async () =>
  await deployContract<LendingPoolAddressesProvider>(
    eContractid.LendingPoolAddressesProvider,
    []
  );

export const getExampleContract = async (address?: tEthereumAddress) => {
  return await getContract<Example>(
    eContractid.Example,
    address ||
      (await getDb().get(`${eContractid.Example}.${BRE.network.name}`).value())
        .address
  );
};

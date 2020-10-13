import {task} from '@nomiclabs/buidler/config';
import {verifyContract, checkVerification} from '../../helpers/etherscan-verification';

interface VerifyParams {
  contractName: string;
  address: string;
  constructorArguments: string[];
  libraries: string;
}

task('verify-sc', 'Inits the BRE, to have access to all the plugins')
  .addParam('contractName', 'Name of the Solidity smart contract')
  .addParam('address', 'Ethereum address of the smart contract')
  .addOptionalParam(
    'libraries',
    'Stringified JSON object in format of {library1: "0x2956356cd2a2bf3202f771f50d3d14a367b48071"}'
  )
  .addOptionalVariadicPositionalParam(
    'constructorArguments',
    'arguments for contract constructor',
    []
  )
  .setAction(
    async (
      {contractName, address, constructorArguments = [], libraries}: VerifyParams,
      localBRE
    ) => {
      await localBRE.run('set-bre');

      checkVerification();

      const result = await verifyContract(contractName, address, constructorArguments, libraries);
      return result;
    }
  );

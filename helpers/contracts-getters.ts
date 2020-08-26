import {BRE} from './misc-utils';
import {ICommonConfiguration, eEthereumNetwork} from './types';
import {getParamPerNetwork} from './contracts-helpers';

export const getGenesisLendingPoolManagerAddress = async (config: ICommonConfiguration) => {
  const currentNetwork = BRE.network.name;
  const targetAddress = getParamPerNetwork(
    config.LendingPoolManagerAddress,
    <eEthereumNetwork>currentNetwork
  );
  if (targetAddress) {
    return targetAddress;
  }
  const addressList = await Promise.all(
    (await BRE.ethers.getSigners()).map((signer) => signer.getAddress())
  );
  const addressIndex = config.LendingPoolManagerAddressIndex;
  return addressList[addressIndex];
};

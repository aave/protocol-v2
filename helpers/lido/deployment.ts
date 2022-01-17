import ethers from 'ethers';
import {
  AStETHFactory,
  DefaultReserveInterestRateStrategyFactory,
  StableDebtStETHFactory,
  StETHMockedFactory,
  VariableDebtStETHFactory,
} from '../../types';
import { strategyStETH } from '../../markets/aave/reservesConfigs';
import { zeroAddress } from 'ethereumjs-util';
import { Addresses } from './aave-mainnet-contracts';

export async function deployStEthMock(deployer: ethers.Signer) {
  return new StETHMockedFactory(deployer).deploy();
}

export async function deployAStETH(
  lendingPoolAddress: string,
  stEthAddress: string,
  treasuryAddress: string,
  deployer: ethers.Signer,
  overrides?: ethers.Overrides
) {
  return new AStETHFactory(deployer).deploy(
    lendingPoolAddress,
    stEthAddress,
    treasuryAddress,
    'Aave interest bearing stETH',
    `astETH`,
    zeroAddress(),
    overrides
  );
}

export async function deployVariableDebtStETH(
  lendingPoolAddress: string,
  stEthAddress: string,
  deployer: ethers.Signer,
  overrides?: ethers.Overrides
) {
  return new VariableDebtStETHFactory(deployer).deploy(
    lendingPoolAddress,
    stEthAddress,
    'Aave variable debt bearing stETH',
    `variableDebtStETH`,
    zeroAddress(),
    overrides
  );
}

export async function deployStableDebtStETH(
  lendingPoolAddress: string,
  stEthMockedAddress: string,
  deployer: ethers.Signer,
  overrides?: ethers.Overrides
) {
  return new StableDebtStETHFactory(deployer).deploy(
    lendingPoolAddress,
    stEthMockedAddress,
    'Aave stable debt bearing stETH',
    `stableDebtStETH`,
    zeroAddress(),
    overrides
  );
}

export async function deployStEthInterestRateStrategy(
  deployer: ethers.Signer,
  overrides?: ethers.Overrides
) {
  return new DefaultReserveInterestRateStrategyFactory(deployer).deploy(
    Addresses.LendingPoolAddressesProvider,
    strategyStETH.optimalUtilizationRate,
    strategyStETH.baseVariableBorrowRate,
    strategyStETH.variableRateSlope1,
    strategyStETH.variableRateSlope2,
    strategyStETH.stableRateSlope1,
    strategyStETH.stableRateSlope2,
    overrides
  );
}

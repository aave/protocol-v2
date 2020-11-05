import {evmRevert, evmSnapshot, BRE} from '../../helpers/misc-utils';
import {Signer} from 'ethers';
import {
  getLendingPool,
  getLendingPoolAddressesProvider,
  getAaveProtocolTestHelpers,
  getAToken,
  getMintableErc20,
  getLendingPoolConfiguratorProxy,
  getPriceOracle,
  getLendingPoolAddressesProviderRegistry,
  getWETHMocked,
  getWETHGateway,
} from '../../helpers/contracts-getters';
import {tEthereumAddress} from '../../helpers/types';
import {LendingPool} from '../../types/LendingPool';
import {AaveProtocolTestHelpers} from '../../types/AaveProtocolTestHelpers';
import {MintableErc20 as MintableERC20} from '../../types/MintableErc20';
import {AToken} from '../../types/AToken';
import {LendingPoolConfigurator} from '../../types/LendingPoolConfigurator';

import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import {almostEqual} from './almost-equal';
import {PriceOracle} from '../../types/PriceOracle';
import {LendingPoolAddressesProvider} from '../../types/LendingPoolAddressesProvider';
import {LendingPoolAddressesProviderRegistry} from '../../types/LendingPoolAddressesProviderRegistry';
import {getEthersSigners} from '../../helpers/contracts-helpers';
import {Weth9} from '../../types/Weth9';
import {Weth9Mocked} from '../../types/Weth9Mocked';
import {WethGateway} from '../../types/WethGateway';
import {solidity} from 'ethereum-waffle';

chai.use(bignumberChai());
chai.use(almostEqual());
chai.use(solidity);

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  pool: LendingPool;
  configurator: LendingPoolConfigurator;
  oracle: PriceOracle;
  helpersContract: AaveProtocolTestHelpers;
  weth: Weth9Mocked;
  aWETH: AToken;
  dai: MintableERC20;
  aDai: AToken;
  usdc: MintableERC20;
  aave: MintableERC20;
  addressesProvider: LendingPoolAddressesProvider;
  registry: LendingPoolAddressesProviderRegistry;
  wethGateway: WethGateway;
}

let buidlerevmSnapshotId: string = '0x1';
const setBuidlerevmSnapshotId = (id: string) => {
  if (BRE.network.name === 'buidlerevm') {
    buidlerevmSnapshotId = id;
  }
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  pool: {} as LendingPool,
  configurator: {} as LendingPoolConfigurator,
  helpersContract: {} as AaveProtocolTestHelpers,
  oracle: {} as PriceOracle,
  weth: {} as Weth9Mocked,
  aWETH: {} as AToken,
  dai: {} as MintableERC20,
  aDai: {} as AToken,
  usdc: {} as MintableERC20,
  aave: {} as MintableERC20,
  addressesProvider: {} as LendingPoolAddressesProvider,
  registry: {} as LendingPoolAddressesProviderRegistry,
  wethGateway: {} as WethGateway,
} as TestEnv;

export async function initializeMakeSuite() {
  const [_deployer, ...restSigners] = await getEthersSigners();
  const deployer: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  for (const signer of restSigners) {
    testEnv.users.push({
      signer,
      address: await signer.getAddress(),
    });
  }
  testEnv.deployer = deployer;
  testEnv.pool = await getLendingPool();

  testEnv.configurator = await getLendingPoolConfiguratorProxy();

  testEnv.oracle = await getPriceOracle();
  testEnv.addressesProvider = await getLendingPoolAddressesProvider();
  testEnv.registry = await getLendingPoolAddressesProviderRegistry();

  testEnv.helpersContract = await getAaveProtocolTestHelpers();

  const allTokens = await testEnv.helpersContract.getAllATokens();

  const aDaiAddress = allTokens.find((aToken) => aToken.symbol === 'aDAI')?.tokenAddress;

  const aWEthAddress = allTokens.find((aToken) => aToken.symbol === 'aWETH')?.tokenAddress;

  const reservesTokens = await testEnv.helpersContract.getAllReservesTokens();

  const daiAddress = reservesTokens.find((token) => token.symbol === 'DAI')?.tokenAddress;
  const usdcAddress = reservesTokens.find((token) => token.symbol === 'USDC')?.tokenAddress;
  const aaveAddress = reservesTokens.find((token) => token.symbol === 'AAVE')?.tokenAddress;
  const wethAddress = reservesTokens.find((token) => token.symbol === 'WETH')?.tokenAddress;

  if (!aDaiAddress || !aWEthAddress) {
    console.log(`atoken-modifiers.spec: aTokens not correctly initialized`);
    process.exit(1);
  }
  if (!daiAddress || !usdcAddress || !aaveAddress || !wethAddress) {
    console.log(`atoken-modifiers.spec: USDC or DAI not correctly initialized`);
    process.exit(1);
  }

  testEnv.aDai = await getAToken(aDaiAddress);
  testEnv.aWETH = await getAToken(aWEthAddress);

  testEnv.dai = await getMintableErc20(daiAddress);
  testEnv.usdc = await getMintableErc20(usdcAddress);
  testEnv.aave = await getMintableErc20(aaveAddress);
  testEnv.weth = await getWETHMocked(wethAddress);
  testEnv.wethGateway = await getWETHGateway();
}

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      setBuidlerevmSnapshotId(await evmSnapshot());
    });
    tests(testEnv);
    after(async () => {
      await evmRevert(buidlerevmSnapshotId);
    });
  });
}

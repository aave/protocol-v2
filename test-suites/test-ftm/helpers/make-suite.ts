import {
  evmRevert,
  evmSnapshot,
  DRE,
  impersonateAccountsHardhat,
} from '../../../helpers/misc-utils';
import { Signer } from 'ethers';
import {
  getLendingPool,
  getLendingPoolAddressesProvider,
  getSturdyProtocolDataProvider,
  getAToken,
  getMintableERC20,
  getLendingPoolConfiguratorProxy,
  getPriceOracle,
  getLendingPoolAddressesProviderRegistry,
  getSturdyIncentivesController,
  getSturdyToken,
  getFirstSigner,
  getYearnVault,
  getBeefyETHVault,
  getSwapinERC20,
  getYearnWETHVault,
  getYearnWBTCVault,
  getYearnBOOVault,
  getTombFtmBeefyVault,
  getTombMiMaticBeefyVault,
  getYearnFBEETSVault,
  getYearnLINKVault,
  getYearnCRVVault,
  getYearnSPELLVault,
  getBasedMiMaticBeefyVault,
  getFTMLiquidator,
} from '../../../helpers/contracts-getters';
import { eNetwork, IFantomConfiguration, tEthereumAddress } from '../../../helpers/types';
import { LendingPool } from '../../../types/LendingPool';
import { SturdyProtocolDataProvider } from '../../../types/SturdyProtocolDataProvider';
import { MintableERC20 } from '../../../types/MintableERC20';
import { SwapinERC20 } from '../../../types/SwapinERC20';
import { AToken } from '../../../types/AToken';
import { LendingPoolConfigurator } from '../../../types/LendingPoolConfigurator';

import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { almostEqual } from './almost-equal';
import { PriceOracle } from '../../../types/PriceOracle';
import { LendingPoolAddressesProvider } from '../../../types/LendingPoolAddressesProvider';
import { LendingPoolAddressesProviderRegistry } from '../../../types/LendingPoolAddressesProviderRegistry';
import { getEthersSigners } from '../../../helpers/contracts-helpers';
import { getParamPerNetwork } from '../../../helpers/contracts-helpers';
import { solidity } from 'ethereum-waffle';
import { SturdyConfig } from '../../../markets/sturdy';
import {
  StakedTokenIncentivesController,
  SturdyToken,
  YearnVault,
  BeefyETHVault,
  YearnWETHVault,
  YearnWBTCVault,
  YearnBOOVault,
  TombFtmBeefyVault,
  TombMimaticBeefyVault,
  YearnFBEETSVault,
  YearnLINKVault,
  YearnCRVVault,
  YearnSPELLVault,
  BasedMimaticBeefyVault,
} from '../../../types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { usingTenderly } from '../../../helpers/tenderly-utils';
import { ConfigNames, loadPoolConfig } from '../../../helpers/configuration';
import { IERC20Detailed } from '../../../types/IERC20Detailed';
import { IERC20DetailedFactory } from '../../../types/IERC20DetailedFactory';
import { parseEther } from '@ethersproject/units';
import { ILiquidator } from '../../../types/ILiquidator';

chai.use(bignumberChai());
chai.use(almostEqual());
chai.use(solidity);

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  deployer: SignerWithAddress;
  emergencyUser: SignerWithAddress;
  users: SignerWithAddress[];
  pool: LendingPool;
  yearnVault: YearnVault;
  beefyETHVault: BeefyETHVault;
  yearnWETHVault: YearnWETHVault;
  yearnWBTCVault: YearnWBTCVault;
  yearnBOOVault: YearnBOOVault;
  TombFtmBeefyVault: TombFtmBeefyVault;
  TombMiMaticBeefyVault: TombMimaticBeefyVault;
  BasedMiMaticBeefyVault: BasedMimaticBeefyVault;
  yearnFBEETSVault: YearnFBEETSVault;
  yearnLINKVault: YearnLINKVault;
  yearnCRVVault: YearnCRVVault;
  yearnSPELLVault: YearnSPELLVault;
  incentiveController: StakedTokenIncentivesController;
  configurator: LendingPoolConfigurator;
  oracle: PriceOracle;
  helpersContract: SturdyProtocolDataProvider;
  dai: MintableERC20;
  aDai: AToken;
  usdt: MintableERC20;
  usdc: SwapinERC20;
  aUsdc: AToken;
  aUsdt: AToken;
  aYVWFTM: AToken;
  aYVWETH: AToken;
  aYVWBTC: AToken;
  aYVBOO: AToken;
  aMooTOMB_FTM: AToken;
  aMooTOMB_MIMATIC: AToken;
  aMooBASED_MIMATIC: AToken;
  aYVFBEETS: AToken;
  aYVLINK: AToken;
  aYVCRV: AToken;
  aYVSPELL: AToken;
  aMOOWETH: AToken;
  WFTM: MintableERC20;
  WETH: SwapinERC20;
  WBTC: SwapinERC20;
  BOO: MintableERC20;
  TOMB_FTM_LP: MintableERC20;
  TOMB_MIMATIC_LP: MintableERC20;
  BASED_MIMATIC_LP: MintableERC20;
  fBEETS: MintableERC20;
  BEETS: MintableERC20;
  LINK: MintableERC20;
  CRV: MintableERC20;
  SPELL: MintableERC20;
  brick: SturdyToken;
  yvwftm: IERC20Detailed;
  yvweth: IERC20Detailed;
  yvwbtc: IERC20Detailed;
  yvboo: IERC20Detailed;
  mootomb_ftm: IERC20Detailed;
  mootomb_mimatic: IERC20Detailed;
  moobased_mimatic: IERC20Detailed;
  yvfbeets: IERC20Detailed;
  yvlink: IERC20Detailed;
  yvcrv: IERC20Detailed;
  yvspell: IERC20Detailed;
  mooweth: IERC20Detailed;
  addressesProvider: LendingPoolAddressesProvider;
  registry: LendingPoolAddressesProviderRegistry;
  registryOwnerSigner: Signer;
  liquidator: ILiquidator;
}

let buidlerevmSnapshotId: string = '0x1';
const setBuidlerevmSnapshotId = (id: string) => {
  buidlerevmSnapshotId = id;
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  emergencyUser: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  pool: {} as LendingPool,
  yearnVault: {} as YearnVault,
  beefyETHVault: {} as BeefyETHVault,
  yearnWETHVault: {} as YearnWETHVault,
  yearnWBTCVault: {} as YearnWBTCVault,
  yearnBOOVault: {} as YearnBOOVault,
  TombFtmBeefyVault: {} as TombFtmBeefyVault,
  TombMiMaticBeefyVault: {} as TombMimaticBeefyVault,
  BasedMiMaticBeefyVault: {} as BasedMimaticBeefyVault,
  yearnLINKVault: {} as YearnLINKVault,
  yearnCRVVault: {} as YearnCRVVault,
  yearnSPELLVault: {} as YearnSPELLVault,
  incentiveController: {} as StakedTokenIncentivesController,
  configurator: {} as LendingPoolConfigurator,
  helpersContract: {} as SturdyProtocolDataProvider,
  oracle: {} as PriceOracle,
  dai: {} as MintableERC20,
  aDai: {} as AToken,
  usdc: {} as SwapinERC20,
  usdt: {} as MintableERC20,
  aUsdc: {} as AToken,
  aUsdt: {} as AToken,
  aYVWFTM: {} as AToken,
  aYVWETH: {} as AToken,
  aYVWBTC: {} as AToken,
  aYVBOO: {} as AToken,
  aMooTOMB_FTM: {} as AToken,
  aMooTOMB_MIMATIC: {} as AToken,
  aMooBASED_MIMATIC: {} as AToken,
  aYVFBEETS: {} as AToken,
  aYVLINK: {} as AToken,
  aYVCRV: {} as AToken,
  aYVSPELL: {} as AToken,
  aMOOWETH: {} as AToken,
  WFTM: {} as MintableERC20,
  WETH: {} as SwapinERC20,
  WBTC: {} as SwapinERC20,
  BOO: {} as MintableERC20,
  TOMB_FTM_LP: {} as MintableERC20,
  TOMB_MIMATIC_LP: {} as MintableERC20,
  BASED_MIMATIC_LP: {} as MintableERC20,
  fBEETS: {} as MintableERC20,
  BEETS: {} as MintableERC20,
  LINK: {} as MintableERC20,
  CRV: {} as MintableERC20,
  SPELL: {} as MintableERC20,
  brick: {} as SturdyToken,
  yvwftm: {} as IERC20Detailed,
  yvweth: {} as IERC20Detailed,
  yvwbtc: {} as IERC20Detailed,
  yvboo: {} as IERC20Detailed,
  mootomb_ftm: {} as IERC20Detailed,
  mootomb_mimatic: {} as IERC20Detailed,
  moobased_mimatic: {} as IERC20Detailed,
  yvfbeets: {} as IERC20Detailed,
  yvlink: {} as IERC20Detailed,
  yvcrv: {} as IERC20Detailed,
  yvspell: {} as IERC20Detailed,
  mooweth: {} as IERC20Detailed,
  addressesProvider: {} as LendingPoolAddressesProvider,
  registry: {} as LendingPoolAddressesProviderRegistry,
  liquidator: {} as ILiquidator,
} as TestEnv;

export async function initializeMakeSuite() {
  // Mainnet missing addresses
  const poolConfig = loadPoolConfig(ConfigNames.Fantom) as IFantomConfiguration;
  const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>DRE.network.name;
  const yvwftmAddress = getParamPerNetwork(poolConfig.YearnVaultFTM, network);
  const moowethAddress = getParamPerNetwork(poolConfig.BeefyETHVault, network);
  const yvwethAddress = getParamPerNetwork(poolConfig.YearnWETHVaultFTM, network);
  const yvwbtcAddress = getParamPerNetwork(poolConfig.YearnWBTCVaultFTM, network);
  const yvbooAddress = getParamPerNetwork(poolConfig.YearnBOOVaultFTM, network);
  const mooTombFtmAddress = getParamPerNetwork(poolConfig.BeefyVaultTOMB_FTM, network);
  const mooTombMiMaticAddress = getParamPerNetwork(poolConfig.BeefyVaultTOMB_MIMATIC, network);
  const mooBasedMiMaticAddress = getParamPerNetwork(poolConfig.BeefyVaultBASED_MIMATIC, network);
  const yvfbeetsAddress = getParamPerNetwork(poolConfig.YearnFBEETSVaultFTM, network);
  const yvlinkAddress = getParamPerNetwork(poolConfig.YearnLINKVaultFTM, network);
  const yvcrvAddress = getParamPerNetwork(poolConfig.YearnCRVVaultFTM, network);
  const yvspellAddress = getParamPerNetwork(poolConfig.YearnSPELLVaultFTM, network);
  const wftmAddress = getParamPerNetwork(poolConfig.WFTM, network);
  const wethAddress = getParamPerNetwork(poolConfig.WETH, network);
  const wbtcAddress = getParamPerNetwork(poolConfig.WBTC, network);
  const booAddress = getParamPerNetwork(poolConfig.BOO, network);
  const tombFtmLPAddress = getParamPerNetwork(poolConfig.TOMB_FTM_LP, network);
  const tombMiMaticLPAddress = getParamPerNetwork(poolConfig.TOMB_MIMATIC_LP, network);
  const basedMiMaticLPAddress = getParamPerNetwork(poolConfig.BASED_MIMATIC_LP, network);
  const fbeetsAddress = getParamPerNetwork(poolConfig.fBEETS, network);
  const beetsAddress = getParamPerNetwork(poolConfig.BEETS, network);
  const linkAddress = getParamPerNetwork(poolConfig.LINK, network);
  const crvAddress = getParamPerNetwork(poolConfig.CRV, network);
  const spellAddress = getParamPerNetwork(poolConfig.SPELL, network);

  const [_deployer, ...restSigners] = await getEthersSigners();
  let deployer: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  let emergencyUser: SignerWithAddress = {
    address: await restSigners[0].getAddress(),
    signer: restSigners[0],
  };

  if (network == 'ftm_test') {
    const deployerAddress = '0x661fB502E24Deb30e927E39A38Bd2CC44D67339F';
    const ethers = (DRE as any).ethers;
    await impersonateAccountsHardhat([deployerAddress]);
    let signer = await ethers.provider.getSigner(deployerAddress);
    deployer = {
      address: deployerAddress,
      signer: signer,
    };

    await _deployer.sendTransaction({ value: parseEther('9000'), to: deployerAddress });

    const emergencyAddress = '0x05d75FB9db95AfC448d9F79c016ab027320acEc7';
    await impersonateAccountsHardhat([emergencyAddress]);
    signer = await ethers.provider.getSigner(emergencyAddress);

    emergencyUser = {
      address: emergencyAddress,
      signer: signer,
    };

    await _deployer.sendTransaction({ value: parseEther('9000'), to: emergencyAddress });
  } else if (network == 'ftm' && process.env.SKIP_DEPLOY) {
    const deployerAddress = '0x48Cc0719E3bF9561D861CB98E863fdA0CEB07Dbc';
    // const deployerAddress = '0xb4124ceb3451635dacedd11767f004d8a28c6ee7';
    const ethers = (DRE as any).ethers;
    await impersonateAccountsHardhat([deployerAddress]);
    let signer = await ethers.provider.getSigner(deployerAddress);
    deployer = {
      address: deployerAddress,
      signer: signer,
    };

    await _deployer.sendTransaction({ value: parseEther('9000'), to: deployerAddress });

    const emergencyAddress = '0xc4bb97d8c974221faed7b023736b990cA3EF1C5d';
    await impersonateAccountsHardhat([emergencyAddress]);
    signer = await ethers.provider.getSigner(emergencyAddress);

    emergencyUser = {
      address: emergencyAddress,
      signer: signer,
    };

    await _deployer.sendTransaction({ value: parseEther('9000'), to: emergencyAddress });
  }

  for (const signer of restSigners) {
    testEnv.users.push({
      signer,
      address: await signer.getAddress(),
    });
  }
  testEnv.deployer = deployer;
  testEnv.emergencyUser = emergencyUser;
  testEnv.pool = await getLendingPool();
  testEnv.yearnVault = await getYearnVault();
  testEnv.beefyETHVault = await getBeefyETHVault();
  testEnv.yearnWETHVault = await getYearnWETHVault();
  testEnv.yearnWBTCVault = await getYearnWBTCVault();
  testEnv.yearnBOOVault = await getYearnBOOVault();
  testEnv.TombFtmBeefyVault = await getTombFtmBeefyVault();
  testEnv.TombMiMaticBeefyVault = await getTombMiMaticBeefyVault();
  testEnv.BasedMiMaticBeefyVault = await getBasedMiMaticBeefyVault();
  testEnv.yearnFBEETSVault = await getYearnFBEETSVault();
  testEnv.yearnLINKVault = await getYearnLINKVault();
  testEnv.yearnCRVVault = await getYearnCRVVault();
  testEnv.yearnSPELLVault = await getYearnSPELLVault();
  testEnv.incentiveController = await getSturdyIncentivesController();
  // testEnv.liquidator = await getFTMLiquidator();

  testEnv.configurator = await getLendingPoolConfiguratorProxy();

  testEnv.addressesProvider = await getLendingPoolAddressesProvider();

  if (process.env.FORK) {
    testEnv.registry = await getLendingPoolAddressesProviderRegistry(
      getParamPerNetwork(SturdyConfig.ProviderRegistry, process.env.FORK as eNetwork)
    );
    testEnv.oracle = await getPriceOracle(await testEnv.addressesProvider.getPriceOracle());

    const providerRegistryOwner = getParamPerNetwork(
      poolConfig.ProviderRegistryOwner,
      process.env.FORK as eNetwork
    );
    if (!providerRegistryOwner) testEnv.registryOwnerSigner = await getFirstSigner();
    else testEnv.registryOwnerSigner = DRE.ethers.provider.getSigner(providerRegistryOwner);
  } else {
    testEnv.registry = await getLendingPoolAddressesProviderRegistry();
    testEnv.oracle = await getPriceOracle();
  }

  testEnv.helpersContract = await getSturdyProtocolDataProvider();

  const allTokens = await testEnv.helpersContract.getAllATokens();
  const aDaiAddress = allTokens.find((aToken) => aToken.symbol === 'aDAI' || aToken.symbol === 'sDAI')?.tokenAddress;

  const aYVWFTMAddress = allTokens.find((aToken) => aToken.symbol === 'ayvWFTM' || aToken.symbol === 'syvWFTM')?.tokenAddress;
  const aYVWETHAddress = allTokens.find((aToken) => aToken.symbol === 'ayvWETH' || aToken.symbol === 'syvWETH')?.tokenAddress;
  let aYVWBTCAddress;   // tempcode for fantom testnet, because it has same name ayvWBTC token.
  if (allTokens.filter((aToken) => aToken.symbol === 'ayvWBTC' || aToken.symbol === 'syvWBTC').length > 1)
    aYVWBTCAddress = allTokens.filter((aToken) => aToken.symbol === 'ayvWBTC' || aToken.symbol === 'syvWBTC')[1].tokenAddress;
  else
    aYVWBTCAddress = allTokens.find((aToken) => aToken.symbol === 'ayvWBTC' || aToken.symbol === 'syvWBTC')?.tokenAddress;
  const aYVBOOAddress = allTokens.find((aToken) => aToken.symbol === 'ayvBOO' || aToken.symbol === 'syvBOO')?.tokenAddress;
  const aMooTOMB_FTM_Address = allTokens.find((aToken) => aToken.symbol === 'amooTOMB_FTM' || aToken.symbol === 'smooTOMB_FTM')?.tokenAddress;
  const aMooTOMB_MIMATIC_Address = allTokens.find((aToken) => aToken.symbol === 'amooTOMB_MIMATIC' || aToken.symbol === 'smooTOMB_MIMATIC')?.tokenAddress;
  const aMooBASED_MIMATIC_Address = allTokens.find((aToken) => aToken.symbol === 'amooBASED_MIMATIC' || aToken.symbol === 'smooBASED_MIMATIC')?.tokenAddress;
  const aYVFBEETSAddress = allTokens.find((aToken) => aToken.symbol === 'ayvfBEETS' || aToken.symbol === 'syvfBEETS')?.tokenAddress;
  const aYVLINKAddress = allTokens.find((aToken) => aToken.symbol === 'ayvLINK' || aToken.symbol === 'syvLINK')?.tokenAddress;
  const aYVCRVAddress = allTokens.find((aToken) => aToken.symbol === 'ayvCRV' || aToken.symbol === 'syvCRV')?.tokenAddress;
  const aYVSPELLAddress = allTokens.find((aToken) => aToken.symbol === 'ayvSPELL' || aToken.symbol === 'syvSPELL')?.tokenAddress;
  
  const aMOOWETHAddress = allTokens.find((aToken) => aToken.symbol === 'amooWETH' || aToken.symbol === 'smooWETH')?.tokenAddress;
  const aUsdcAddress = allTokens.find((aToken) => aToken.symbol === 'aUSDC' || aToken.symbol === 'sUSDC')?.tokenAddress;
  const aUsdtAddress = allTokens.find((aToken) => aToken.symbol === 'afUSDT' || aToken.symbol === 'sfUSDT')?.tokenAddress;

  const reservesTokens = await testEnv.helpersContract.getAllReservesTokens();

  const daiAddress = reservesTokens.find((token) => token.symbol === 'DAI')?.tokenAddress;
  const usdcAddress = reservesTokens.find((token) => token.symbol === 'USDC')?.tokenAddress;
  const usdtAddress = reservesTokens.find((token) => token.symbol ===  (network == 'ftm_test' ? 'USDT' : 'fUSDT'))?.tokenAddress;

  if (!aDaiAddress || !aUsdcAddress || !aUsdtAddress || !aYVWFTMAddress || 
      !aYVWETHAddress || !aYVWBTCAddress || !aYVBOOAddress || !aMooTOMB_FTM_Address ||
      !aMooTOMB_MIMATIC_Address || !aMooBASED_MIMATIC_Address  || !aYVFBEETSAddress || !aYVLINKAddress ||
      !aYVCRVAddress || !aYVSPELLAddress) {
    process.exit(1);
  }
  if (!daiAddress || !usdcAddress || !usdtAddress) {
    process.exit(1);
  }

  testEnv.aDai = await getAToken(aDaiAddress);
  testEnv.aYVWFTM = await getAToken(aYVWFTMAddress);
  testEnv.aYVWETH = await getAToken(aYVWETHAddress);
  testEnv.aYVWBTC = await getAToken(aYVWBTCAddress);
  testEnv.aYVBOO = await getAToken(aYVBOOAddress);
  testEnv.aMooTOMB_FTM = await getAToken(aMooTOMB_FTM_Address)
  testEnv.aMooTOMB_MIMATIC = await getAToken(aMooTOMB_MIMATIC_Address)
  testEnv.aMooBASED_MIMATIC = await getAToken(aMooBASED_MIMATIC_Address)
  testEnv.aYVFBEETS = await getAToken(aYVFBEETSAddress);
  testEnv.aYVLINK = await getAToken(aYVLINKAddress);
  testEnv.aYVCRV = await getAToken(aYVCRVAddress);
  testEnv.aYVSPELL = await getAToken(aYVSPELLAddress);
  testEnv.aMOOWETH = await getAToken(aMOOWETHAddress);
  testEnv.aUsdc = await getAToken(aUsdcAddress);
  testEnv.aUsdt = await getAToken(aUsdtAddress);

  testEnv.dai = await getMintableERC20(daiAddress);
  testEnv.usdc = await getSwapinERC20(usdcAddress);
  testEnv.usdt = await getMintableERC20(usdtAddress);
  testEnv.WFTM = await getMintableERC20(wftmAddress);
  testEnv.WETH = await getSwapinERC20(wethAddress);
  testEnv.WBTC = await getSwapinERC20(wbtcAddress);
  testEnv.BOO = await getMintableERC20(booAddress);
  testEnv.TOMB_FTM_LP = await getMintableERC20(tombFtmLPAddress);
  testEnv.TOMB_MIMATIC_LP = await getMintableERC20(tombMiMaticLPAddress);
  testEnv.BASED_MIMATIC_LP = await getMintableERC20(basedMiMaticLPAddress);
  testEnv.fBEETS = await getMintableERC20(fbeetsAddress);
  testEnv.BEETS = await getMintableERC20(beetsAddress);
  testEnv.LINK = await getMintableERC20(linkAddress);
  testEnv.CRV = await getMintableERC20(crvAddress);
  testEnv.SPELL = await getMintableERC20(spellAddress);
  testEnv.brick = await getSturdyToken();
  testEnv.yvwftm = IERC20DetailedFactory.connect(yvwftmAddress, deployer.signer);
  testEnv.yvweth = IERC20DetailedFactory.connect(yvwethAddress, deployer.signer);
  testEnv.yvwbtc = IERC20DetailedFactory.connect(yvwbtcAddress, deployer.signer);
  testEnv.yvboo = IERC20DetailedFactory.connect(yvbooAddress, deployer.signer);
  testEnv.mootomb_ftm = IERC20DetailedFactory.connect(mooTombFtmAddress, deployer.signer);
  testEnv.mootomb_mimatic = IERC20DetailedFactory.connect(mooTombMiMaticAddress, deployer.signer);
  testEnv.moobased_mimatic = IERC20DetailedFactory.connect(mooBasedMiMaticAddress, deployer.signer);
  testEnv.yvfbeets = IERC20DetailedFactory.connect(yvfbeetsAddress, deployer.signer);
  testEnv.yvlink = IERC20DetailedFactory.connect(yvlinkAddress, deployer.signer);
  testEnv.yvcrv = IERC20DetailedFactory.connect(yvcrvAddress, deployer.signer);
  testEnv.yvspell = IERC20DetailedFactory.connect(yvspellAddress, deployer.signer);
  testEnv.mooweth = IERC20DetailedFactory.connect(moowethAddress, deployer.signer);
}

const setSnapshot = async () => {
  const hre = DRE as HardhatRuntimeEnvironment;
  if (usingTenderly()) {
    setBuidlerevmSnapshotId((await hre.tenderlyNetwork.getHead()) || '0x1');
    return;
  }
  setBuidlerevmSnapshotId(await evmSnapshot());
};

const revertHead = async () => {
  const hre = DRE as HardhatRuntimeEnvironment;
  if (usingTenderly()) {
    await hre.tenderlyNetwork.setHead(buidlerevmSnapshotId);
    return;
  }
  await evmRevert(buidlerevmSnapshotId);
};

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      if (DRE.network.name != 'goerli') await setSnapshot();
    });
    tests(testEnv);
    after(async () => {
      if (DRE.network.name != 'goerli') await revertHead();
    });
  });
}

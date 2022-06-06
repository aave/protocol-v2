import BigNumber from 'bignumber.js';
import { parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { oneRay } from '../../helpers/constants';
import {
  deployMintableERC20,
  deployMockBOOForFTM,
  deployMockMooTOMBFTM,
  deployMockMooTOMBMIMATIC,
  deployMockWBTCForFTM,
  deployMockWETHForFTM,
  deployMockyvBOO,
  deployMockyvWBTC,
  deployMockyvWETH,
  deployMockyvWFTM,
  deployMockYearnVault,
  deployMockBeefyVault,
  deployMockMooBASEDMIMATIC,
  deployDefaultReserveInterestRateStrategy,
} from '../../helpers/contracts-deployments';
import {
  getFirstSigner,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getMintableERC20,
  getSwapinERC20,
} from '../../helpers/contracts-getters';
import {
  convertToCurrencyDecimals,
  getParamPerNetwork,
  verifyContract,
} from '../../helpers/contracts-helpers';
import { verifyEtherscanContract } from '../../helpers/etherscan-verification';
import { eNetwork, IFantomConfiguration, eContractid } from '../../helpers/types';
import { DaiFactory } from '../../types';

task('sturdy:testnet:ftm:mockVaults', 'Deploy dai token')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');

    const poolConfig = loadPoolConfig(ConfigNames.Fantom) as IFantomConfiguration;
    const network = process.env.FORK ? <eNetwork>process.env.FORK : <eNetwork>DRE.network.name;
    const sender = await (await getFirstSigner()).getAddress();
    const wftmAddress = getParamPerNetwork(poolConfig.WFTM, network);
    const wethAddress = getParamPerNetwork(poolConfig.WETH, network);
    const wbtcAddress = getParamPerNetwork(poolConfig.WBTC, network);
    const booAddress = getParamPerNetwork(poolConfig.BOO, network);
    const tombFtmLPAddress = getParamPerNetwork(poolConfig.TOMB_FTM_LP, network);
    const tombMiMaticLPAddress = getParamPerNetwork(poolConfig.TOMB_MIMATIC_LP, network);
    const basedMiMaticLPAddress = getParamPerNetwork(poolConfig.BASED_MIMATIC_LP, network);
    const linkAddress = getParamPerNetwork(poolConfig.LINK, network);
    const fbeetsAddress = getParamPerNetwork(poolConfig.fBEETS, network);
    const crvAddress = getParamPerNetwork(poolConfig.CRV, network);
    const spellAddress = getParamPerNetwork(poolConfig.SPELL, network);

    // // Frozen vault on testnet: TOMB_MIMATIC_LP, TOMB_FTM_LP
    // const configurator = await getLendingPoolConfiguratorProxy();
    // await configurator.freezeReserve('0x53F26e11497A3632CC58F88957C1761925f753B0');

    // const addressProvider = await getLendingPoolAddressesProvider();
    // await deployDefaultReserveInterestRateStrategy([
    //     addressProvider.address,
    //     new BigNumber(0.9).multipliedBy(oneRay).toFixed(),
    //     '0',
    //     '0',
    //     new BigNumber(0.4).multipliedBy(oneRay).toFixed(),
    //     '0',
    //     '0',
    //   ],
    //   verify
    // );
    // console.log('Deploying MockyvWFTM started\n');
    // const yvWFTM = await deployMockyvWFTM(
    //   [wftmAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvWFTM address `, yvWFTM.address);

    // console.log('Deploying MockyvWETH started\n');
    // const yvWETH = await deployMockyvWETH(
    //   [wethAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvWETH address `, yvWETH.address);

    // console.log('Deploying MockyvWBTC started\n');
    // const yvWBTC = await deployMockyvWBTC(
    //   [wbtcAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvWBTC address `, yvWBTC.address);

    // console.log('Deploying MockyvBOO started\n');
    // const yvBOO = await deployMockyvBOO(
    //   [booAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvBOO address `, yvBOO.address);

    // console.log('Deploying MockMooTOMBFTM started\n');
    // const mooTOMB_FTM = await deployMockMooTOMBFTM(
    //   [tombFtmLPAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockMooTOMBFTM address `, mooTOMB_FTM.address);

    // console.log('Deploying MockMooTOMBMIMATIC started\n');
    // const mooTOMB_MIMATIC = await deployMockMooTOMBMIMATIC(
    //   [tombMiMaticLPAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockMooTOMBMIMATIC address `, mooTOMB_MIMATIC.address);

    // console.log('Deploying MockMooBASEDMIMATIC started\n');
    // const mooBASED_MIMATIC = await deployMockMooBASEDMIMATIC(
    //   [basedMiMaticLPAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockMooBASEDMIMATIC address `, mooBASED_MIMATIC.address);

    // console.log('Deploying MockyvLINK started\n');
    // const yvLINK = await deployMockYearnVault(
    //   eContractid.MockLINKForFTM,
    //   [linkAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvLINK`, yvLINK.address);

    // console.log('Deploying MockyvfBEETS started\n');
    // const yvfBEETS = await deployMockYearnVault(
    //   eContractid.MockFBEETSForFTM,
    //   [fbeetsAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvfBEETS`, yvfBEETS.address);

    // console.log('Deploying MockMooETH started\n');
    // const mooWETH = await deployMockBeefyVault(
    //   eContractid.MockBeeefyETHForFTM,
    //   [wethAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockMooETH`, mooWETH.address);

    // console.log('Deploying MockyvCRV started\n');
    // const yvCRV = await deployMockYearnVault(
    //   eContractid.MockCRVForFTM,
    //   [crvAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvCRV`, yvCRV.address);

    // console.log('Deploying MockyvSPELL started\n');
    // const yvSPELL = await deployMockYearnVault(
    //   eContractid.MockSPELLForFTM,
    //   [spellAddress, sender, sender, '', '', sender, sender],
    //   verify
    // );
    // console.log(`MockyvSPELL`, yvSPELL.address);
    // console.log('Deploying MockBASEDMIMATICLP started\n');
    // const BASED_MIMATIC_LP = await deployMintableERC20(
    //   ['BASED-MIMATIC LP', 'BASED-MIMATIC', '18'],
    //   verify
    // );

    // await BASED_MIMATIC_LP.mint(
    //   await convertToCurrencyDecimals(BASED_MIMATIC_LP.address, '20000000')
    // );
    // console.log(`MockBASEDMIMATICLP address `, BASED_MIMATIC_LP.address);

    // console.log('Deploying MockBASED started\n');
    // const BASED = await deployMintableERC20(
    //   ['BASED', 'BASED', '18'],
    //   verify
    // );

    // await BASED.mint(
    //   await convertToCurrencyDecimals(BASED.address, '20000000')
    // );
    // console.log(`MockBASED address `, BASED.address);

    // console.log('Deploying MockTOMBMIMATICLP started\n');
    // const TOMB_MIMATIC_LP = await deployMintableERC20(
    //   ['TOMB-MIMATIC LP', 'TOMB-MIMATIC', '18'],
    //   verify
    // );

    // await TOMB_MIMATIC_LP.mint(
    //   await convertToCurrencyDecimals(TOMB_MIMATIC_LP.address, '20000000')
    // );
    // console.log(`MockTOMBMIMATICLP address `, TOMB_MIMATIC_LP.address);

    // console.log('Deploying MockMIMATIC started\n');
    // const MIMATIC = await deployMintableERC20(
    //   ['MIMATIC', 'MIMATIC', '18'],
    //   verify
    // );

    // await MIMATIC.mint(
    //   await convertToCurrencyDecimals(MIMATIC.address, '20000000')
    // );
    // console.log(`MockMIMATIC address `, MIMATIC.address);

    // console.log('Deploying MockTOMBFTMLP started\n');
    // const TOMB_FTM_LP = await deployMintableERC20(
    //   ['TOMB-FTM LP', 'TOMB-FTM', '18'],
    //   verify
    // );

    // await TOMB_FTM_LP.mint(
    //   await convertToCurrencyDecimals(TOMB_FTM_LP.address, '20000000')
    // );
    // console.log(`MockTOMBFTMLP address `, TOMB_FTM_LP.address);

    // console.log('Deploying MockTOMB started\n');
    // const TOMB = await deployMintableERC20(
    //   ['TOMB', 'TOMB', '18'],
    //   verify
    // );

    // await TOMB.mint(
    //   await convertToCurrencyDecimals(TOMB.address, '20000000')
    // );
    // console.log(`MockTOMB address `, TOMB.address);

    // console.log('Deploying MockBOO started\n');
    // const BOO = await deployMockBOOForFTM(
    //   ['BOO', 'BOO', '18', sender],
    //   verify
    // );

    // await BOO.Swapin(
    //   "0x288f6dec7d6165b3513dbeafa36332f35b9946943ebb362c387cc7956dc16ec5",
    //   sender,
    //   parseEther('100000000000000000')
    // );
    // console.log(`MockBOO address `, BOO.address);

    // console.log('Deploying MockWETH started\n');
    // const WETH = await deployMockWETHForFTM(
    //   ['Wrapped ETH', 'WETH', '18', sender],
    //   verify
    // );

    // await WETH.Swapin(
    //   "0x288f6dec7d6165b3513dbeafa36332f35b9946943ebb362c387cc7956dc16ec5",
    //   sender,
    //   parseEther('1000000')
    // );
    // console.log(`MockWETH address `, WETH.address);

    // console.log('Deploying MockWBTC started\n');
    // const WBTC = await deployMockWBTCForFTM(
    //   ['Wrapped BTC', 'WBTC', '8', sender],
    //   verify
    // );

    // await WBTC.Swapin(
    //   "0x288f6dec7d6165b3513dbeafa36332f35b9946943ebb362c387cc7956dc16ec5",
    //   sender,
    //   await convertToCurrencyDecimals(WBTC.address, '1000')
    // );
    // console.log(`MockWBTC address `, WBTC.address);

    // const usdc = await getSwapinERC20('0x8f785910e0cc96f854450DFb53be6492daff0b15');
    // await usdc.Swapin(
    //   "0x288f6dec7d6165b3513dbeafa36332f35b9946943ebb362c387cc7956dc16ec5",
    //   sender,
    //   await convertToCurrencyDecimals(usdc.address, '20000000')
    // );
    // const usdt = await getSwapinERC20('0x211554151F2f00305f33530Fdd3a5d0354927A65');
    // await usdt.Swapin(
    //   "0x288f6dec7d6165b3513dbeafa36332f35b9946943ebb362c387cc7956dc16ec5",
    //   sender,
    //   await convertToCurrencyDecimals(usdt.address, '20000000')
    // )
    // const weth = await getSwapinERC20('0x4135c251eE7804A73dB09D36C306AE0214deA28B');
    // await weth.Swapin(
    //   "0x288f6dec7d6165b3513dbeafa36332f35b9946943ebb362c387cc7956dc16ec5",
    //   sender,
    //   parseEther('20000000')
    // );
    // const dai = await DaiFactory.connect(
    //   '0x9440c3bB6Adb5F0D5b8A460d8a8c010690daC2E8',
    //   await getFirstSigner()
    // );
    // await dai.mint(
    //   sender,
    //   await convertToCurrencyDecimals(dai.address, '20000000')
    // );
  });

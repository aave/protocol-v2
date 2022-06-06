import { task } from 'hardhat/config';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import {
  deployLendingPoolCollateralManager,
  deployUiIncentiveDataProvider,
  deployUiPoolDataProvider,
  deployWalletBalancerProvider,
} from '../../helpers/contracts-deployments';
import { loadPoolConfig, ConfigNames, getTreasuryAddress } from '../../helpers/configuration';
import { eNetwork, ICommonConfiguration } from '../../helpers/types';
import { notFalsyOrZeroAddress, waitForTx } from '../../helpers/misc-utils';
import { initReservesByHelper, configureReservesByHelper } from '../../helpers/init-helpers';
import { exit } from 'process';
import {
  getSturdyProtocolDataProvider,
  getLendingPoolAddressesProvider,
  getYearnVault,
  getYearnWETHVault,
  getYearnWBTCVault,
  getYearnBOOVault,
  getTombFtmBeefyVault,
  getTombMiMaticBeefyVault,
  getYearnFBEETSVault,
  getYearnLINKVault,
  getBeefyETHVault,
  getYearnCRVVault,
  getYearnSPELLVault,
  getBasedMiMaticBeefyVault,
  getYearnRETHWstETHVault,
  getConvexRocketPoolETHVault,
  getConvexFRAX3CRVVault,
  getConvexSTETHVault,
  getConvexDOLA3CRVVault,
} from '../../helpers/contracts-getters';

task('full:initialize-lending-pool', 'Initialize lending pool configuration.')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .setAction(async ({ verify, pool }, localBRE) => {
    try {
      await localBRE.run('set-DRE');
      const network = <eNetwork>localBRE.network.name;
      const poolConfig = loadPoolConfig(pool);
      const {
        ATokenNamePrefix,
        StableDebtTokenNamePrefix,
        VariableDebtTokenNamePrefix,
        SymbolPrefix,
        ReserveAssets,
        ReservesConfig,
        LendingPoolCollateralManager,
        IncentivesController,
      } = poolConfig as ICommonConfiguration;

      const reserveAssets = getParamPerNetwork(ReserveAssets, network);
      const incentivesController = getParamPerNetwork(IncentivesController, network);
      const addressesProvider = await getLendingPoolAddressesProvider();

      const testHelpers = await getSturdyProtocolDataProvider();

      const admin = await addressesProvider.getPoolAdmin();
      const oracle = await addressesProvider.getPriceOracle();

      if (!reserveAssets) {
        throw 'Reserve assets is undefined. Check ReserveAssets configuration at config directory';
      }

      const treasuryAddress = await getTreasuryAddress(poolConfig);
      const yieldAddresses =
        pool == ConfigNames.Sturdy
          ? {
              // yvRETH_WSTETH: (await getYearnRETHWstETHVault()).address,
              // cvxRETH_WSTETH: (await getConvexRocketPoolETHVault()).address,
              cvxFRAX_3CRV: (await getConvexFRAX3CRVVault()).address,
              // cvxSTECRV: (await getConvexSTETHVault()).address,
              // cvxDOLA_3CRV: (await getConvexDOLA3CRVVault()).address,
            }
          : {
              yvWFTM: (await getYearnVault()).address,
              yvWETH: (await getYearnWETHVault()).address,
              yvWBTC: (await getYearnWBTCVault()).address,
              yvBOO: (await getYearnBOOVault()).address,
              mooTOMB_FTM: (await getTombFtmBeefyVault()).address,
              mooTOMB_MIMATIC: (await getTombMiMaticBeefyVault()).address,
              mooBASED_MIMATIC: (await getBasedMiMaticBeefyVault()).address,
              yvfBEETS: (await getYearnFBEETSVault()).address,
              mooWETH: (await getBeefyETHVault()).address,
              yvLINK: (await getYearnLINKVault()).address,
              yvCRV: (await getYearnCRVVault()).address,
              yvSPELL: (await getYearnSPELLVault()).address,
            };

      await initReservesByHelper(
        ReservesConfig,
        reserveAssets,
        ATokenNamePrefix,
        StableDebtTokenNamePrefix,
        VariableDebtTokenNamePrefix,
        SymbolPrefix,
        admin,
        treasuryAddress,
        yieldAddresses,
        verify
      );
      await configureReservesByHelper(ReservesConfig, reserveAssets, testHelpers, admin);

      let collateralManagerAddress = getParamPerNetwork(LendingPoolCollateralManager, network);
      if (!notFalsyOrZeroAddress(collateralManagerAddress)) {
        const collateralManager = await deployLendingPoolCollateralManager(verify);
        collateralManagerAddress = collateralManager.address;
      }
      // Seems unnecessary to register the collateral manager in the JSON db

      console.log(
        '\tSetting lending pool collateral manager implementation with address',
        collateralManagerAddress
      );
      await waitForTx(
        await addressesProvider.setLendingPoolCollateralManager(collateralManagerAddress)
      );

      console.log(
        '\tSetting SturdyProtocolDataProvider at AddressesProvider at id: 0x01',
        collateralManagerAddress
      );
      const sturdyProtocolDataProvider = await getSturdyProtocolDataProvider();
      await waitForTx(
        await addressesProvider.setAddress(
          '0x0100000000000000000000000000000000000000000000000000000000000000',
          sturdyProtocolDataProvider.address
        )
      );

      await deployWalletBalancerProvider(verify);

      const uiPoolDataProvider = await deployUiPoolDataProvider(
        [incentivesController, oracle],
        verify
      );
      console.log('UiPoolDataProvider deployed at:', uiPoolDataProvider.address);

      const uiIncentiveDataProvider = await deployUiIncentiveDataProvider(verify);
      console.log('UiIncentiveDataProvider deployed at:', uiIncentiveDataProvider.address);
    } catch (err) {
      console.error(err);
      exit(1);
    }
  });

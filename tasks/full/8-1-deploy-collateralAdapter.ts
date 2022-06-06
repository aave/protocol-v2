import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { deployCollateralAdapter } from '../../helpers/contracts-deployments';
import {
  getLidoVault,
  getTombFtmBeefyVault,
  getYearnBOOVault,
  getYearnFBEETSVault,
  getYearnVault,
  getYearnWBTCVault,
  getYearnWETHVault,
  getYearnLINKVault,
  getBeefyETHVault,
  getYearnCRVVault,
  getYearnSPELLVault,
  getBasedMiMaticBeefyVault,
  getTombMiMaticBeefyVault,
  getYearnRETHWstETHVault,
  getConvexRocketPoolETHVault,
  getConvexFRAX3CRVVault,
  getConvexSTETHVault,
  getConvexDOLA3CRVVault,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import {
  eContractid,
  eNetwork,
  ICommonConfiguration,
  IFantomConfiguration,
  IReserveParams,
  ISturdyConfiguration,
} from '../../helpers/types';

const CONTRACT_NAME = 'CollateralAdapter';

task(`full:deploy-collateral-adapter`, `Deploys the ${CONTRACT_NAME} contract`)
  .addParam('pool', `Pool name to retrieve configuration, supported: ${Object.values(ConfigNames)}`)
  .addFlag('verify', `Verify ${CONTRACT_NAME} contract via Etherscan API.`)
  .setAction(async ({ verify, pool }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }
    const collateralAdapter = await deployCollateralAdapter(verify);
    const network = <eNetwork>localBRE.network.name;
    const poolConfig = loadPoolConfig(pool);
    const { ReserveAssets, ReservesConfig } = poolConfig as ICommonConfiguration;
    const reserveAssets = getParamPerNetwork(ReserveAssets, network);
    const reserveExternalAssets =
      pool == ConfigNames.Sturdy
        ? {
            stETH: getParamPerNetwork((poolConfig as ISturdyConfiguration).Lido, network),
            // yvRETH_WSTETH: getParamPerNetwork(
            //   (poolConfig as ISturdyConfiguration).RETH_WSTETH_LP,
            //   network
            // ),
            // cvxRETH_WSTETH: getParamPerNetwork(
            //   (poolConfig as ISturdyConfiguration).RETH_WSTETH_LP,
            //   network
            // ),
            cvxFRAX_3CRV: getParamPerNetwork(
              (poolConfig as ISturdyConfiguration).FRAX_3CRV_LP,
              network
            ),
            // cvxSTECRV: getParamPerNetwork((poolConfig as ISturdyConfiguration).STECRV_LP, network),
            // cvxDOLA_3CRV: getParamPerNetwork(
            //   (poolConfig as ISturdyConfiguration).DOLA_3CRV_LP,
            //   network
            // ),
          }
        : {
            yvWFTM: getParamPerNetwork(poolConfig.WFTM, network),
            yvWETH: getParamPerNetwork(poolConfig.WETH, network),
            yvWBTC: getParamPerNetwork(poolConfig.WBTC, network),
            yvBOO: getParamPerNetwork((poolConfig as IFantomConfiguration).BOO, network),
            mooTOMB_FTM: getParamPerNetwork(
              (poolConfig as IFantomConfiguration).TOMB_FTM_LP,
              network
            ),
            mooTOMB_MIMATIC: getParamPerNetwork(
              (poolConfig as IFantomConfiguration).TOMB_MIMATIC_LP,
              network
            ),
            mooBASED_MIMATIC: getParamPerNetwork(
              (poolConfig as IFantomConfiguration).BASED_MIMATIC_LP,
              network
            ),
            yvfBEETS: getParamPerNetwork((poolConfig as IFantomConfiguration).fBEETS, network),
            yvLINK: getParamPerNetwork((poolConfig as IFantomConfiguration).LINK, network),
            mooWETH: getParamPerNetwork((poolConfig as IFantomConfiguration).WETH, network),
            yvCRV: getParamPerNetwork((poolConfig as IFantomConfiguration).CRV, network),
            yvSPELL: getParamPerNetwork((poolConfig as IFantomConfiguration).SPELL, network),
          };

    const acceptableVaults =
      pool == ConfigNames.Sturdy
        ? {
            stETH: (await getLidoVault()).address,
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
            yvLINK: (await getYearnLINKVault()).address,
            mooWETH: (await getBeefyETHVault()).address,
            yvCRV: (await getYearnCRVVault()).address,
            yvSPELL: (await getYearnSPELLVault()).address,
          };

    const reserves = Object.entries(ReservesConfig).filter(
      ([_, { aTokenImpl }]) => aTokenImpl === eContractid.ATokenForCollateral
    ) as [string, IReserveParams][];

    for (let [symbol, params] of reserves) {
      if (!reserveAssets[symbol]) {
        console.log(`- Skipping init of ${symbol} due token address is not set at markets config`);
        continue;
      }

      await waitForTx(
        await collateralAdapter.addCollateralAsset(
          reserveExternalAssets[symbol],
          reserveAssets[symbol],
          acceptableVaults[symbol]
        )
      );
    }

    console.log(`${CONTRACT_NAME}.address`, collateralAdapter.address);
    console.log(`\tFinished ${CONTRACT_NAME} deployment`);
  });

import { TestEnv, makeSuite } from './helpers/make-suite';
import {
  APPROVAL_AMOUNT_LENDING_POOL,
  MAX_UINT_AMOUNT,
  RAY,
  ZERO_ADDRESS,
} from '../../helpers/constants';
import {
  convertToCurrencyDecimals,
  getContractAddressWithJsonFallback,
} from '../../helpers/contracts-helpers';
import { eContractid, ProtocolErrors, RateMode } from '../../helpers/types';
import { strategyWETH } from '../../markets/aave/reservesConfigs';
import {
  deployATokenImplementations,
  deployMintableERC20,
  deployValidationLogic,
} from '../../helpers/contracts-deployments';
import { getATokenExtraParams } from '../../helpers/init-helpers';
import { ConfigNames } from '../../helpers/configuration';
import { zeroAddress } from 'hardhat/node_modules/ethereumjs-util';
import AaveConfig from '../../markets/aave';
import { getATokensAndRatesHelper } from '../../helpers/contracts-getters';
import { config } from 'process';
import { parseEther } from '@ethersproject/units';
import exp from 'constants';

const { expect } = require('chai');

makeSuite('Adding > 128 asset to many-asset configured pool', (testEnv: TestEnv) => {
  const tokens = {};

  before('setup', async () => {
    const { pool, dai, configurator, deployer, oracle } = testEnv;
    const atokenAndRatesDeployer = await getATokensAndRatesHelper();

    const reservesCount = await pool.getReservesList();

    const daiData = await pool.getReserveData(dai.address);
    const poolName = ConfigNames.Aave;

    const {
      ATokenNamePrefix,
      StableDebtTokenNamePrefix,
      VariableDebtTokenNamePrefix,
      SymbolPrefix,
    } = AaveConfig;

    // Create tokens
    let tokenInitParams = [];
    let reserveInitParams = [];

    const aTokenImplAddress = await getContractAddressWithJsonFallback(
      eContractid.AToken,
      poolName
    );
    const stableDebtImplAddress = await getContractAddressWithJsonFallback(
      eContractid.StableDebtToken,
      poolName
    );
    const variableDebtImplAddress = await getContractAddressWithJsonFallback(
      eContractid.VariableDebtToken,
      poolName
    );

    const daiPrice = await oracle.getAssetPrice(dai.address);

    // All assets will be initialized with the same price as Dai.
    for (let i = reservesCount.length; i < 140; i++) {
      const tokenName = `RealT-${i}`;
      const token = await deployMintableERC20([tokenName, tokenName, '18']);
      tokens[tokenName] = token;

      tokenInitParams.push({
        aTokenImpl: aTokenImplAddress,
        stableDebtTokenImpl: stableDebtImplAddress,
        variableDebtTokenImpl: variableDebtImplAddress,
        underlyingAssetDecimals: 18,
        interestRateStrategyAddress: daiData.interestRateStrategyAddress,
        underlyingAsset: token.address,
        treasury: ZERO_ADDRESS,
        incentivesController: ZERO_ADDRESS,
        underlyingAssetName: tokenName,
        aTokenName: `${ATokenNamePrefix} ${tokenName}`,
        aTokenSymbol: `a${SymbolPrefix}${tokenName}`,
        variableDebtTokenName: `${VariableDebtTokenNamePrefix} ${SymbolPrefix}${tokenName}`,
        variableDebtTokenSymbol: `variableDebt${SymbolPrefix}${tokenName}`,
        stableDebtTokenName: `${StableDebtTokenNamePrefix} ${tokenName}`,
        stableDebtTokenSymbol: `stableDebt${SymbolPrefix}${tokenName}`,
        params: '0x10',
      });

      reserveInitParams.push({
        asset: token.address,
        baseLTV: 5000,
        liquidationThreshold: 8000,
        liquidationBonus: 10500,
        reserveFactor: 1000,
        stableBorrowingEnabled: false,
        borrowingEnabled: true,
      });

      if (tokenInitParams.length == 2 || i == 139) {
        await configurator.batchInitReserve(tokenInitParams);

        for (let j = 0; j < reserveInitParams.length; j++) {
          let params = reserveInitParams[j];
          await configurator
            .connect(deployer.signer)
            .configureReserveAsCollateral(
              params.asset,
              params.baseLTV,
              params.liquidationThreshold,
              params.liquidationBonus
            );
          await configurator.enableBorrowingOnReserve(params.asset, false);
          await oracle.setAssetPrice(params.asset, daiPrice);
        }
        tokenInitParams = [];
        reserveInitParams = [];
      }
    }
  });

  it('Check that pool contains >128 assets', async () => {
    const { pool } = testEnv;
    const reservesCount = await pool.getReservesList();
    expect(reservesCount.length).to.be.gt(128);
  });

  it('Add collateral and borrow asset 130', async () => {
    const {
      users: [, user, funder],
      weth,
      pool,
    } = testEnv;

    const realT130 = tokens[`RealT-${130}`];

    const assetdata = await pool.getReserveData(realT130.address);
    expect(assetdata.id).to.be.gt(128);

    await realT130.connect(funder.signer).mint(parseEther('100'));
    await realT130.connect(funder.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await pool
      .connect(funder.signer)
      .deposit(realT130.address, parseEther('100'), funder.address, 0);

    await weth.connect(user.signer).mint(parseEther('1'));
    await weth.connect(user.signer).approve(pool.address, MAX_UINT_AMOUNT);
    await pool.connect(user.signer).deposit(weth.address, parseEther('1'), user.address, 0);

    const userDataBefore = await pool.getUserAccountData(user.address);
    await pool
      .connect(user.signer)
      .borrow(realT130.address, parseEther('1'), RateMode.Variable, 0, user.address);
    const userDataAfter = await pool.getUserAccountData(user.address);

    expect(userDataAfter.totalCollateralETH).to.be.eq(userDataBefore.totalCollateralETH);
    expect(userDataBefore.totalDebtETH).to.be.eq(0);
    expect(userDataAfter.totalDebtETH).to.be.gt(userDataBefore.totalDebtETH);
    expect(userDataAfter.healthFactor).to.be.lt(userDataBefore.healthFactor);
  });
});

/**
 * @dev test for liquidation with flashloan contract
 */

import { expect } from 'chai';
import { makeSuite, TestEnv } from './helpers/make-suite';
import { ethers } from 'ethers';
import { DRE, impersonateAccountsHardhat, waitForTx } from '../../helpers/misc-utils';
import {
  convertToCurrencyDecimals,
  getEthersSigners,
  getParamPerNetwork,
  withSaveAndVerify,
} from '../../helpers/contracts-helpers';
import {
  getFirstSigner,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
} from '../../helpers/contracts-getters';
import BigNumber from 'bignumber.js';
import { eContractid, eNetwork, ISturdyConfiguration, RateMode } from '../../helpers/types';
import { APPROVAL_AMOUNT_LENDING_POOL, ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployETHLiquidator,
  deployYieldManagerLibraries,
} from '../../helpers/contracts-deployments';
import { ETHLiquidatorFactory } from '../../types';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';

const { parseEther } = ethers.utils;

makeSuite('Liquidator', (testEnv: TestEnv) => {
  it('call liquidator for stETH for Lido vault', async () => {
    const { deployer, usdc, lido, lidoVault, pool, oracle, users } = testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
    const borrower = users[1];
    const abiEncoder = new ethers.utils.AbiCoder();
    const encodedData = abiEncoder.encode(['address', 'address'], [lido.address, borrower.address]);

    // deploy liquidator with flashloan contract
    const addressesProvider = await getLendingPoolAddressesProvider();
    const libraries = await deployYieldManagerLibraries(false);
    const liquidator = await withSaveAndVerify(
      await new ETHLiquidatorFactory(libraries, await getFirstSigner()).deploy(
        addressesProvider.address
      ),
      eContractid.ETHLiquidator,
      [addressesProvider.address],
      false
    );

    const config: ISturdyConfiguration = loadPoolConfig(ConfigNames.Sturdy) as ISturdyConfiguration;
    const network = <eNetwork>DRE.network.name;
    await waitForTx(
      await addressesProvider
        .connect(deployer.signer)
        .setAddress(
          ethers.utils.formatBytes32String('AAVE_LENDING_POOL'),
          getParamPerNetwork(config.AavePool, network)
        )
    );

    await lidoVault
      .connect(borrower.signer)
      .depositCollateral(ZERO_ADDRESS, parseEther('10'), { value: parseEther('10') });

    const usdcOwnerAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
    const depositUSDC = '50000';
    //Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    let signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //Supplier  deposits 50000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    // borrow
    const userGlobalData = await pool.getUserAccountData(borrower.address);
    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.95)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    // set liquidation threshold 35%
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator
      .connect(deployer.signer)
      .configureReserveAsCollateral(lido.address, '3000', '3500', '10500');

    // process liquidation by using flashloan contract
    await liquidator.liquidation(
      usdc.address,
      await convertToCurrencyDecimals(usdc.address, '20000'),
      encodedData
    );

    // withdraw remained usdc from flashloan contract
    const beforeUsdcBalance = await usdc.balanceOf(await (await getFirstSigner()).getAddress());
    await liquidator.withdraw(usdc.address);
    const usdcBalance = await usdc.balanceOf(await (await getFirstSigner()).getAddress());
    expect(
      usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))
    ).to.eq(true);
  });
});

makeSuite('Liquidator', (testEnv: TestEnv) => {
  it('call liquidator for FRAX_3CRV_LP for ConvexFRAX3CRV vault', async () => {
    const { deployer, usdc, FRAX_3CRV_LP, convexFRAX3CRVVault, cvxfrax_3crv, pool, oracle, users } =
      testEnv;
    const ethers = (DRE as any).ethers;
    const depositor = users[0];
    const borrower = users[1];
    const abiEncoder = new ethers.utils.AbiCoder();
    const encodedData = abiEncoder.encode(
      ['address', 'address'],
      [FRAX_3CRV_LP.address, borrower.address]
    );

    // deploy liquidator with flashloan contract
    const addressesProvider = await getLendingPoolAddressesProvider();
    const libraries = await deployYieldManagerLibraries(false);
    const liquidator = await withSaveAndVerify(
      await new ETHLiquidatorFactory(libraries, await getFirstSigner()).deploy(
        addressesProvider.address
      ),
      eContractid.ETHLiquidator,
      [addressesProvider.address],
      false
    );

    const config: ISturdyConfiguration = loadPoolConfig(ConfigNames.Sturdy) as ISturdyConfiguration;
    const network = <eNetwork>DRE.network.name;
    await waitForTx(
      await addressesProvider
        .connect(deployer.signer)
        .setAddress(
          ethers.utils.formatBytes32String('AAVE_LENDING_POOL'),
          getParamPerNetwork(config.AavePool, network)
        )
    );

    await waitForTx(
      await addressesProvider
        .connect(deployer.signer)
        .setAddress(
          ethers.utils.formatBytes32String('FRAX_3CRV_LP'),
          getParamPerNetwork(config.FRAX_3CRV_LP, network)
        )
    );

    await waitForTx(
      await addressesProvider
        .connect(deployer.signer)
        .setAddress(
          ethers.utils.formatBytes32String('3CRV_POOL'),
          '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7'
        )
    );

    // Prepare some FRAX_3CRV_LP token
    const LPOwnerAddress = '0xdCA313c4Df33c2142B2aDf202D6AbF4Fa56e1d41';
    await impersonateAccountsHardhat([LPOwnerAddress]);
    let signer = await ethers.provider.getSigner(LPOwnerAddress);
    const LP_AMOUNT = await convertToCurrencyDecimals(FRAX_3CRV_LP.address, '3000');
    await FRAX_3CRV_LP.connect(signer).transfer(borrower.address, LP_AMOUNT);
    await FRAX_3CRV_LP.connect(borrower.signer).approve(convexFRAX3CRVVault.address, LP_AMOUNT);

    await convexFRAX3CRVVault
      .connect(borrower.signer)
      .depositCollateral(FRAX_3CRV_LP.address, LP_AMOUNT);

    const usdcOwnerAddress = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
    const depositUSDC = '50000';
    //Make some test USDC for depositor
    await impersonateAccountsHardhat([usdcOwnerAddress]);
    signer = await ethers.provider.getSigner(usdcOwnerAddress);
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, depositUSDC);
    await usdc.connect(signer).transfer(depositor.address, amountUSDCtoDeposit);

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //Supplier  deposits 50000 USDC
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    // borrow
    const userGlobalData = await pool.getUserAccountData(borrower.address);
    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.99)
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    // set liquidation threshold 35%
    const configurator = await getLendingPoolConfiguratorProxy();
    await configurator
      .connect(deployer.signer)
      .configureReserveAsCollateral(cvxfrax_3crv.address, '3000', '3200', '10200');

    // process liquidation by using flashloan contract
    await liquidator.liquidation(
      usdc.address,
      await convertToCurrencyDecimals(usdc.address, '5000'),
      encodedData
    );

    // withdraw remained usdc from flashloan contract
    const beforeUsdcBalance = await usdc.balanceOf(await (await getFirstSigner()).getAddress());
    await liquidator.withdraw(usdc.address);
    const usdcBalance = await usdc.balanceOf(await (await getFirstSigner()).getAddress());
    expect(
      usdcBalance.sub(beforeUsdcBalance).gt(await convertToCurrencyDecimals(usdc.address, '0.03'))
    ).to.eq(true);
  });
});

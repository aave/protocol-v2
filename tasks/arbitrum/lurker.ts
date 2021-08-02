import { getArtifactFromContractOutput } from '@nomiclabs/buidler/internal/artifacts';
import { formatEther, formatUnits } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { ConfigNames, loadPoolConfig } from '../../helpers/configuration';
import { deployAllMockTokens } from '../../helpers/contracts-deployments';
import {
  getAToken,
  getFirstSigner,
  getIErc20Detailed,
  getLendingPool,
  getMockedTokens,
  getStableDebtToken,
  getVariableDebtToken,
} from '../../helpers/contracts-getters';
import { getParamPerNetwork } from '../../helpers/contracts-helpers';
import { eEthereumNetwork } from '../../helpers/types';
import { LendingPool } from '../../types';

task('arbitrum:lurker', 'Deploy mock tokens for dev enviroment').setAction(async ({}, localBRE) => {
  await localBRE.run('set-DRE');

  const signer = await getFirstSigner();
  const signerAddress = await signer.getAddress();
  const ethBalance = await signer.getBalance();

  console.log(`Using: ${signerAddress} with ${formatEther(ethBalance)} eth`);

  const lendingPool = await getLendingPool();

  // Need to look up the wbtc balance and such
  const config = loadPoolConfig(ConfigNames.Arbitrum);
  const tokens = await getMockedTokens(config);

  // WBTC
  const wbtc = tokens['WBTC'];
  const wbtcReserveData = await lendingPool.getReserveData(wbtc.address);
  const stableDebtWBTC = await getStableDebtToken(wbtcReserveData.stableDebtTokenAddress);
  const variableDebtWBTC = await getVariableDebtToken(wbtcReserveData.variableDebtTokenAddress);
  const awbtc = await getAToken(wbtcReserveData.aTokenAddress);

  const wbtcBalance = await wbtc.balanceOf(signerAddress);
  const wbtcStableDebt = await stableDebtWBTC.balanceOf(signerAddress);
  const wbtcVariableDebt = await variableDebtWBTC.balanceOf(signerAddress);
  const wbtcTotalDebt = wbtcStableDebt.add(wbtcVariableDebt);
  const awbtcBalance = await awbtc.balanceOf(signerAddress);

  console.log(
    `WBTC balance: ${formatUnits(wbtcBalance, 8)}, aWBTC balance: ${formatUnits(awbtcBalance, 8)}.`
  );
  console.log(
    `WBTC stable debt: ${formatUnits(wbtcStableDebt, 8)}, WBTC variable debt: ${formatUnits(
      wbtcVariableDebt,
      8
    )}`
  );

  // USDT
  const usdt = tokens['USDT'];
  const usdtReserveData = await lendingPool.getReserveData(usdt.address);
  const stableDebtUSDT = await getStableDebtToken(usdtReserveData.stableDebtTokenAddress);
  const variableDebtUSDT = await getVariableDebtToken(usdtReserveData.variableDebtTokenAddress);
  const ausdt = await getAToken(usdtReserveData.aTokenAddress);

  const usdtBalance = await usdt.balanceOf(signerAddress);
  const usdtStableDebt = await stableDebtUSDT.balanceOf(signerAddress);
  const usdtVariableDebt = await variableDebtUSDT.balanceOf(signerAddress);
  const usdtTotalDebt = usdtStableDebt.add(usdtVariableDebt);
  const ausdtBalance = await ausdt.balanceOf(signerAddress);

  console.log(
    `USDT balance: ${formatUnits(usdtBalance, 6)}, aUSDT balance: ${formatUnits(ausdtBalance, 6)}.`
  );
  console.log(
    `USDT stable debt: ${formatUnits(usdtStableDebt, 6)}, USDT variable debt: ${formatUnits(
      usdtVariableDebt,
      6
    )}`
  );

  // WETH
  const weth = await getIErc20Detailed('0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681');
  const wethReserveData = await lendingPool.getReserveData(weth.address);
  const stableDebtWeth = await getStableDebtToken(wethReserveData.stableDebtTokenAddress);
  const variableDebtWeth = await getVariableDebtToken(wethReserveData.variableDebtTokenAddress);
  const aweth = await getAToken(wethReserveData.aTokenAddress);

  const wethBalance = await weth.balanceOf(signerAddress);
  const wethStableDebt = await stableDebtWeth.balanceOf(signerAddress);
  const wethVariableDebt = await variableDebtWeth.balanceOf(signerAddress);
  const wethTotalDebt = wethStableDebt.add(wethVariableDebt);
  const awethBalance = await aweth.balanceOf(signerAddress);

  console.log(
    `WETH balance: ${formatUnits(wethBalance, 18)}, aWETH balance: ${formatUnits(
      awethBalance,
      18
    )}.`
  );
  console.log(
    `WETH stable debt: ${formatUnits(wethStableDebt, 18)}, WETH variable debt: ${formatUnits(
      wethVariableDebt,
      18
    )}`
  );

  // Lending pool
  const user = await lendingPool.getUserAccountData(signerAddress);

  console.log(
    `Total collateral usd: ${formatUnits(
      user.totalCollateralETH,
      8
    )}, total debt usd: ${formatUnits(user.totalDebtETH, 8)}`
  );
  console.log(
    `Loan to value: ${formatUnits(user.ltv, 2)}%, health factor: ${formatUnits(
      user.healthFactor,
      18
    )}, current liquidation threshold: ${formatUnits(user.currentLiquidationThreshold, 2)}%`
  );
});

import { expect } from 'chai';
import rawHRE from 'hardhat';
import BigNumber from 'bignumber.js';
import { Signer } from 'ethers';
import { DRE, evmRevert, evmSnapshot } from '../../../helpers/misc-utils';
import { impersonateAccountsHardhat } from '../../../helpers/misc-utils';
import { MAX_UINT_AMOUNT } from '../../../helpers/constants';
import {
  AaveProtocolDataProvider,
  AaveProtocolDataProviderFactory,
  ATokenFactory,
  ERC20,
  ERC20Factory,
  LendingPoolAddressesProvider,
  LendingPoolAddressesProviderFactory,
  LendingPoolConfigurator,
  LendingPoolConfiguratorFactory,
  PermissionedLendingPool,
  PermissionedLendingPoolFactory,
  PermissionManager,
  PermissionManagerFactory,
  AaveOracle,
  AaveOracleFactory,
  MockAggregatorFactory,
  PermissionedWETHGateway,
  PermissionedWETHGatewayFactory,
  LendingPoolCollateralManagerFactory,
} from '../../../types';
import { ProtocolErrors, RateMode } from '../../../helpers/types';
import { getFirstSigner } from '../../../helpers/contracts-getters';
import { convertToCurrencyDecimals, getEthersSigners } from '../../../helpers/contracts-helpers';

const PERMISSIONS = {
  DEPOSITOR: 0,
  BORROWER: 1,
  LIQUIDATOR: 2,
  STABLE_RATE_MANAGER: 3,
};

// npm run test network hardhat fork mumbai

const config = {
  MintableERC20: '0xa4725C2730170Bc484d7291b66a11AcD193D1db4',
  LendingPoolAddressesProvider: '0xAcaa8F77345FDbc3B089CfFcB16a8BCC545602e4',
  PermissionManager: '0x36170C30229510ff9f61515191559eAb2Fd0457e',
  ReserveLogic: '0x3e4F5aa2EAAb324e1Edc4171E6D3eB3aBf822AF8',
  GenericLogic: '0x2DF9C4c862061ba70167Af1e89A5Bbc89DC364bb',
  ValidationLogic: '0x0bBd4c57233c19897Bf7767AC4bfDE0F718B05c6',
  LendingPoolImpl: '0xa39D3fBe4E64611024eCE1f86436Ea9320e1CAC0',
  LendingPool: '0x4F3e30e9e4c1b21E7C6Ff0596c976bb70885ac78',
  LendingPoolConfiguratorImpl: '0x515F218fc3deE24DD25c225e880F5d9DC8ad79b4',
  LendingPoolConfigurator: '0xE9c59D59C20242951436c560398Bb32256178A4e',
  StableAndVariableTokensHelper: '0x8c83EbE2a2f79B12990e7C4C5d1D61F8C813e5Eb',
  ATokensAndRatesHelper: '0xf45dC88Bf80158E485E767eDAF438491268d7699',
  AToken: '0x1a49B92c55Ed609193477B2d42A6b91d31E8B892',
  StableDebtToken: '0x2116806eb88255e445f3E60C082a8500ACb4481a',
  VariableDebtToken: '0xA8cb54587890d809b574cbF5A2Ee519205B7aa24',
  AaveOracle: '0x04774a7b6Bb341549F9d2fc056575CECda4d8254',
  AaveProtocolDataProvider: '0x832491E091B15F562e23261Ab1a89D2bD7DADBDB',
  PermissionedWETHGateway: '0xa1C50DD18eaD50810d783Dc630f16aA3d4ba89Fa',
  aTokenImpl: '0x1a49B92c55Ed609193477B2d42A6b91d31E8B892',
  DefaultReserveInterestRateStrategy: '0x2F122b1c6CDe5E3e6e10C2a82B064292d4A52c68',
  rateStrategyStableTwo: '0xdbb4cc8605354425798485B7F02B401870587578',
  rateStrategyStableThree: '0x0A0439a8a134ad482A93BF02d5e2Ccd16a9A7259',
  rateStrategyVolatileTwo: '0x923bb98102aC3a23e113473FFdD32021622B0C9C',
  rateStrategyWETH: '0x61782Cd3dDD0c990990395921D3A95C76d45dCF1',
  rateStrategyVolatileOne: '0x2F122b1c6CDe5E3e6e10C2a82B064292d4A52c68',
  LendingPoolCollateralManagerImpl: '0x8FD25C8465F9CC8314cb8CFba7FC0306038cF5B6',
  LendingPoolCollateralManager: '0x8FD25C8465F9CC8314cb8CFba7FC0306038cF5B6',
  WalletBalanceProvider: '0xB2055E944415b35C05eA9d28E2d6dD08B4A3ed39',
  LendingRateOracle: '0x27977E68aA2C38d554CFd4F5dA8863FF3BC87134',
};

//

// DAI: '0x001B3B4d0F3714Ca98ba10F6042DaEbF0B1B7b6F',
// USDC: '0x2058A9D7613eEE744279e3856Ef0eAda5FCbaA7e',
// USDT: '0xBD21A10F619BE90d6066c941b04e340841F1F989',
// WBTC: '0x0d787a4a1548f673ed375445535a6c7A1EE56180',
// // WETH: '0x3C68CE8504087f89c640D02d133646d98e64ddd9',
// WMATIC: '0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889',

const ETH_HOLDER = '0x829BD824B016326A401d083B33D092293333A830';
const USDC_HOLDER = '0x72aabd13090af25dbb804f84de6280c697ed1150';
const AAVE_HOLDER = '0xF977814e90dA44bFA03b6295A0616a897441aceC';
const WBTC_HOLDER = '0xE3DD3914aB28bB552d41B8dFE607355DE4c37A51';
const WETH_HOLDER = '0x57757e3d981446d585af0d9ae4d7df6d64647806';

const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const AAVE_ADDRESS = '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9';
const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

describe('Aave ARC fork test', () => {
  let ethers;

  let users: Signer[];
  let ethHolder: Signer;
  let usdcHolder: Signer;
  let aaveHolder: Signer;
  let wbtcHolder: Signer;
  let wethHolder: Signer;
  let usdc: ERC20;
  let aave: ERC20;
  let wbtc: ERC20;
  let weth: ERC20;

  let pool: PermissionedLendingPool;
  let provider: LendingPoolAddressesProvider;
  let configurator: LendingPoolConfigurator;
  let oracle: AaveOracle;
  let oracleAdmin: Signer;
  let helpersContract: AaveProtocolDataProvider;
  let permissionManager: PermissionManager;
  let permissionManagerAdmin: Signer;
  let emergencyAdmin: Signer;
  let wethGateway: PermissionedWETHGateway;

  const {
    VL_TRANSFER_NOT_ALLOWED,
    LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET,
    PLP_DEPOSITOR_UNAUTHORIZED,
    PLP_BORROWER_UNAUTHORIZED,
    PLP_LIQUIDATOR_UNAUTHORIZED,
    PLP_CALLER_NOT_STABLE_RATE_MANAGER,
    PLP_USER_UNAUTHORIZED,
    PLP_INVALID_PERMISSION_ADMIN,
  } = ProtocolErrors;

  const topUpWithERC20 = async (asset: ERC20, holder: Signer, to: string, amount: string) => {
    await asset
      .connect(holder)
      .transfer(to, await convertToCurrencyDecimals(asset.address, amount));
  };

  before(async () => {
    await rawHRE.run('set-DRE');
    ethers = (DRE as any).ethers;
    users = await getEthersSigners();
    usdc = await ERC20Factory.connect(USDC_ADDRESS, users[0]);
    aave = await ERC20Factory.connect(AAVE_ADDRESS, users[0]);
    wbtc = await ERC20Factory.connect(WBTC_ADDRESS, users[0]);
    weth = await ERC20Factory.connect(WETH_ADDRESS, users[0]);
    await impersonateAccountsHardhat([
      ETH_HOLDER,
      USDC_HOLDER,
      AAVE_HOLDER,
      WBTC_HOLDER,
      WETH_HOLDER,
    ]);
    ethHolder = ethers.provider.getSigner(ETH_HOLDER);
    usdcHolder = ethers.provider.getSigner(USDC_HOLDER);
    aaveHolder = ethers.provider.getSigner(AAVE_HOLDER);
    wbtcHolder = ethers.provider.getSigner(WBTC_HOLDER);
    wethHolder = ethers.provider.getSigner(WETH_HOLDER);

    pool = await PermissionedLendingPoolFactory.connect(config.LendingPool, users[0]);
    provider = await LendingPoolAddressesProviderFactory.connect(
      config.LendingPoolAddressesProvider,
      users[0]
    );
    configurator = await LendingPoolConfiguratorFactory.connect(
      config.LendingPoolConfigurator,
      users[0]
    );
    oracle = await AaveOracleFactory.connect(config.AaveOracle, users[0]);
    helpersContract = await AaveProtocolDataProviderFactory.connect(
      config.AaveProtocolDataProvider,
      users[0]
    );
    permissionManager = await PermissionManagerFactory.connect(config.PermissionManager, users[0]);
    wethGateway = await PermissionedWETHGatewayFactory.connect(
      config.PermissionedWETHGateway,
      users[0]
    );
  });

  it('Pool Data', async () => {
    const tokenData = await helpersContract.getAllReservesTokens();
    let reserveData, reserveTokens, aToken;
    console.log('Reserves available: ');
    for (const token of tokenData) {
      console.log(token.symbol, '-', token.tokenAddress);
      reserveData = await helpersContract.getReserveData(token.tokenAddress);
      reserveTokens = await helpersContract.getReserveTokensAddresses(token.tokenAddress);
      aToken = await ATokenFactory.connect(reserveTokens.aTokenAddress, users[0]);
      console.log('IncentivesController: ', await aToken.getIncentivesController());
    }
  });

  it('PermissionAdmin', async () => {
    console.log('PERMISSION MANAGER', await pool.PERMISSION_MANAGER());

    const permissionManagerAdminAddress = await permissionManager.owner();
    console.log('PermissionManager owner: ', permissionManagerAdminAddress);

    await impersonateAccountsHardhat([permissionManagerAdminAddress]);
    permissionManagerAdmin = ethers.provider.getSigner(permissionManagerAdminAddress);
  });

  it('Add user1 as PermissionAdmin and user2 as Depositor', async () => {
    await permissionManager
      .connect(permissionManagerAdmin)
      .addPermissionAdmins([await users[1].getAddress()]);

    await permissionManager
      .connect(users[1])
      .addPermissions([PERMISSIONS.DEPOSITOR], [await users[2].getAddress()]);
  });

  it('Unpause Pool by EmergencyAdmin', async () => {
    const emergencyAdminAddress = await provider.getEmergencyAdmin();
    await impersonateAccountsHardhat([emergencyAdminAddress]);
    emergencyAdmin = ethers.provider.getSigner(emergencyAdminAddress);

    await configurator.connect(emergencyAdmin).setPoolPause(false);
  });

  it('User2 supplies 10000 USDC, 10 AAVE, 10 WBTC, 10 WETH and 10 ETH', async () => {
    await topUpWithERC20(usdc, usdcHolder, await users[2].getAddress(), '10000');
    console.log('User2: ', (await usdc.balanceOf(await users[2].getAddress())).toString(), 'USDC');
    await usdc.connect(users[2]).approve(pool.address, MAX_UINT_AMOUNT);
    await pool
      .connect(users[2])
      .deposit(
        usdc.address,
        await convertToCurrencyDecimals(usdc.address, '10000'),
        await users[2].getAddress(),
        '0'
      );

    await aave.connect(users[2]).approve(pool.address, MAX_UINT_AMOUNT);
    await topUpWithERC20(aave, aaveHolder, await users[2].getAddress(), '10');
    await pool
      .connect(users[2])
      .deposit(
        aave.address,
        await convertToCurrencyDecimals(aave.address, '10'),
        await users[2].getAddress(),
        '0'
      );

    await wbtc.connect(users[2]).approve(pool.address, MAX_UINT_AMOUNT);
    await topUpWithERC20(wbtc, wbtcHolder, await users[2].getAddress(), '10');
    await pool
      .connect(users[2])
      .deposit(
        wbtc.address,
        await convertToCurrencyDecimals(wbtc.address, '10'),
        await users[2].getAddress(),
        '0'
      );

    await weth.connect(users[2]).approve(pool.address, MAX_UINT_AMOUNT);
    await topUpWithERC20(weth, wethHolder, await users[2].getAddress(), '10');
    await pool
      .connect(users[2])
      .deposit(
        weth.address,
        await convertToCurrencyDecimals(weth.address, '10'),
        await users[2].getAddress(),
        '0'
      );
  });

  it('User2 supplies 10 ETH', async () => {
    // Top up user 5 with ether
    await ethHolder.sendTransaction({
      to: await users[2].getAddress(),
      value: ethers.utils.parseEther('10'),
    });
    await wethGateway.connect(users[2]).depositETH(pool.address, await users[2].getAddress(), '0', {
      value: ethers.utils.parseEther('10'),
    });

    const wethData = await helpersContract.getReserveTokensAddresses(weth.address);
    const aToken = await ATokenFactory.connect(wethData.aTokenAddress, users[0]);
    console.log(await aToken.balanceOf(await users[2].getAddress()));
  });

  it('User2 tries to transfer aWETH to non-whitelisted user (revert expected)', async () => {
    const wethData = await helpersContract.getReserveTokensAddresses(weth.address);
    const aToken = await ATokenFactory.connect(wethData.aTokenAddress, users[0]);

    await expect(
      aToken.connect(users[2]).transfer(await users[3].getAddress(), 1)
    ).to.be.revertedWith(VL_TRANSFER_NOT_ALLOWED);
  });

  it('User1 PermissionAdmin removes User2 as depositor and User2 tries to withdrawETH (revert expected)', async () => {
    const snapId = await evmSnapshot();

    await permissionManager
      .connect(users[1])
      .removePermissions([PERMISSIONS.DEPOSITOR], [await users[2].getAddress()]);

    await expect(
      wethGateway
        .connect(users[2])
        .withdrawETH(pool.address, MAX_UINT_AMOUNT, await users[2].getAddress())
    ).to.be.reverted;

    await expect(
      wethGateway
        .connect(users[2])
        .withdrawETH(pool.address, MAX_UINT_AMOUNT, await users[3].getAddress())
    ).to.be.reverted;

    await evmRevert(snapId);
  });

  it('User1 Admin add user3 as Depositor', async () => {
    await permissionManager
      .connect(users[1])
      .addPermissions([PERMISSIONS.DEPOSITOR], [await users[3].getAddress()]);
  });

  it('User3 deposits 1000 AAVE', async () => {
    await aave.connect(users[3]).approve(pool.address, MAX_UINT_AMOUNT);
    await topUpWithERC20(aave, aaveHolder, await users[3].getAddress(), '1000');
    await pool
      .connect(users[3])
      .deposit(
        aave.address,
        await convertToCurrencyDecimals(aave.address, '1000'),
        await users[3].getAddress(),
        '0'
      );
  });

  it('User3 tries to borrowETH with no BORROWER role (revert expected)', async () => {
    await expect(
      wethGateway.connect(users[3]).borrowETH(pool.address, '1', 0, 0)
    ).to.be.revertedWith(PLP_BORROWER_UNAUTHORIZED);
  });

  it('User1 Admin add user2 as Borrower', async () => {
    await permissionManager
      .connect(users[1])
      .addPermissions([PERMISSIONS.BORROWER], [await users[2].getAddress()]);
  });

  it('User2 borrows 2 USDC variable', async () => {
    await pool
      .connect(users[2])
      .borrow(
        usdc.address,
        await convertToCurrencyDecimals(usdc.address, '2'),
        RateMode.Variable,
        '0',
        await users[2].getAddress()
      );
  });

  it('Admin User1 seizes the AAVE collateral of User2', async () => {
    const aaveData = await helpersContract.getReserveTokensAddresses(aave.address);
    const aToken = await ATokenFactory.connect(aaveData.aTokenAddress, users[0]);
    console.log('aToken balance of aave: ', await aave.balanceOf(aToken.address));
    console.log('aAave of user', await aToken.balanceOf(await users[2].getAddress()));

    await permissionManager
      .connect(users[1])
      .addPermissions([PERMISSIONS.LIQUIDATOR], [await users[1].getAddress()]);
    await pool
      .connect(users[1])
      .seize(await users[2].getAddress(), [aave.address], await users[1].getAddress());
  });

  it('User2 repays USDC debt', async () => {
    await pool
      .connect(users[2])
      .repay(usdc.address, MAX_UINT_AMOUNT, RateMode.Variable, await users[2].getAddress());
  });

  it('Add user3 as Liquidator, user4 as Depositor and Borrower', async () => {
    await permissionManager
      .connect(users[1])
      .addPermissions(
        [PERMISSIONS.LIQUIDATOR, PERMISSIONS.DEPOSITOR, PERMISSIONS.BORROWER],
        [await users[3].getAddress(), await users[4].getAddress(), await users[4].getAddress()]
      );
  });

  it('User 4 deposits 1 WETH and borrows USDC - drops HF, User 3 liquidates the borrow of User4', async () => {
    // User 4 deposits 1 ETH
    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to user4
    await topUpWithERC20(weth, wethHolder, await users[4].getAddress(), '1');
    // User4 deposits 1 WETH
    await weth.connect(users[4]).approve(pool.address, MAX_UINT_AMOUNT);
    await pool
      .connect(users[4])
      .deposit(weth.address, amountETHtoDeposit, await users[4].getAddress(), '0');

    // User4 borrows
    const userGlobalData = await pool.getUserAccountData(await users[4].getAddress());
    const usdcPrice = await oracle.getAssetPrice(usdc.address);
    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .div(usdcPrice.toString())
        .multipliedBy(0.9502)
        .toFixed(0)
    );
    console.log('Borrow', amountUSDCToBorrow.toString());
    await pool
      .connect(users[4])
      .borrow(
        usdc.address,
        amountUSDCToBorrow,
        RateMode.Variable,
        '0',
        await users[4].getAddress()
      );

    // Drops HF below 1
    const assetPrice = new BigNumber(usdcPrice.toString()).multipliedBy(1.12).toFixed(0);
    const mockAggregator = await (
      await new MockAggregatorFactory(await getFirstSigner()).deploy(assetPrice)
    ).deployed();

    const oracleAdminAddress = await oracle.owner();
    await impersonateAccountsHardhat([oracleAdminAddress]);
    oracleAdmin = ethers.provider.getSigner(oracleAdminAddress);
    await oracle.connect(oracleAdmin).setAssetSources([usdc.address], [mockAggregator.address]);

    // Mints usdc to the User3
    await topUpWithERC20(usdc, usdcHolder, await users[3].getAddress(), '2000');

    //approve protocol to access depositor wallet
    await usdc.connect(users[3]).approve(pool.address, MAX_UINT_AMOUNT);

    const userReserveDataBefore = await helpersContract.getUserReserveData(
      usdc.address,
      await users[4].getAddress()
    );

    const amountToLiquidate = userReserveDataBefore.currentVariableDebt.div(2);
    await pool
      .connect(users[3])
      .liquidationCall(
        weth.address,
        usdc.address,
        await users[4].getAddress(),
        amountToLiquidate,
        false
      );
  });

  it('User4 borrows 2 USDC stable', async () => {
    await pool
      .connect(users[4])
      .borrow(
        usdc.address,
        await convertToCurrencyDecimals(usdc.address, '2'),
        RateMode.Stable,
        '0',
        await users[4].getAddress()
      );
  });

  it('User1 Admin add User2 as StableRateManager', async () => {
    await permissionManager
      .connect(users[1])
      .addPermissions([PERMISSIONS.STABLE_RATE_MANAGER], [await users[2].getAddress()]);
  });

  it('User2 rebalanceStableRate of User4 borrowing', async () => {
    await expect(
      pool.connect(users[2]).rebalanceStableBorrowRate(usdc.address, await users[4].getAddress())
    ).to.be.revertedWith(LP_INTEREST_RATE_REBALANCE_CONDITIONS_NOT_MET);
  });

  it('User5 tries to deposit USDC (revert expected)', async () => {
    await expect(
      pool
        .connect(users[5])
        .deposit(
          usdc.address,
          await convertToCurrencyDecimals(usdc.address, '2'),
          await users[5].getAddress(),
          '0'
        )
    ).to.revertedWith(PLP_DEPOSITOR_UNAUTHORIZED);
  });

  it('User5 tries to borrow USDC (revert expected)', async () => {
    await expect(
      pool
        .connect(users[5])
        .borrow(
          usdc.address,
          await convertToCurrencyDecimals(usdc.address, '2'),
          RateMode.Variable,
          '0',
          await users[5].getAddress()
        )
    ).to.revertedWith(PLP_BORROWER_UNAUTHORIZED);
  });

  it('User5 tries to liquidate User4 (revert expected)', async () => {
    await expect(
      pool.connect(users[5]).liquidationCall(
        weth.address,
        usdc.address,
        await users[4].getAddress(),
        1, // amountToLiquidate
        false
      )
    ).to.revertedWith(PLP_LIQUIDATOR_UNAUTHORIZED);
  });

  it('User5 tries to rebalanceStableBorrowRate of User1 (revert expected)', async () => {
    await expect(
      pool.connect(users[5]).rebalanceStableBorrowRate(aave.address, await users[1].getAddress())
    ).to.revertedWith(PLP_CALLER_NOT_STABLE_RATE_MANAGER);
  });

  it('User5 tries to seize the WETH collateral of User2 (revert expected)', async () => {
    await expect(
      pool
        .connect(users[5])
        .seize(await users[2].getAddress(), [aave.address], await users[1].getAddress())
    ).to.be.revertedWith(PLP_INVALID_PERMISSION_ADMIN);
  });

  it('User5 tries to deposit ETH (revert expected)', async () => {
    // Top up user 5 with ether
    await ethHolder.sendTransaction({
      to: await users[5].getAddress(),
      value: ethers.utils.parseEther('2'),
    });
    await expect(
      wethGateway.connect(users[5]).depositETH(pool.address, await users[5].getAddress(), '0', {
        value: ethers.utils.parseEther('2'),
      })
    ).to.be.revertedWith(PLP_USER_UNAUTHORIZED);
  });

  it('Add user6 as PermissionAdmin and user7 as Depositor', async () => {
    await permissionManager
      .connect(permissionManagerAdmin)
      .addPermissionAdmins([await users[6].getAddress()]);

    await permissionManager
      .connect(users[6])
      .addPermissions([PERMISSIONS.DEPOSITOR], [await users[7].getAddress()]);
  });

  it('User6 tries to seize the WETH collateral of User2 (which is not under its control) (revert expected)', async () => {
    await expect(
      pool
        .connect(users[6])
        .seize(await users[2].getAddress(), [aave.address], await users[6].getAddress())
    ).to.be.revertedWith(PLP_INVALID_PERMISSION_ADMIN);
  });
});

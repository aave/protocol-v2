import { expect } from 'chai';
import rawHRE from 'hardhat';
import BigNumber from 'bignumber.js';
import { Signer } from 'ethers';
import { DRE } from '../../../helpers/misc-utils';
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

const config = {
  LendingPoolAddressesProvider: '',
  ReserveLogic: '',
  GenericLogic: '',
  ValidationLogic: '',
  LendingPoolImpl: '',
  LendingPool: '',
  LendingPoolConfiguratorImpl: '',
  LendingPoolConfigurator: '',
  StableAndVariableTokensHelper: '',
  ATokensAndRatesHelper: '',
  AaveOracle: '',
  LendingRateOracle: '',
  AaveProtocolDataProvider: '',
  StableDebtToken: '',
  VariableDebtToken: '',
  AToken: '',
  aTokenImpl: '',
  DefaultReserveInterestRateStrategy: '',
  rateStrategyAAVE: '',
  rateStrategyWETH: '',
  WalletBalanceProvider: '',
  PermissionManager: '',
  PermissionedStableDebtToken: '',
  PermissionedVariableDebtToken: '',
  rateStrategyStable: '',
  rateStrategyWBTC: '',
  PermissionedWETHGateway: '',
  UiPoolDataProvider: '',
};

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
  });

  it('Deploy the PermissionedWethGateway', async () => {
    wethGateway = await (
      await new PermissionedWETHGatewayFactory(users[0]).deploy(WETH_ADDRESS)
    ).deployed();
    await wethGateway.authorizeLendingPool(pool.address);
  });

  it('Deploy the LendingPoolCollateralManager and register it at LendingPoolAddressesProvider', async () => {
    const poolCollateralManager = await new LendingPoolCollateralManagerFactory(users[0]).deploy();

    const providerAdminAddress = await provider.owner();
    await impersonateAccountsHardhat([providerAdminAddress]);
    const providerAdmin = ethers.provider.getSigner(providerAdminAddress);
    await provider
      .connect(providerAdmin)
      .setLendingPoolCollateralManager(poolCollateralManager.address);
  });

  it('Pool Data', async () => {
    console.log('PERMISSION MANAGER', await pool.PERMISSION_MANAGER());

    const tokenData = await helpersContract.getAllReservesTokens();
    let reserveData, reserveTokens, aToken;
    console.log('Reserves available: ');
    for (const token of tokenData) {
      console.log(token.symbol, '-', token.tokenAddress);
      reserveData = await helpersContract.getReserveData(token.tokenAddress);
      reserveTokens = await helpersContract.getReserveTokensAddresses(token.tokenAddress);
      // console.log(reserveData);
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

  it('User1 Admin gives permissions to wethGateway', async () => {
    await permissionManager
      .connect(users[1])
      .addPermissions(
        [PERMISSIONS.DEPOSITOR, PERMISSIONS.BORROWER, PERMISSIONS.LIQUIDATOR],
        [wethGateway.address, wethGateway.address, wethGateway.address]
      );
  });

  it('User2 supplies 10000 USDC, 10 AAVE, 10 WBTC, 10 WETH. 10 ETH', async () => {
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

    // console.log(await helpersContract.getReserveData(usdc.address));
    // console.log(
    //   await helpersContract.getUserReserveData(usdc.address, await users[2].getAddress())
    // );

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

    // Top up user 5 with ether
    await ethHolder.sendTransaction({
      to: await users[2].getAddress(),
      value: ethers.utils.parseEther('10'),
    });
    await wethGateway.connect(users[2]).depositETH(pool.address, await users[2].getAddress(), '0', {
      value: ethers.utils.parseEther('10'),
    });
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
    // console.log(
    //   await helpersContract.getUserReserveData(aave.address, await users[2].getAddress())
    // );
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

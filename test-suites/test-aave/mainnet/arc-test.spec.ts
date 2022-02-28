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

const config = {
  LendingPoolAddressesProvider: '0x6FdfafB66d39cD72CFE7984D3Bbcc76632faAb00',
  ReserveLogic: '0x7DAD18d71880C8d7b58544195818255BAaF3d990',
  GenericLogic: '0xD342bf0cc6634a80B4cC45eC7553b316C15dDdB9',
  ValidationLogic: '0x357895E412b724f267645873D2738fF25b7A2Cf6',
  LendingPoolImpl: '0xfbF029508c061B440D0cF7Fd639e77Fb2E196241',
  LendingPool: '0x37D7306019a38Af123e4b245Eb6C28AF552e0bB0',
  LendingPoolConfiguratorImpl: '0x8e5E28f273E3a6612A9C5d6F16aa67DA156042F4',
  LendingPoolConfigurator: '0x4e1c7865e7BE78A7748724Fa0409e88dc14E67aA',
  StableAndVariableTokensHelper: '0x42E74d1065808b7cBC5B20CdEA702551FC613F0c',
  ATokensAndRatesHelper: '0x52c62481e923475C0e975a565F7ceec9148Cea42',
  AaveOracle: '0xB8a7bc0d13B1f5460513040a97F404b4fea7D2f3',
  LendingRateOracle: '0xfA3c34d734fe0106C87917683ca45dffBe3b3B00',
  AaveProtocolDataProvider: '0x71B53fC437cCD988b1b89B1D4605c3c3d0C810ea',
  StableDebtToken: '0xf5cb54A1d47AC211F1608C7b8FB211b5580c8a3f',
  VariableDebtToken: '0x3E26DAb254342892DFBa7097Dd78845D12A4586c',
  AToken: '0x6faeE7AaC498326660aC2B7207B9f67666073111',
  aTokenImpl: '0x6faeE7AaC498326660aC2B7207B9f67666073111',
  DefaultReserveInterestRateStrategy: '0x5E4b5f5eb05E244632e0eA584525F11Dd03f5B38',
  rateStrategyAAVE: '0x5E4b5f5eb05E244632e0eA584525F11Dd03f5B38',
  rateStrategyWETH: '0xC2B0945C6D0A842eC2a1345f08c4ef2060452B6A',
  WalletBalanceProvider: '0x457419b361fF5340315De18F626b12eE2eAeDDa1',
  PermissionManager: '0xF4a1F5fEA79C3609514A417425971FadC10eCfBE',
  PermissionedStableDebtToken: '0x71c60e94C10d90D0386BaC547378c136cb6aD2b4',
  PermissionedVariableDebtToken: '0x82b488281aeF001dAcF106b085cc59EEf0995131',
  rateStrategyStable: '0x81D7Bb11D682005B3Fca0Ef48381263BeC9b2d1C',
  rateStrategyWBTC: '0x1205ACe6831E5518E00A16f1820cD73ce198bEF6',
  PermissionedWETHGateway: '0xD51E46B02eCB71357cBdf661E2789EC787d94Af9',
  UiPoolDataProvider: '0xED200aceFd4E63fe17B97B02d2616228d0df5398',
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

// import {
//   LendingPoolInstance,
//   LendingPoolCoreInstance,
//   IPriceOracleInstance,
//   ATokenInstance,
//   LendingPoolAddressesProviderInstance,
//   MintableERC20Instance,
// } from '../utils/typechain-types/truffle-contracts';
// import {
//   ContractId,
//   IReserveParams,
//   iATokenBase,
//   iAavePoolAssets,
//   iAssetsWithoutETH,
//   ITestEnvWithoutInstances,
//   RateMode,
// } from '../utils/types';
// import BigNumber from 'bignumber.js';
// import {
//   APPROVAL_AMOUNT_LENDING_POOL_CORE,
//   oneEther,
//   ETHEREUM_ADDRESS,
// } from '../utils/constants';
// import {testEnvProviderWithoutInstances} from '../utils/truffle/dlp-tests-env';
// import {convertToCurrencyDecimals} from '../utils/misc-utils';
// import {getTruffleContractInstance} from '../utils/truffle/truffle-core-utils';

// const expectRevert = require('@openzeppelin/test-helpers').expectRevert;

// const {expect} = require('chai');

// const almostEqual: any = function(this: any, expected: any, actual: any): any {
//   this.assert(
//     expected.plus(new BigNumber(1)).eq(actual) ||
//       expected.plus(new BigNumber(2)).eq(actual) ||
//       actual.plus(new BigNumber(1)).eq(expected) ||
//       actual.plus(new BigNumber(2)).eq(expected) ||
//       expected.eq(actual),
//     'expected #{act} to be almost equal #{exp}',
//     'expected #{act} to be different from #{exp}',
//     expected.toString(),
//     actual.toString()
//   );
// };

// require('chai').use(function(chai: any, utils: any) {
//   chai.Assertion.overwriteMethod('almostEqual', function(original: any) {
//     return function(this: any, value: any) {
//       if (utils.flag(this, 'bignumber')) {
//         var expected = new BigNumber(value);
//         var actual = new BigNumber(this._obj);
//         almostEqual.apply(this, [expected, actual]);
//       } else {
//         original.apply(this, arguments);
//       }
//     };
//   });
// });

// contract('LendingPool liquidation - liquidator receiving aToken', async ([deployer, ...users]) => {
//   let _testEnvProvider: ITestEnvWithoutInstances;
//   let _lendingPoolInstance: LendingPoolInstance;
//   let _lendingPoolCoreInstance: LendingPoolCoreInstance;
//   let _lendingPoolAddressesProviderInstance: LendingPoolAddressesProviderInstance;
//   let _priceOracleInstance: IPriceOracleInstance;
//   let _aTokenInstances: iATokenBase<ATokenInstance>;
//   let _tokenInstances: iAssetsWithoutETH<MintableERC20Instance>;

//   let _daiAddress: string;

//   let _reservesParams: iAavePoolAssets<IReserveParams>;

//   let _depositorAddress: string;
//   let _borrowerAddress: string;

//   let _web3: Web3;

//   let _initialDepositorETHBalance: string;

//   before('Initializing LendingPool test variables', async () => {
//     console.time('setup-test');
//     _testEnvProvider = await testEnvProviderWithoutInstances(artifacts, [deployer, ...users]);

//     const {
//       getWeb3,
//       getAllAssetsInstances,
//       getFirstBorrowerAddressOnTests,
//       getFirstDepositorAddressOnTests,
//       getAavePoolReservesParams,
//       getLendingPoolInstance,
//       getLendingPoolCoreInstance,
//       getPriceOracleInstance,
//       getATokenInstances,
//       getLendingPoolAddressesProviderInstance,
//     } = _testEnvProvider;

//     const instances = await Promise.all([
//       getLendingPoolInstance(),
//       getLendingPoolCoreInstance(),
//       getPriceOracleInstance(),
//       getATokenInstances(),
//       getLendingPoolAddressesProviderInstance(),
//       getAllAssetsInstances(),
//     ]);

//     _reservesParams = await getAavePoolReservesParams();
//     _lendingPoolInstance = instances[0];
//     _lendingPoolCoreInstance = instances[1];
//     _priceOracleInstance = instances[2];
//     _aTokenInstances = instances[3];
//     _lendingPoolAddressesProviderInstance = instances[4];
//     _tokenInstances = instances[5];
//     _daiAddress = _tokenInstances.DAI.address;
//     _depositorAddress = await getFirstDepositorAddressOnTests();
//     _borrowerAddress = await getFirstBorrowerAddressOnTests();

//     _web3 = await getWeb3();
//     _initialDepositorETHBalance = await _web3.eth.getBalance(_depositorAddress);
//     console.timeEnd('setup-test');
//   });

//   it('LIQUIDATION - Deposits ETH, borrows DAI/Check liquidation fails because health factor is above 1', async () => {
//     const {DAI: daiInstance} = _tokenInstances;

//     const aEthInstance: ATokenInstance = await getTruffleContractInstance(
//       artifacts,
//       ContractId.AToken,
//       await _lendingPoolCoreInstance.getReserveATokenAddress(ETHEREUM_ADDRESS)
//     );

//     //mints DAI to depositor
//     await daiInstance.mint(await convertToCurrencyDecimals(daiInstance.address, '1000'), {
//       from: _depositorAddress,
//     });

//     //approve protocol to access depositor wallet
//     await daiInstance.approve(_lendingPoolCoreInstance.address, APPROVAL_AMOUNT_LENDING_POOL_CORE, {
//       from: _depositorAddress,
//     });

//     //user 1 deposits 1000 DAI
//     const amountDAItoDeposit = await convertToCurrencyDecimals(_daiAddress, '1000');

//     await _lendingPoolInstance.deposit(_daiAddress, amountDAItoDeposit, '0', {
//       from: _depositorAddress,
//     });

//     //user 2 deposits 1 ETH
//     const amountETHtoDeposit = await convertToCurrencyDecimals(ETHEREUM_ADDRESS, '1');

//     await _lendingPoolInstance.deposit(ETHEREUM_ADDRESS, amountETHtoDeposit, '0', {
//       from: _borrowerAddress,
//       value: amountETHtoDeposit,
//     });

//     //user 2 borrows

//     const userGlobalData: any = await _lendingPoolInstance.getUserAccountData(_borrowerAddress);
//     const daiPrice = await _priceOracleInstance.getAssetPrice(_daiAddress);

//     const amountDAIToBorrow = await convertToCurrencyDecimals(
//       _daiAddress,
//       new BigNumber(userGlobalData.availableBorrowsETH)
//         .div(daiPrice)
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await _lendingPoolInstance.borrow(_daiAddress, amountDAIToBorrow, RateMode.Stable, '0', {
//       from: _borrowerAddress,
//     });

//     const userGlobalDataAfter: any = await _lendingPoolInstance.getUserAccountData(
//       _borrowerAddress
//     );

//     expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.bignumber.equal(
//       '80',
//       'Invalid liquidation threshold'
//     );

//     //user 2 tries to borrow
//     await expectRevert(
//       _lendingPoolInstance.liquidationCall(
//         ETHEREUM_ADDRESS,
//         _daiAddress,
//         _borrowerAddress,
//         amountDAIToBorrow,
//         true
//       ),
//       'Health factor is not below the threshold'
//     );
//   });

//   it('LIQUIDATION - Drop the health factor below 1', async () => {
//     const daiPrice = await _priceOracleInstance.getAssetPrice(_daiAddress);

//     //halving the price of ETH - means doubling the DAIETH exchange rate

//     await _priceOracleInstance.setAssetPrice(
//       _daiAddress,
//       new BigNumber(daiPrice).multipliedBy(1.15).toFixed(0)
//     );

//     const userGlobalData: any = await _lendingPoolInstance.getUserAccountData(_borrowerAddress);

//     expect(userGlobalData.healthFactor).to.be.bignumber.lt(
//       oneEther.toFixed(0),
//       'Invalid health factor'
//     );
//   });

//   it('LIQUIDATION - Tries to liquidate a different currency than the loan principal', async () => {
//     //user 2 tries to borrow
//     await expectRevert(
//       _lendingPoolInstance.liquidationCall(
//         ETHEREUM_ADDRESS,
//         ETHEREUM_ADDRESS,
//         _borrowerAddress,
//         oneEther,
//         true
//       ),
//       'User did not borrow the specified currency'
//     );
//   });

//   it('LIQUIDATION - Tries to liquidate a different collateral than the borrower collateral', async () => {
//     //user 2 tries to borrow
//     await expectRevert(
//       _lendingPoolInstance.liquidationCall(
//         _daiAddress,
//         _daiAddress,
//         _borrowerAddress,
//         oneEther,
//         true
//       ),
//       'Invalid collateral to liquidate'
//     );
//   });

//   it('LIQUIDATION - Liquidates the borrow', async () => {
//     const {DAI: daiInstance} = _tokenInstances;

//     //mints dai to the caller

//     await daiInstance.mint(await convertToCurrencyDecimals(daiInstance.address, '1000'));

//     //approve protocol to access depositor wallet
//     await daiInstance.approve(_lendingPoolCoreInstance.address, APPROVAL_AMOUNT_LENDING_POOL_CORE);

//     const userReserveDataBefore: any = await _lendingPoolInstance.getUserReserveData(
//       _daiAddress,
//       _borrowerAddress
//     );

//     const daiReserveDataBefore: any = await _lendingPoolInstance.getReserveData(_daiAddress);
//     const ethReserveDataBefore: any = await _lendingPoolInstance.getReserveData(ETHEREUM_ADDRESS);

//     const amountToLiquidate = new BigNumber(userReserveDataBefore.currentBorrowBalance)
//       .div(2)
//       .toFixed(0);

//     await _lendingPoolInstance.liquidationCall(
//       ETHEREUM_ADDRESS,
//       _daiAddress,
//       _borrowerAddress,
//       amountToLiquidate,
//       true
//     );

//     const userReserveDataAfter: any = await _lendingPoolInstance.getUserReserveData(
//       _daiAddress,
//       _borrowerAddress
//     );

//     const userGlobalDataAfter: any = await _lendingPoolInstance.getUserAccountData(
//       _borrowerAddress
//     );

//     const daiReserveDataAfter: any = await _lendingPoolInstance.getReserveData(_daiAddress);
//     const ethReserveDataAfter: any = await _lendingPoolInstance.getReserveData(ETHEREUM_ADDRESS);

//     const feeAddress = await _lendingPoolAddressesProviderInstance.getTokenDistributor();

//     const feeAddressBalance = await web3.eth.getBalance(feeAddress);

//     const collateralPrice = await _priceOracleInstance.getAssetPrice(ETHEREUM_ADDRESS);
//     const principalPrice = await _priceOracleInstance.getAssetPrice(_daiAddress);

//     const collateralDecimals = await _lendingPoolCoreInstance.getReserveDecimals(ETHEREUM_ADDRESS);
//     const principalDecimals = await _lendingPoolCoreInstance.getReserveDecimals(_daiAddress);

//     const expectedCollateralLiquidated = new BigNumber(principalPrice)
//       .times(new BigNumber(amountToLiquidate).times(105))
//       .times(new BigNumber(10).pow(collateralDecimals))
//       .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
//       .decimalPlaces(0, BigNumber.ROUND_DOWN);

//     const expectedFeeLiquidated = new BigNumber(principalPrice)
//       .times(new BigNumber(userReserveDataBefore.originationFee).times(105))
//       .times(new BigNumber(10).pow(collateralDecimals))
//       .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
//       .div(100)
//       .decimalPlaces(0, BigNumber.ROUND_DOWN);

//     expect(userGlobalDataAfter.healthFactor).to.be.bignumber.gt(
//       oneEther.toFixed(0),
//       'Invalid health factor'
//     );

//     expect(userReserveDataAfter.originationFee).to.be.bignumber.eq(
//       '0',
//       'Origination fee should be repaid'
//     );

//     expect(feeAddressBalance).to.be.bignumber.gt('0');

//     expect(userReserveDataAfter.principalBorrowBalance).to.be.bignumber.almostEqual(
//       new BigNumber(userReserveDataBefore.currentBorrowBalance).minus(amountToLiquidate).toFixed(0),
//       'Invalid user borrow balance after liquidation'
//     );

//     expect(daiReserveDataAfter.availableLiquidity).to.be.bignumber.almostEqual(
//       new BigNumber(daiReserveDataBefore.availableLiquidity).plus(amountToLiquidate).toFixed(0),
//       'Invalid principal available liquidity'
//     );

//     expect(ethReserveDataAfter.availableLiquidity).to.be.bignumber.almostEqual(
//       new BigNumber(ethReserveDataBefore.availableLiquidity)
//         .minus(expectedFeeLiquidated)
//         .toFixed(0),
//       'Invalid collateral available liquidity'
//     );
//   });

//   it('User 3 deposits 1000 USDC, user 4 1 ETH, user 4 borrows - drops HF, liquidates the borrow', async () => {
//     const {USDC: usdcInstance} = _tokenInstances;

//     //mints USDC to depositor
//     await usdcInstance.mint(await convertToCurrencyDecimals(usdcInstance.address, '1000'), {
//       from: users[3],
//     });

//     //approve protocol to access depositor wallet
//     await usdcInstance.approve(
//       _lendingPoolCoreInstance.address,
//       APPROVAL_AMOUNT_LENDING_POOL_CORE,
//       {
//         from: users[3],
//       }
//     );

//     //user 3 deposits 1000 USDC
//     const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdcInstance.address, '1000');

//     await _lendingPoolInstance.deposit(usdcInstance.address, amountUSDCtoDeposit, '0', {
//       from: users[3],
//     });

//     //user 4 deposits 1 ETH
//     const amountETHtoDeposit = await convertToCurrencyDecimals(ETHEREUM_ADDRESS, '1');

//     await _lendingPoolInstance.deposit(ETHEREUM_ADDRESS, amountETHtoDeposit, '0', {
//       from: users[4],
//       value: amountETHtoDeposit,
//     });

//     //user 4 borrows
//     const userGlobalData: any = await _lendingPoolInstance.getUserAccountData(users[4]);

//     const usdcPrice = await _priceOracleInstance.getAssetPrice(usdcInstance.address);

//     const amountUSDCToBorrow = await convertToCurrencyDecimals(
//       usdcInstance.address,
//       new BigNumber(userGlobalData.availableBorrowsETH)
//         .div(usdcPrice)
//         .multipliedBy(0.95)
//         .toFixed(0)
//     );

//     await _lendingPoolInstance.borrow(
//       usdcInstance.address,
//       amountUSDCToBorrow,
//       RateMode.Stable,
//       '0',
//       {
//         from: users[4],
//       }
//     );

//     //drops HF below 1

//     await _priceOracleInstance.setAssetPrice(
//       usdcInstance.address,
//       new BigNumber(usdcPrice).multipliedBy(1.2).toFixed(0)
//     );

//     //mints dai to the liquidator

//     await usdcInstance.mint(await convertToCurrencyDecimals(usdcInstance.address, '1000'));

//     //approve protocol to access depositor wallet
//     await usdcInstance.approve(_lendingPoolCoreInstance.address, APPROVAL_AMOUNT_LENDING_POOL_CORE);

//     const userReserveDataBefore: any = await _lendingPoolInstance.getUserReserveData(
//       usdcInstance.address,
//       users[4]
//     );

//     const usdcReserveDataBefore: any = await _lendingPoolInstance.getReserveData(
//       usdcInstance.address
//     );
//     const ethReserveDataBefore: any = await _lendingPoolInstance.getReserveData(ETHEREUM_ADDRESS);

//     const amountToLiquidate = new BigNumber(userReserveDataBefore.currentBorrowBalance)
//       .div(2)
//       .toFixed(0);

//     await _lendingPoolInstance.liquidationCall(
//       ETHEREUM_ADDRESS,
//       usdcInstance.address,
//       users[4],
//       amountToLiquidate,
//       true
//     );

//     const userReserveDataAfter: any = await _lendingPoolInstance.getUserReserveData(
//       usdcInstance.address,
//       users[4]
//     );

//     const userGlobalDataAfter: any = await _lendingPoolInstance.getUserAccountData(users[4]);

//     const usdcReserveDataAfter: any = await _lendingPoolInstance.getReserveData(
//       usdcInstance.address
//     );
//     const ethReserveDataAfter: any = await _lendingPoolInstance.getReserveData(ETHEREUM_ADDRESS);

//     const feeAddress = await _lendingPoolAddressesProviderInstance.getTokenDistributor();

//     const feeAddressBalance = await web3.eth.getBalance(feeAddress);

//     const collateralPrice = await _priceOracleInstance.getAssetPrice(ETHEREUM_ADDRESS);
//     const principalPrice = await _priceOracleInstance.getAssetPrice(usdcInstance.address);

//     const collateralDecimals = await _lendingPoolCoreInstance.getReserveDecimals(ETHEREUM_ADDRESS);
//     const principalDecimals = await _lendingPoolCoreInstance.getReserveDecimals(
//       usdcInstance.address
//     );

//     const expectedCollateralLiquidated = new BigNumber(principalPrice)
//       .times(new BigNumber(amountToLiquidate).times(105))
//       .times(new BigNumber(10).pow(collateralDecimals))
//       .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
//       .decimalPlaces(0, BigNumber.ROUND_DOWN);

//     const expectedFeeLiquidated = new BigNumber(principalPrice)
//       .times(new BigNumber(userReserveDataBefore.originationFee).times(105))
//       .times(new BigNumber(10).pow(collateralDecimals))
//       .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
//       .div(100)
//       .decimalPlaces(0, BigNumber.ROUND_DOWN);

//     expect(userGlobalDataAfter.healthFactor).to.be.bignumber.gt(
//       oneEther.toFixed(0),
//       'Invalid health factor'
//     );

//     expect(userReserveDataAfter.originationFee).to.be.bignumber.eq(
//       '0',
//       'Origination fee should be repaid'
//     );

//     expect(feeAddressBalance).to.be.bignumber.gt('0');

//     expect(userReserveDataAfter.principalBorrowBalance).to.be.bignumber.almostEqual(
//       new BigNumber(userReserveDataBefore.currentBorrowBalance).minus(amountToLiquidate).toFixed(0),
//       'Invalid user borrow balance after liquidation'
//     );

//     expect(usdcReserveDataAfter.availableLiquidity).to.be.bignumber.almostEqual(
//       new BigNumber(usdcReserveDataBefore.availableLiquidity).plus(amountToLiquidate).toFixed(0),
//       'Invalid principal available liquidity'
//     );

//     expect(ethReserveDataAfter.availableLiquidity).to.be.bignumber.almostEqual(
//       new BigNumber(ethReserveDataBefore.availableLiquidity)
//         .minus(expectedFeeLiquidated)
//         .toFixed(0),
//       'Invalid collateral available liquidity'
//     );
//   });
// });

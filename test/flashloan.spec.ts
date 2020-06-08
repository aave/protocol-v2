// import {
//   LendingPoolInstance,
//   LendingPoolCoreInstance,
//   IPriceOracleInstance,
//   MockFlashLoanReceiverInstance,
//   TokenDistributorInstance,
//   MintableERC20Instance,
//   ATokenInstance,
// } from '../utils/typechain-types/truffle-contracts';
// import {iATokenBase, iAssetsWithoutETH, ITestEnvWithoutInstances} from '../utils/types';
// import BigNumber from 'bignumber.js';
// import {
//   APPROVAL_AMOUNT_LENDING_POOL_CORE,
//   oneEther,
//   oneRay,
//   ETHEREUM_ADDRESS,
// } from '../utils/constants';
// import {testEnvProviderWithoutInstances} from '../utils/truffle/dlp-tests-env';
// import {convertToCurrencyDecimals} from '../utils/misc-utils';

// const expectRevert = require('@openzeppelin/test-helpers').expectRevert;

// const {expect} = require('chai');

// contract('LendingPool FlashLoan function', async ([deployer, ...users]) => {
//   let _testEnvProvider: ITestEnvWithoutInstances;
//   let _lendingPoolInstance: LendingPoolInstance;
//   let _lendingPoolCoreInstance: LendingPoolCoreInstance;
//   let _mockFlashLoanReceiverInstance: MockFlashLoanReceiverInstance;
//   let _priceOracleInstance: IPriceOracleInstance;
//   let _aTokenInstances: iATokenBase<ATokenInstance>;
//   let _tokenInstances: iAssetsWithoutETH<MintableERC20Instance>;
//   let _tokenDistributor: TokenDistributorInstance;
//   let _daiAddress: string;
//   let _depositorAddress: string;
//   let _web3: Web3;
//   let _initialDepositorETHBalance: string;

//   before('Initializing LendingPool test variables', async () => {
//     console.time('setup-test');
//     _testEnvProvider = await testEnvProviderWithoutInstances(artifacts, [deployer, ...users]);

//     const {
//       getWeb3,
//       getAllAssetsInstances,
//       getFirstDepositorAddressOnTests,
//       getLendingPoolInstance,
//       getLendingPoolCoreInstance,
//       getPriceOracleInstance,
//       getATokenInstances,
//       getMockFlashLoanReceiverInstance,
//       getTokenDistributorInstance,
//     } = _testEnvProvider;

//     const instances = await Promise.all([
//       getLendingPoolInstance(),
//       getLendingPoolCoreInstance(),
//       getPriceOracleInstance(),
//       getATokenInstances(),
//       getMockFlashLoanReceiverInstance(),
//       getAllAssetsInstances(),
//       getTokenDistributorInstance(),
//     ]);

//     _lendingPoolInstance = instances[0];
//     _lendingPoolCoreInstance = instances[1];
//     _priceOracleInstance = instances[2];
//     _aTokenInstances = instances[3];
//     _mockFlashLoanReceiverInstance = instances[4];
//     _tokenInstances = instances[5];
//     _daiAddress = _tokenInstances.DAI.address;
//     _depositorAddress = await getFirstDepositorAddressOnTests();
//     _tokenDistributor = instances[6];

//     _web3 = await getWeb3();
//     _initialDepositorETHBalance = await _web3.eth.getBalance(_depositorAddress);

//     console.timeEnd('setup-test');
//   });

//   it('Deposits ETH into the reserve', async () => {
//     const amountToDeposit = await convertToCurrencyDecimals(ETHEREUM_ADDRESS, '1');

//     await _lendingPoolInstance.deposit(ETHEREUM_ADDRESS, amountToDeposit, '0', {
//       from: _depositorAddress,
//       value: amountToDeposit,
//     });
//   });

//   it('Takes ETH flashloan, returns the funds correctly', async () => {
//     //move funds to the MockFlashLoanReceiver contract

//     let send = web3.eth.sendTransaction({
//       from: deployer,
//       to: _mockFlashLoanReceiverInstance.address,
//       value: web3.utils.toWei('0.5', 'ether'),
//     });

//     const txResult = await _lendingPoolInstance.flashLoan(
//       _mockFlashLoanReceiverInstance.address,
//       ETHEREUM_ADDRESS,
//       new BigNumber(0.8).multipliedBy(oneEther),
//       '0x10'
//     );

//     const reserveData: any = await _lendingPoolInstance.getReserveData(ETHEREUM_ADDRESS);
//     const tokenDistributorBalance = await _web3.eth.getBalance(_tokenDistributor.address);

//     const currentLiquidityRate = reserveData.liquidityRate;
//     const currentLiquidityIndex = reserveData.liquidityIndex;

//     expect(reserveData.totalLiquidity.toString()).to.be.equal('1000504000000000000');
//     expect(currentLiquidityRate.toString()).to.be.equal('0');
//     expect(currentLiquidityIndex.toString()).to.be.equal('1000504000000000000000000000');
//     expect(tokenDistributorBalance.toString()).to.be.equal('216000000000000');
//   });

//   it('Takes an ETH flashloan as big as the available liquidity', async () => {
//     //move funds to the MockFlashLoanReceiver contract

//     let send = web3.eth.sendTransaction({
//       from: deployer,
//       to: _mockFlashLoanReceiverInstance.address,
//       value: web3.utils.toWei('0.5', 'ether'),
//     });

//     const txResult = await _lendingPoolInstance.flashLoan(
//       _mockFlashLoanReceiverInstance.address,
//       ETHEREUM_ADDRESS,
//       '1000504000000000000',
//       '0x10'
//     );

//     const reserveData: any = await _lendingPoolInstance.getReserveData(ETHEREUM_ADDRESS);
//     const tokenDistributorBalance = await _web3.eth.getBalance(_tokenDistributor.address);

//     const currentLiqudityRate = reserveData.liquidityRate;
//     const currentLiquidityIndex = reserveData.liquidityIndex;

//     expect(reserveData.totalLiquidity.toString()).to.be.equal('1001134317520000000');
//     expect(currentLiqudityRate.toString()).to.be.equal('0');
//     expect(currentLiquidityIndex.toString()).to.be.equal('1001134317520000000000000000');
//     expect(tokenDistributorBalance.toString()).to.be.equal('486136080000000');
//   });

//   it('Takes ETH flashloan, does not return the funds (revert expected)', async () => {
//     //move funds to the MockFlashLoanReceiver contract

//     let send = web3.eth.sendTransaction({
//       from: deployer,
//       to: _mockFlashLoanReceiverInstance.address,
//       value: web3.utils.toWei('0.5', 'ether'),
//     });

//     await _mockFlashLoanReceiverInstance.setFailExecutionTransfer(true);

//     await expectRevert(
//       _lendingPoolInstance.flashLoan(
//         _mockFlashLoanReceiverInstance.address,
//         ETHEREUM_ADDRESS,
//         new BigNumber(0.8).multipliedBy(oneEther),
//         '0x10'
//       ),
//       'The actual balance of the protocol is inconsistent'
//     );
//   });

//   it('tries to take a very small flashloan, which would result in 0 fees (revert expected)', async () => {
//     //move funds to the MockFlashLoanReceiver contract

//     await expectRevert(
//       _lendingPoolInstance.flashLoan(
//         _mockFlashLoanReceiverInstance.address,
//         ETHEREUM_ADDRESS,
//         '1', //1 wei loan
//         '0x10'
//       ),
//       'The requested amount is too small for a flashLoan.'
//     );
//   });

//   it('tries to take a flashloan that is bigger than the available liquidity (revert expected)', async () => {
//     //move funds to the MockFlashLoanReceiver contract

//     await expectRevert(
//       _lendingPoolInstance.flashLoan(
//         _mockFlashLoanReceiverInstance.address,
//         ETHEREUM_ADDRESS,
//         '1004415000000000000', //slightly higher than the available liquidity
//         '0x10'
//       ),
//       'There is not enough liquidity available to borrow'
//     );
//   });

//   it('tries to take a flashloan using a non contract address as receiver (revert expected)', async () => {
//     //move funds to the MockFlashLoanReceiver contract

//     await expectRevert(
//       _lendingPoolInstance.flashLoan(deployer, ETHEREUM_ADDRESS, '1000000000000000000', '0x10'),
//       'revert'
//     );
//   });

//   it('Deposits DAI into the reserve', async () => {
//     const {DAI: daiInstance} = _tokenInstances;

//     //mints DAI to depositor
//     await daiInstance.mint(await convertToCurrencyDecimals(daiInstance.address, '1000'), {
//       from: _depositorAddress,
//     });

//     //approve protocol to access depositor wallet
//     await daiInstance.approve(_lendingPoolCoreInstance.address, APPROVAL_AMOUNT_LENDING_POOL_CORE, {
//       from: _depositorAddress,
//     });

//     const amountToDeposit = await convertToCurrencyDecimals(_daiAddress, '1000');

//     await _lendingPoolInstance.deposit(daiInstance.address, amountToDeposit, '0', {
//       from: _depositorAddress,
//     });
//   });

//   it('Takes out a 500 DAI flashloan, returns the funds correctly', async () => {
//     const {DAI: daiInstance} = _tokenInstances;

//     await _mockFlashLoanReceiverInstance.setFailExecutionTransfer(false);

//     await _lendingPoolInstance.flashLoan(
//       _mockFlashLoanReceiverInstance.address,
//       _daiAddress,
//       new BigNumber(500).multipliedBy(oneEther),
//       '0x10'
//     );

//     const reserveData: any = await _lendingPoolInstance.getReserveData(_daiAddress);
//     const userData: any = await _lendingPoolInstance.getUserReserveData(_daiAddress, deployer);

//     const totalLiquidity = reserveData.totalLiquidity.toString();
//     const currentLiqudityRate = reserveData.liquidityRate.toString();
//     const currentLiquidityIndex = reserveData.liquidityIndex.toString();
//     const currentUserBalance = userData.currentATokenBalance.toString();

//     const expectedLiquidity = new BigNumber('1000.315').multipliedBy(oneEther).toFixed();

//     const tokenDistributorBalance = await daiInstance.balanceOf(_tokenDistributor.address);

//     expect(totalLiquidity).to.be.equal(expectedLiquidity, 'Invalid total liquidity');
//     expect(currentLiqudityRate).to.be.equal('0', 'Invalid liquidity rate');
//     expect(currentLiquidityIndex).to.be.equal(
//       new BigNumber('1.000315').multipliedBy(oneRay).toFixed(),
//       'Invalid liquidity index'
//     );
//     expect(currentUserBalance.toString()).to.be.equal(expectedLiquidity, 'Invalid user balance');

//     expect(tokenDistributorBalance.toString()).to.be.equal(
//       new BigNumber('0.135').multipliedBy(oneEther).toFixed(),
//       'Invalid token distributor balance'
//     );
//   });

//   it('Takes out a 500 DAI flashloan, does not return the funds (revert expected)', async () => {
//     //move funds to the MockFlashLoanReceiver contract

//     await _mockFlashLoanReceiverInstance.setFailExecutionTransfer(true);

//     await expectRevert(
//       _lendingPoolInstance.flashLoan(
//         _mockFlashLoanReceiverInstance.address,
//         _daiAddress,
//         new BigNumber(500).multipliedBy(oneEther),
//         '0x10'
//       ),
//       'The actual balance of the protocol is inconsistent'
//     );
//   });
// });

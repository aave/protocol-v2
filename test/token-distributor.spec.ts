// import {
//   ITestEnv,
//   ContractsInstancesOrigin,
//   iBasicDistributionParams,
//   iTokenBalances,
//   iDistributionParams,
// } from '../utils/types';
// import {
//   TokenDistributorInstance,
//   MintableERC20Instance,
// } from '../utils/typechain-types/truffle-contracts';
// import {testEnvProvider} from '../utils/truffle/dlp-tests-env';
// import {
//   TOKEN_DISTRIBUTOR_PERCENTAGE_BASE,
//   ETHEREUM_ADDRESS,
//   ONE_ADDRESS,
//   NIL_ADDRESS,
// } from '../utils/constants';
// import BigNumber from 'bignumber.js';

// import {expect} from 'chai';

// const testAndExecMintAndTransferTokens = async (
//   tokenInstance: MintableERC20Instance,
//   amount: string,
//   minter: string,
//   receiver: string
// ) => {
//   const initialMinterBalance = new BigNumber(await tokenInstance.balanceOf(minter));
//   const initialReceiverBalance = new BigNumber(await tokenInstance.balanceOf(receiver));
//   await tokenInstance.mint(amount, {
//     from: minter,
//   });

//   expect(initialMinterBalance.plus(amount).toFixed()).to.be.equal(
//     new BigNumber(await tokenInstance.balanceOf(minter)).toFixed()
//   );

//   await tokenInstance.transfer(receiver, amount, {from: minter});

//   expect(initialReceiverBalance.plus(amount).toFixed()).to.be.equal(
//     new BigNumber(await tokenInstance.balanceOf(receiver)).toFixed()
//   );
// };

// const testAndExecEthTransfer = async (
//   amount: string,
//   sender: string,
//   receiver: string,
//   web3: Web3
// ) => {
//   const initialReceiverEthBalance = await web3.eth.getBalance(receiver);
//   await web3.eth.sendTransaction({
//     from: sender,
//     to: receiver,
//     value: amount,
//   });

//   expect(new BigNumber(initialReceiverEthBalance).plus(amount).toFixed()).to.be.equal(
//     await web3.eth.getBalance(receiver)
//   );
// };

// const testAndExecDistributeToken = async (
//   tokenInstances: MintableERC20Instance[],
//   tokenToBurnInstance: MintableERC20Instance,
//   tokenDistributorInstance: TokenDistributorInstance,
//   distributionParams: iBasicDistributionParams[]
// ) => {
//   const tokenBalancesBefore: iTokenBalances[] = [];
//   for (const [index, tokenInstance] of tokenInstances.entries()) {
//     const {receivers} = distributionParams[index];
//     const tokenBalancesReceiversBefore: string[][] = [[], []];
//     for (const receiver of receivers) {
//       if (receiver.toUpperCase() !== NIL_ADDRESS.toUpperCase()) {
//         tokenBalancesReceiversBefore[index].push(
//           (await tokenInstance.balanceOf(receiver)).toString()
//         );
//       } else {
//         tokenBalancesReceiversBefore[index].push(
//           (await tokenToBurnInstance.balanceOf(
//             await tokenDistributorInstance.recipientBurn()
//           )).toString()
//         );
//       }
//     }
//     tokenBalancesBefore.push({
//       tokenDistributor: (await tokenInstance.balanceOf(
//         tokenDistributorInstance.address
//       )).toString(),
//       receivers: tokenBalancesReceiversBefore[index],
//     });
//   }

//   const tokenDistribution = await tokenDistributorInstance.getDistribution();

//   await tokenDistributorInstance.distribute(
//     tokenInstances.map(tokenInstance => tokenInstance.address)
//   );

//   const tokenBalanceOfDistributorAfter: string[] = [];
//   for (const [indexToken, tokenInstance] of tokenInstances.entries()) {
//     const newLength = tokenBalanceOfDistributorAfter.push(
//       (await tokenInstance.balanceOf(tokenDistributorInstance.address)).toString()
//     );
//     const receivers = distributionParams[indexToken].receivers;
//     expect(parseInt(tokenBalanceOfDistributorAfter[newLength - 1])).to.be.within(
//       0,
//       receivers.length - 1
//     );

//     for (const [indexReceiver, receiver] of receivers.entries()) {
//       const receiverPercentage = new BigNumber(tokenDistribution[1][indexReceiver]).toFixed();
//       const tokenAmountToReceiver = new BigNumber(tokenBalancesBefore[indexToken].tokenDistributor)
//         .multipliedBy(receiverPercentage)
//         .dividedBy(TOKEN_DISTRIBUTOR_PERCENTAGE_BASE)
//         .toFixed(0, BigNumber.ROUND_DOWN);
//       const tokenBalanceOfReceiverAfter = (await tokenInstance.balanceOf(receiver)).toString();
//       const recipientBurnBalanceAfter = (await tokenToBurnInstance.balanceOf(
//         await tokenDistributorInstance.recipientBurn()
//       )).toString();
//       if (receiver.toUpperCase() !== NIL_ADDRESS.toUpperCase()) {
//         expect(tokenBalanceOfReceiverAfter).to.be.equal(
//           new BigNumber(tokenBalancesBefore[indexToken].receivers[indexReceiver])
//             .plus(tokenAmountToReceiver)
//             .toFixed()
//         );
//       } else {
//         // 1 ether received from "burning" DAI and 264 AAVE wei received from the 34% of the 777 AAVE amount sent to the token distributor
//         expect(recipientBurnBalanceAfter).to.be.equal('1000000000000000264');
//       }
//     }
//   }
// };

// const testAndExecDistributeEth = async (
//   tokenDistributorInstance: TokenDistributorInstance,
//   tokenToBurnInstance: MintableERC20Instance,
//   distributionParams: iBasicDistributionParams,
//   web3: Web3
// ) => {
//   const {receivers} = distributionParams;

//   const ethBalancesReceiversBefore = [];
//   for (const receiver of receivers) {
//     if (receiver.toUpperCase() !== NIL_ADDRESS.toUpperCase()) {
//       ethBalancesReceiversBefore.push(await web3.eth.getBalance(receiver));
//     } else {
//       ethBalancesReceiversBefore.push(await web3.eth.getBalance(ONE_ADDRESS));
//     }
//   }
//   const ethBalancesBefore: iTokenBalances = {
//     tokenDistributor: await web3.eth.getBalance(tokenDistributorInstance.address),
//     receivers: ethBalancesReceiversBefore,
//   };

//   const ethDistribution = await tokenDistributorInstance.getDistribution();

//   await tokenDistributorInstance.distribute([ETHEREUM_ADDRESS]);

//   const ethBalanceOfDistributorAfter = await web3.eth.getBalance(tokenDistributorInstance.address);

//   expect(parseInt(ethBalanceOfDistributorAfter)).to.be.within(0, receivers.length - 1);

//   for (const [index, receiver] of receivers.entries()) {
//     const receiverPercentage = new BigNumber(ethDistribution[1][index]).toFixed();
//     const ethAmountToReceiver = new BigNumber(ethBalancesBefore.tokenDistributor)
//       .multipliedBy(receiverPercentage)
//       .dividedBy(TOKEN_DISTRIBUTOR_PERCENTAGE_BASE)
//       .toFixed(0, BigNumber.ROUND_DOWN);
//     const ethBalanceOfReceiverAfter = await web3.eth.getBalance(receiver);
//     const recipientBurnBalanceAfter = (await tokenToBurnInstance.balanceOf(
//       await tokenDistributorInstance.recipientBurn()
//     )).toString();
//     if (receiver.toUpperCase() !== NIL_ADDRESS.toUpperCase()) {
//       expect(ethBalanceOfReceiverAfter).to.be.equal(
//         new BigNumber(ethBalancesBefore.receivers[index]).plus(ethAmountToReceiver).toFixed()
//       );
//     } else {
//       // 1 ether received from "burning" DAI, 1 ether from ETH and 264 AAVE wei received from the 34% of the 777 AAVE amount sent to the token distributor
//       expect(recipientBurnBalanceAfter).to.be.equal('2000000000000000264');
//     }
//   }
// };

// contract('TokenDistributor', async ([deployer, ...users]) => {
//   // let _testEnvProvider: ITestEnv;
//   // let _tokenDistributorInstance: TokenDistributorInstance;
//   // let _tokenInstances: iAavePoolAssets<MintableERC20Instance>;
//   // let _web3: Web3;
//   // let _depositorAddress: string;
//   // let _daiDistributionParams: iDistributionParams;
//   // let _lendDistributionParams: iDistributionParams;
//   // let _ethDistributionParams: iDistributionParams;

//   // before('Initializing LendingPoolConfigurator test variables', async () => {
//   //   _testEnvProvider = await testEnvProvider(
//   //     artifacts,
//   //     [deployer, ...users],
//   //     ContractsInstancesOrigin.TruffleArtifacts
//   //   );

//   //   const {
//   //     deployedInstances: {tokenDistributorInstance},
//   //     getAllAssetsInstances,
//   //     getWeb3,
//   //     getFirstDepositorAddressOnTests,
//   //     getFeeDistributionParams,
//   //   } = _testEnvProvider;
//   //   _tokenDistributorInstance = tokenDistributorInstance;
//   //   _tokenInstances = await getAllAssetsInstances();
//   //   _web3 = await getWeb3();
//   //   _depositorAddress = await getFirstDepositorAddressOnTests();

//   //   const {receivers, percentages} = await getFeeDistributionParams();
//   //   _daiDistributionParams = {
//   //     amountToDistribute: '333',
//   //     receivers,
//   //     percentages,
//   //   };
//   //   _lendDistributionParams = {
//   //     amountToDistribute: '777',
//   //     receivers,
//   //     percentages,
//   //   };
//   //   _ethDistributionParams = {
//   //     amountToDistribute: '2534',
//   //     receivers,
//   //     percentages,
//   //   };
//   // });

//   // it('Transfers ETH to the TokenDistributor', async () => {
//   //   await testAndExecEthTransfer(
//   //     _ethDistributionParams.amountToDistribute,
//   //     deployer,
//   //     _tokenDistributorInstance.address,
//   //     _web3
//   //   );
//   // });

//   // it('Mints and transfers DAI to the TokenDistributor', async () => {
//   //   await testAndExecMintAndTransferTokens(
//   //     _tokenInstances.DAI,
//   //     _daiDistributionParams.amountToDistribute,
//   //     _depositorAddress,
//   //     _tokenDistributorInstance.address
//   //   );
//   // });

//   // it('Mints and transfers AAVE to the TokenDistributor', async () => {
//   //   await testAndExecMintAndTransferTokens(
//   //     _tokenInstances.AAVE,
//   //     _lendDistributionParams.amountToDistribute,
//   //     _depositorAddress,
//   //     _tokenDistributorInstance.address
//   //   );
//   // });

//   // it('distribute() for the receivers', async () => {
//   //   await testAndExecDistributeToken(
//   //     [_tokenInstances.DAI, _tokenInstances.AAVE],
//   //     _tokenInstances.AAVE,
//   //     _tokenDistributorInstance,
//   //     [_daiDistributionParams, _lendDistributionParams]
//   //   );
//   // });

//   // it('Distributes the ETH to the receivers', async () => {
//   //   await testAndExecDistributeEth(
//   //     _tokenDistributorInstance,
//   //     _tokenInstances.AAVE,
//   //     _ethDistributionParams,
//   //     _web3
//   //   );
//   // });
// });

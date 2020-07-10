// import {ContractId, ITestEnvWithoutInstances} from '../utils/types';
// import {
//   LendingPoolCoreInstance,
//   LendingPoolConfiguratorInstance,
//   LendingPoolAddressesProviderInstance,
//   LendingPoolDataProviderInstance,
//   LendingPoolInstance,
//   MockLendingPoolCoreInstance,
// } from '../utils/typechain-types/truffle-contracts';
// import {testEnvProviderWithoutInstances} from '../utils/truffle/dlp-tests-env';
// import {ETHEREUM_ADDRESS} from '../utils/constants';
// import {getTruffleContractInstance} from '../utils/truffle/truffle-core-utils';
// import BN = require('bn.js');

// const {expectEvent, expectRevert} = require('@openzeppelin/test-helpers');

// contract('Upgradeability', async ([deployer, ...users]) => {
//   let _testEnvProvider: ITestEnvWithoutInstances;
//   let _configuratorInstance: LendingPoolConfiguratorInstance;
//   let _coreInstance: LendingPoolCoreInstance;
//   let _poolInstance: LendingPoolInstance;
//   let _addressesProviderInstance: LendingPoolAddressesProviderInstance;
//   let _dataProviderInstance: LendingPoolDataProviderInstance;
//   let _mockCoreInstance: MockLendingPoolCoreInstance;

//   before('Initializing test variables', async () => {
//     _testEnvProvider = await testEnvProviderWithoutInstances(artifacts, [deployer, ...users]);

//     const {
//       getLendingPoolAddressesProviderInstance,
//       getLendingPoolConfiguratorInstance,
//       getLendingPoolCoreInstance,
//       getLendingPoolDataProviderInstance,
//       getLendingPoolInstance,
//     } = _testEnvProvider;

//     const instances = await Promise.all([
//       getLendingPoolAddressesProviderInstance(),
//       getLendingPoolConfiguratorInstance(),
//       getLendingPoolCoreInstance(),
//       getLendingPoolDataProviderInstance(),
//       getLendingPoolInstance(),
//     ]);

//     _addressesProviderInstance = instances[0];
//     _configuratorInstance = instances[1];
//     _coreInstance = instances[2];
//     _dataProviderInstance = instances[3];
//     _poolInstance = instances[4];
//   });

//   it('tries to call the initialization function on LendingPoolConfigurator', async () => {
//     await expectRevert(
//       _configuratorInstance.initialize(_addressesProviderInstance.address),
//       'Contract instance has already been initialized'
//     );
//   });

//   it('tries to call the initialization function on LendingPoolCore', async () => {
//     await expectRevert(
//       _coreInstance.initialize(_addressesProviderInstance.address),
//       'Contract instance has already been initialized'
//     );
//   });

//   it('tries to call the initialization function on LendingPool', async () => {
//     await expectRevert(
//       _poolInstance.initialize(_addressesProviderInstance.address),
//       'Contract instance has already been initialized'
//     );
//   });

//   it('tries to call the initialization function on DataProvider', async () => {
//     await expectRevert(
//       _dataProviderInstance.initialize(_addressesProviderInstance.address),
//       'Contract instance has already been initialized'
//     );
//   });

//   it('Deploys a new version of a LendingPoolCore contract', async () => {
//     const contract: any = await artifacts.require('MockLendingPoolCore');

//     const mathLibrary = await artifacts.require('WadRayMath');

//     const mathLibraryInstance = await mathLibrary.new();

//     const coreLibrary = await artifacts.require('CoreLibrary');

//     await coreLibrary.link('WadRayMath', mathLibraryInstance.address);

//     await contract.link('CoreLibrary', coreLibrary.address);

//     await contract.link('WadRayMath', mathLibraryInstance.address);

//     _mockCoreInstance = await contract.new();

//     const txResult = await _addressesProviderInstance.setLendingPoolCoreImpl(
//       _mockCoreInstance.address
//     );

//     expectEvent(txResult, 'LendingPoolCoreUpdated', {
//       newAddress: _mockCoreInstance.address,
//     });
//   });

//   it('Tries to execute initialize() on the newly deployed core', async () => {
//     const coreProxyAddress = await _addressesProviderInstance.getLendingPoolCore();

//     const instance: LendingPoolCoreInstance = await getTruffleContractInstance(
//       artifacts,
//       ContractId.LendingPoolCore,
//       coreProxyAddress
//     );

//     await expectRevert(
//       instance.initialize(_addressesProviderInstance.address),
//       'Contract instance has already been initialized'
//     );
//   });

//   it('Tries to deposit', async () => {
//     const coreProxyAddress = await _addressesProviderInstance.getLendingPoolCore();
//     const txReceipt: Truffle.TransactionResponse = await _poolInstance.deposit(
//       ETHEREUM_ADDRESS,
//       '100',
//       '0',
//       {value: '100'}
//     );

//     expectEvent.inTransaction(txReceipt.tx, coreProxyAddress, 'ReserveUpdatedFromMock', {
//       revision: new BN(2),
//     });
//   });
// });

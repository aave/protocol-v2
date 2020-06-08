// import {ITestEnvWithoutInstances} from '../utils/types';

// import {testEnvProviderWithoutInstances} from '../utils/truffle/dlp-tests-env';
// import {configuration as actionsConfiguration, deposit} from './actions';
// import {configuration as calculationsConfiguration} from './utils/calculations';
// import {executeStory} from './engine/scenario-engine';
// import fs from 'fs';
// import BigNumber from 'bignumber.js';
// import {ETHEREUM_ADDRESS} from '../utils/constants';

// BigNumber.config({DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN});

// const scenarioFolder = './test/scenarios/';

// fs.readdirSync(scenarioFolder).forEach(file => {
//   //  if (file !== "interest-redirection-negatives.json"  &&
//   //      file !== "interest-redirection.json" ) return

//   const scenario = require(`./scenarios/${file}`);

//   contract(scenario.title, async ([deployer, ...users]) => {
//     let _testEnvProvider: ITestEnvWithoutInstances;

//     before('Initializing configuration', async () => {
//       console.time('setup-test');
//       _testEnvProvider = await testEnvProviderWithoutInstances(artifacts, [deployer, ...users]);

//       const {
//         getWeb3,
//         getAavePoolReservesParams,
//         getLendingPoolInstance,
//         getLendingPoolCoreInstance,
//       } = _testEnvProvider;

//       const instances = await Promise.all([getLendingPoolInstance(), getLendingPoolCoreInstance()]);

//       actionsConfiguration.lendingPoolInstance = instances[0];
//       actionsConfiguration.lendingPoolCoreInstance = instances[1];
//       actionsConfiguration.ethereumAddress = ETHEREUM_ADDRESS;
//       actionsConfiguration.artifacts = artifacts;
//       actionsConfiguration.web3 = await getWeb3();
//       actionsConfiguration.skipIntegrityCheck = false; //set this to true to execute solidity-coverage

//       calculationsConfiguration.reservesParams = await getAavePoolReservesParams();
//       calculationsConfiguration.web3 = actionsConfiguration.web3;
//       calculationsConfiguration.ethereumAddress = actionsConfiguration.ethereumAddress;
//       console.time('setup-test');
//     });

//     for (const story of scenario.stories) {
//       it(story.description, async () => {
//         await executeStory(story, users);
//       });
//     }
//   });
// });

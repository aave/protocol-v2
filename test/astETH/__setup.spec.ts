import chai from 'chai';
import hre from 'hardhat';

import { almostEqual } from '../helpers/almost-equal';
import bignumberChai from 'chai-bignumber';
import { solidity } from 'ethereum-waffle';
import { AstEthSetup } from './init';
import '../helpers/utils/math';

chai.use(bignumberChai());
chai.use(almostEqual());
chai.use(solidity);

let setup: AstEthSetup, evmSnapshotId;

before(async () => {
  setup = await AstEthSetup.deploy();
  evmSnapshotId = await hre.ethers.provider.send('evm_snapshot', []);
});

afterEach(async () => {
  await hre.ethers.provider.send('evm_revert', [evmSnapshotId]);
  evmSnapshotId = await hre.ethers.provider.send('evm_snapshot', []);
});

export { setup };

import axios from 'axios';
import { Contract } from 'ethers/lib/ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DRE } from './misc-utils';
import { ePolygonNetwork, EthereumNetworkNames } from './types';

const TASK_FLATTEN_GET_FLATTENED_SOURCE = 'flatten:get-flattened-sources';
const TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS = 'compile:solidity:get-source-paths';

/* Polygon Helpers */

export const usingPolygon = () =>
  DRE && Object.keys(ePolygonNetwork).includes((DRE as HardhatRuntimeEnvironment).network.name);

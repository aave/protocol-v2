import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DRE } from './misc-utils';
import { ePolygonNetwork } from './types';

/* Polygon Helpers */

export const usingPolygon = () =>
  DRE && Object.keys(ePolygonNetwork).includes((DRE as HardhatRuntimeEnvironment).network.name);

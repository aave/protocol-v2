import {IConfig} from 'config';
import {IAaveConfiguration, IUniswapConfiguration} from './types';

let config: IAaveConfiguration | IUniswapConfiguration;

// This function swaps NODE_ENV during the 'config' library load, to load custom config files, then keeps NODE_ENV like before.
export const loadConfig = (): IAaveConfiguration | IUniswapConfiguration => {
  if (config) {
    return config;
  }
  const currentNodeEnv = process.env.NODE_ENV;

  process.env.NODE_ENV = process.env.POOL;
  const configuration = require('config');
  process.env.NODE_ENV = currentNodeEnv;

  config = configuration;

  return config;
};

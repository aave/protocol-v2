pragma solidity 0.6.12;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';

contract AaveOracle is Ownable {
  event AssetSourceUpdated(address indexed asset, address indexed source);
  event OracleSystemMigrated();

  constructor() public {
    emit OracleSystemMigrated();
  }

  function setAssetSources(address[] calldata assets, address[] calldata sources)
    external
    onlyOwner
  {
    require(assets.length == sources.length, 'INCONSISTENT_PARAMS_LENGTH');
    for (uint256 i = 0; i < assets.length; i++) {
      emit AssetSourceUpdated(assets[i], sources[i]);
    }
  }
}

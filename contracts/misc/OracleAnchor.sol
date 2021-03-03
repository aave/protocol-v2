pragma solidity 0.6.12;

contract AaveOracle  {
  event AssetSourceUpdated(address indexed asset, address indexed source);
  event OracleSystemMigrated();

  constructor(address[] calldata assets, address[] calldata sources) public {
    require(assets.length == sources.length, 'INCONSISTENT_PARAMS_LENGTH');
    emit OracleSystemMigrated();
    for (uint256 i = 0; i < assets.length; i++) {
      emit AssetSourceUpdated(assets[i], sources[i]);
    }
  }
}

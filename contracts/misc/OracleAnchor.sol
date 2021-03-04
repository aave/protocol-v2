// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

contract OracleAnchor {
  event AssetSourceUpdated(address indexed token, address indexed aggregator);
  event ChainlinkAggregatorUpdated(address indexed asset, address indexed source);
  event OracleSystemMigrated();

  constructor(
    address[] memory aaveOracleAssets, // token assets that are complex
    address[] memory aaveOracleSources, // custom oracles for complex tokens
    address[] memory aggregatorAssets, // assets directly related to chainlink
    address[] memory aggregatorSources // chainlink aggregator contract
  ) public {
    require(
      aaveOracleAssets.length == aaveOracleSources.length,
      'INCONSISTENT_AAVEORACLE_PARAMS_LENGTH'
    );
    require(
      aggregatorAssets.length == aggregatorSources.length,
      'INCONSISTENT_CHAINLINKAGGREGATOR_PARAMS_LENGTH'
    );
    emit OracleSystemMigrated();

    for (uint256 i = 0; i < aaveOracleAssets.length; i++) {
      emit AssetSourceUpdated(aaveOracleAssets[i], aaveOracleSources[i]);
    }

    for (uint256 i = 0; i < aggregatorAssets.length; i++) {
      emit ChainlinkAggregatorUpdated(aggregatorAssets[i], aggregatorSources[i]);
    }
  }
}

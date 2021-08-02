/**
 *Submitted for verification at Etherscan.io on 2020-12-03
 */

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title VersionedInitializable
 *
 * @dev Helper contract to support initializer functions. To use it, replace
 * the constructor with a function that has the `initializer` modifier.
 * WARNING: Unlike constructors, initializer functions must be manually
 * invoked. This applies both to deploying an Initializable contract, as well
 * as extending an Initializable contract via inheritance.
 * WARNING: When used with inheritance, manual care must be taken to not invoke
 * a parent initializer twice, or ensure that all initializers are idempotent,
 * because this is not dealt with automatically as with constructors.
 *
 * @author Aave, inspired by the OpenZeppelin Initializable contract
 */
abstract contract VersionedInitializable {
  /**
   * @dev Indicates that the contract has been initialized.
   */
  uint256 internal lastInitializedRevision = 0;

  /**
   * @dev Modifier to use in the initializer function of a contract.
   */
  modifier initializer() {
    uint256 revision = getRevision();
    require(revision > lastInitializedRevision, 'Contract instance has already been initialized');

    lastInitializedRevision = revision;

    _;
  }

  /// @dev returns the revision number of the contract.
  /// Needs to be defined in the inherited class as a constant.
  function getRevision() internal pure virtual returns (uint256);

  // Reserved storage space to allow for layout changes in the future.
  uint256[50] private ______gap;
}

contract ChainlinkSourcesRegistry is VersionedInitializable {
  /// @dev Mapping of current stored asset => underlying Chainlink aggregator
  mapping(address => address) public aggregatorsOfAssets;

  event AggregatorUpdated(address token, address aggregator);

  uint256 public constant REVISION = 1;

  address public manager;

  /**
   * @dev returns the revision of the implementation contract
   */
  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }

  function initialize() external initializer {
    manager = msg.sender;
  }

  function updateAggregators(address[] memory assets, address[] memory aggregators) external {
    require(isManager(msg.sender), 'INVALID_MANAGER');

    for (uint256 i = 0; i < assets.length; i++) {
      aggregatorsOfAssets[assets[i]] = aggregators[i];
      emit AggregatorUpdated(assets[i], aggregators[i]);
    }
  }

  function isManager(address caller) public view returns (bool) {
    return caller == manager;
  }

  function setManager(address newManager) public {
    require(isManager(msg.sender), 'INVALID_MANAGER');
    manager = newManager;
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {DistributionTypes} from '../lib/DistributionTypes.sol';
import {VersionedInitializable} from '../protocol/libraries/sturdy-upgradeability/VersionedInitializable.sol';
import {DistributionManager} from './DistributionManager.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {IScaledBalanceToken} from '../interfaces/IScaledBalanceToken.sol';
import {ISturdyIncentivesController} from '../interfaces/ISturdyIncentivesController.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';

/**
 * @title StakedTokenIncentivesController
 * @notice Distributor contract for rewards to the Sturdy protocol, using a staked token as rewards asset.
 * The contract stakes the rewards before redistributing them to the Sturdy protocol participants.
 * @author Sturdy
 **/
contract StakedTokenIncentivesController is
  ISturdyIncentivesController,
  VersionedInitializable,
  DistributionManager
{
  using SafeERC20 for IERC20;

  uint256 private constant REVISION = 1;

  mapping(address => uint256) internal _usersUnclaimedRewards;
  ILendingPoolAddressesProvider internal _addressProvider;

  // this mapping allows whitelisted addresses to claim on behalf of others
  // useful for contracts that hold tokens to be rewarded but don't have any native logic to claim Liquidity Mining rewards
  mapping(address => address) internal _authorizedClaimers;

  modifier onlyAuthorizedClaimers(address claimer, address user) {
    require(_authorizedClaimers[user] == claimer, 'CLAIMER_UNAUTHORIZED');
    _;
  }

  constructor(address emissionManager) DistributionManager(emissionManager) {}

  /**
   * @dev Initialize IStakedTokenIncentivesController
   * @param _provider the address of the corresponding addresses provider
   **/
  function initialize(ILendingPoolAddressesProvider _provider) external initializer {
    _addressProvider = _provider;
  }

  /// @inheritdoc ISturdyIncentivesController
  function configureAssets(address[] calldata assets, uint256[] calldata emissionsPerSecond)
    external
    payable
    override
    onlyEmissionManager
  {
    uint256 length = assets.length;
    require(length == emissionsPerSecond.length, 'INVALID_CONFIGURATION');

    DistributionTypes.AssetConfigInput[]
      memory assetsConfig = new DistributionTypes.AssetConfigInput[](assets.length);

    for (uint256 i; i < length; ++i) {
      assetsConfig[i].underlyingAsset = assets[i];
      assetsConfig[i].emissionPerSecond = uint104(emissionsPerSecond[i]);

      require(assetsConfig[i].emissionPerSecond == emissionsPerSecond[i], 'INVALID_CONFIGURATION');

      assetsConfig[i].totalStaked = IScaledBalanceToken(assets[i]).scaledTotalSupply();
    }
    _configureAssets(assetsConfig);
  }

  /// @inheritdoc ISturdyIncentivesController
  function handleAction(
    address user,
    uint256 totalSupply,
    uint256 userBalance
  ) external override {
    uint256 accruedRewards = _updateUserAssetInternal(user, msg.sender, userBalance, totalSupply);
    if (accruedRewards > 0) {
      _usersUnclaimedRewards[user] += accruedRewards;
      emit RewardsAccrued(user, accruedRewards);
    }
  }

  /// @inheritdoc ISturdyIncentivesController
  function getRewardsBalance(address[] calldata assets, address user)
    external
    view
    override
    returns (uint256)
  {
    uint256 unclaimedRewards = _usersUnclaimedRewards[user];
    uint256 length = assets.length;
    DistributionTypes.UserStakeInput[] memory userState = new DistributionTypes.UserStakeInput[](
      length
    );
    for (uint256 i; i < length; ++i) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IScaledBalanceToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }
    unclaimedRewards += _getUnclaimedRewards(user, userState);
    return unclaimedRewards;
  }

  /// @inheritdoc ISturdyIncentivesController
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external override returns (uint256) {
    require(to != address(0), 'INVALID_TO_ADDRESS');
    return _claimRewards(assets, amount, msg.sender, msg.sender, to);
  }

  /// @inheritdoc ISturdyIncentivesController
  function claimRewardsOnBehalf(
    address[] calldata assets,
    uint256 amount,
    address user,
    address to
  ) external override onlyAuthorizedClaimers(msg.sender, user) returns (uint256) {
    require(user != address(0), 'INVALID_USER_ADDRESS');
    require(to != address(0), 'INVALID_TO_ADDRESS');
    return _claimRewards(assets, amount, msg.sender, user, to);
  }

  /**
   * @dev Claims reward for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards.
   * @param amount Amount of rewards to claim
   * @param user Address to check and claim rewards
   * @param to Address that will be receiving the rewards
   * @return Rewards claimed
   **/

  /// @inheritdoc ISturdyIncentivesController
  function setClaimer(address user, address caller) external payable override onlyEmissionManager {
    _authorizedClaimers[user] = caller;
    emit ClaimerSet(user, caller);
  }

  /// @inheritdoc ISturdyIncentivesController
  function getClaimer(address user) external view override returns (address) {
    return _authorizedClaimers[user];
  }

  /// @inheritdoc ISturdyIncentivesController
  function getUserUnclaimedRewards(address _user) external view override returns (uint256) {
    return _usersUnclaimedRewards[_user];
  }

  /// @inheritdoc ISturdyIncentivesController
  function REWARD_TOKEN() external view override returns (address) {
    return _addressProvider.getIncentiveToken();
  }

  /// @inheritdoc ISturdyIncentivesController
  function DISTRIBUTION_END()
    external
    view
    override(DistributionManager, ISturdyIncentivesController)
    returns (uint256)
  {
    return _distributionEnd;
  }

  /// @inheritdoc ISturdyIncentivesController
  function getAssetData(address asset)
    public
    view
    override(DistributionManager, ISturdyIncentivesController)
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    return (
      assets[asset].index,
      assets[asset].emissionPerSecond,
      assets[asset].lastUpdateTimestamp
    );
  }

  /// @inheritdoc ISturdyIncentivesController
  function getUserAssetData(address user, address asset)
    public
    view
    override(DistributionManager, ISturdyIncentivesController)
    returns (uint256)
  {
    return assets[asset].users[user];
  }

  /**
   * @dev returns the revision of the implementation contract
   */
  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }

  function PRECISION() external pure override returns (uint8) {
    return _PRECISION;
  }

  /**
   * @dev Claims reward for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards.
   * @param amount Amount of rewards to claim
   * @param user Address to check and claim rewards
   * @param to Address that will be receiving the rewards
   * @return Rewards claimed
   **/
  function _claimRewards(
    address[] calldata assets,
    uint256 amount,
    address claimer,
    address user,
    address to
  ) internal returns (uint256) {
    if (amount == 0) {
      return 0;
    }
    uint256 unclaimedRewards = _usersUnclaimedRewards[user];
    uint256 length = assets.length;
    DistributionTypes.UserStakeInput[] memory userState = new DistributionTypes.UserStakeInput[](
      length
    );
    for (uint256 i; i < length; ++i) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IScaledBalanceToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }

    uint256 accruedRewards = _claimRewards(user, userState);
    if (accruedRewards > 0) {
      unclaimedRewards += accruedRewards;
      emit RewardsAccrued(user, accruedRewards);
    }

    if (unclaimedRewards == 0) {
      return 0;
    }

    uint256 amountToClaim = amount > unclaimedRewards ? unclaimedRewards : amount;
    _usersUnclaimedRewards[user] = unclaimedRewards - amountToClaim; // Safe due to the previous line

    // STAKE_TOKEN.stake(to, amountToClaim);
    IERC20 stakeToken = IERC20(_addressProvider.getIncentiveToken());
    if (stakeToken.balanceOf(address(this)) >= amountToClaim) {
      stakeToken.safeTransfer(to, amountToClaim);
    }

    emit RewardsClaimed(user, to, claimer, amountToClaim);

    return amountToClaim;
  }
}

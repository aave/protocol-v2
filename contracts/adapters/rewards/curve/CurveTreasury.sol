// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {ICurveGauge, ICurveGaugeView} from '../../interfaces/curve/ICurveGauge.sol';
import {ICurveMinter} from '../../interfaces/curve/ICurveMinter.sol';
import {ICurveGaugeController} from '../../interfaces/curve/ICurveGaugeController.sol';
import {IVotingEscrow} from '../../interfaces/curve/IVotingEscrow.sol';
import {
  VersionedInitializable
} from '../../../protocol/libraries/aave-upgradeability/VersionedInitializable.sol';
import {ICurveFeeDistributor} from '../../interfaces/curve/ICurveFeeDistributor.sol';
import {ICurveTreasury} from '../../interfaces/curve/ICurveTreasury.sol';
import 'hardhat/console.sol';

/**
 * @title Curve Treasury that holds Curve LP and Gauge tokens
 * @notice The treasury holds Curve assets like LP or Gauge tokens and can lock veCRV for boosting Curve yields
 * @author Aave
 */
contract CurveTreasury is ICurveTreasury, VersionedInitializable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public constant MAX_REWARD_TOKENS = 10;

  address immutable VOTING_ESCROW;
  address immutable CRV_TOKEN;
  address immutable FEE_DISTRIBUTOR;
  address immutable GAUGE_CONTROLLER;
  address immutable AAVE_COLLECTOR;

  address private _owner;

  uint256 public constant TREASURY_REVISION = 0x1;

  mapping(address => mapping(address => bool)) internal _entityTokenWhitelist;
  mapping(address => mapping(address => address)) internal _entityTokenGauge;
  mapping(address => bool) internal _isGaugeV2Compatible;

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  constructor(
    address _votingEscrow,
    address _crvToken,
    address _curveFeeDistributor,
    address _gaugeController,
    address _aaveCollector
  ) public {
    VOTING_ESCROW = _votingEscrow;
    CRV_TOKEN = _crvToken;
    FEE_DISTRIBUTOR = _curveFeeDistributor;
    GAUGE_CONTROLLER = _gaugeController;
    AAVE_COLLECTOR = _aaveCollector;
  }

  /**
   * @dev Revert if caller is not the owner of this contract
   */
  modifier onlyOwner() {
    require(_owner == msg.sender, 'Ownable: caller is not the owner');
    _;
  }

  /**
   * @dev Revert if caller and selected token is not a whitelisted entity
   */
  modifier onlyWhitelistedEntity(address token) {
    require(_entityTokenWhitelist[msg.sender][token] == true, 'ENTITY_NOT_WHITELISTED');
    _;
  }

  /**
   * @dev Revert if caller gauge token is not whitelisted
   */
  modifier onlyWhitelistedGauge(address token) {
    require(_entityTokenGauge[msg.sender][token] != address(0), 'ENTITY_GAUGE_NOT_WHITELISTED');
    _;
  }

  /**
   * @dev Initializes the contract with an owner that allows to whitelist new entities inside the treasury contract
   * @param owner Sets the owner of the contract
   */
  function initialize(address owner) external virtual initializer {
    _owner = owner;
  }

  /// @inheritdoc ICurveTreasury
  function deposit(
    address token,
    uint256 amount,
    bool useGauge
  ) external override onlyWhitelistedEntity(token) {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    if (useGauge && _entityTokenGauge[msg.sender][token] != address(0)) {
      address gauge = _entityTokenGauge[msg.sender][token];
      if (_isGaugeV2Compatible[gauge] == true) {
        // Claim the extra rewards from Gauge Staking
        uint256[] memory priorRewardsBalance = new uint256[](MAX_REWARD_TOKENS);
        uint256[] memory afterRewardsBalance = new uint256[](MAX_REWARD_TOKENS);

        // Calculate balances prior claiming rewards
        for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
          address rewardToken = ICurveGaugeView(gauge).reward_tokens(index - 1);
          if (rewardToken == address(0)) break;
          priorRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
        }

        // Claim extra rewards
        _stakeGauge(_entityTokenGauge[msg.sender][token], amount);

        // Transfer extra rewards to entity
        for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
          address rewardToken = ICurveGaugeView(gauge).reward_tokens(index - 1);
          if (rewardToken == address(0)) break;
          afterRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
          uint256 rewardsAmount = afterRewardsBalance[index].sub(priorRewardsBalance[index]);
          if (rewardsAmount > 0) {
            IERC20(rewardToken).safeTransfer(msg.sender, rewardsAmount);
          }
        }
      } else {
        _stakeGauge(_entityTokenGauge[msg.sender][token], amount);
      }
    }
  }

  /// @inheritdoc ICurveTreasury
  function withdraw(
    address token,
    uint256 amount,
    bool useGauge
  ) external override onlyWhitelistedEntity(token) {
    if (useGauge && _entityTokenGauge[msg.sender][token] != address(0)) {
      address gauge = _entityTokenGauge[msg.sender][token];
      if (_isGaugeV2Compatible[gauge] == true) {
        // Claim the extra rewards from Gauge Staking
        uint256[] memory priorRewardsBalance = new uint256[](MAX_REWARD_TOKENS);
        uint256[] memory afterRewardsBalance = new uint256[](MAX_REWARD_TOKENS);

        // Calculate balances prior claiming rewards
        for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
          address rewardToken = ICurveGaugeView(gauge).reward_tokens(index - 1);
          if (rewardToken == address(0)) break;
          priorRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
        }

        // Claim extra rewards
        _unstakeGauge(_entityTokenGauge[msg.sender][token], amount);

        // Transfer extra rewards to entity
        for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
          address rewardToken = ICurveGaugeView(gauge).reward_tokens(index - 1);
          if (rewardToken == address(0)) break;
          afterRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
          uint256 rewardsAmount = afterRewardsBalance[index].sub(priorRewardsBalance[index]);
          if (rewardsAmount > 0) {
            IERC20(rewardToken).safeTransfer(msg.sender, rewardsAmount);
          }
        }
      } else {
        _unstakeGauge(_entityTokenGauge[msg.sender][token], amount);
      }
    }
    IERC20(token).safeTransfer(msg.sender, amount);
  }

  /// @inheritdoc ICurveTreasury
  function setWhitelist(
    address[] calldata entities,
    address[] calldata tokens,
    address[] calldata gauges,
    bool[] memory areGaugesV2,
    bool[] memory whitelisted
  ) external override onlyOwner {
    for (uint256 e; e < entities.length; e++) {
      _entityTokenWhitelist[entities[e]][tokens[e]] = whitelisted[e];
      if (whitelisted[e] == true) {
        if (gauges[e] != address(0)) {
          _entityTokenGauge[entities[e]][tokens[e]] = gauges[e];
          _isGaugeV2Compatible[gauges[e]] = areGaugesV2[e];
        }
        _approveEntityTokens(entities[e], tokens[e], gauges[e], areGaugesV2[e], type(uint256).max);
      } else {
        _entityTokenGauge[entities[e]][tokens[e]] = address(0);
        _approveEntityTokens(entities[e], tokens[e], gauges[e], areGaugesV2[e], 0);
        _isGaugeV2Compatible[gauges[e]] = false;
      }
    }
  }

  /// @inheritdoc ICurveTreasury
  function claimGaugeRewards(address gaugeUnderlyingToken)
    external
    override
    onlyWhitelistedEntity(gaugeUnderlyingToken)
  {
    address gauge = _entityTokenGauge[msg.sender][gaugeUnderlyingToken];

    // Claim CRV from Curve Minter
    uint256 priorCrvBalance = IERC20(CRV_TOKEN).balanceOf(address(this));
    ICurveMinter(ICurveGaugeView(gauge).minter()).mint(gauge);
    uint256 afterCrvBalance = IERC20(CRV_TOKEN).balanceOf(address(this));

    // Transfer CRV to entity
    uint256 crvRewards = afterCrvBalance.sub(priorCrvBalance);
    if (crvRewards > 0) {
      IERC20(CRV_TOKEN).safeTransfer(msg.sender, crvRewards);
    }

    if (_isGaugeV2Compatible[gauge] == true) {
      // Claim the extra rewards from Gauge Staking
      uint256[] memory priorRewardsBalance = new uint256[](MAX_REWARD_TOKENS);
      uint256[] memory afterRewardsBalance = new uint256[](MAX_REWARD_TOKENS);

      // Calculate balances prior claiming rewards
      for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
        address rewardToken = ICurveGaugeView(gauge).reward_tokens(index - 1);
        if (rewardToken == address(0)) break;
        priorRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
      }

      // Claim extra rewards
      ICurveGauge(gauge).claim_rewards();

      // Transfer extra rewards to entity
      for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
        address rewardToken = ICurveGaugeView(gauge).reward_tokens(index - 1);
        if (rewardToken == address(0)) break;
        afterRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
        uint256 rewardsAmount = afterRewardsBalance[index].sub(priorRewardsBalance[index]);
        if (rewardsAmount > 0) {
          IERC20(rewardToken).safeTransfer(msg.sender, rewardsAmount);
        }
      }
    }
  }

  /// @inheritdoc ICurveTreasury
  function claimCurveDistributorFees() external override onlyOwner {
    address rewardsToken = ICurveFeeDistributor(FEE_DISTRIBUTOR).token();
    uint256 priorBalance = IERC20(rewardsToken).balanceOf(address(this));
    ICurveFeeDistributor(FEE_DISTRIBUTOR).claim();
    uint256 afterBalance = IERC20(rewardsToken).balanceOf(address(this));
    uint256 rewards = afterBalance.sub(priorBalance);
    if (rewards > 0) {
      IERC20(rewardsToken).safeTransfer(AAVE_COLLECTOR, rewards);
    }
  }

  /** Owner methods related with veCRV to interact with Voting Escrow Curve contract */

  /// @inheritdoc ICurveTreasury
  function lockCrv(uint256 amount, uint256 unlockTime) external override onlyOwner {
    IERC20(CRV_TOKEN).safeApprove(VOTING_ESCROW, 0);
    IERC20(CRV_TOKEN).safeApprove(VOTING_ESCROW, amount);
    IVotingEscrow(VOTING_ESCROW).create_lock(amount, unlockTime);
  }

  /// @inheritdoc ICurveTreasury
  function unlockCrv() external override onlyOwner {
    IVotingEscrow(VOTING_ESCROW).withdraw();
  }

  /// @inheritdoc ICurveTreasury
  function increaseLockedCrv(uint256 amount) external override onlyOwner {
    IERC20(CRV_TOKEN).safeApprove(VOTING_ESCROW, 0);
    IERC20(CRV_TOKEN).safeApprove(VOTING_ESCROW, amount);
    IVotingEscrow(VOTING_ESCROW).increase_amount(amount);
  }

  /// @inheritdoc ICurveTreasury
  function increaseUnlockTimeCrv(uint256 unlockTime) external override onlyOwner {
    IVotingEscrow(VOTING_ESCROW).increase_unlock_time(unlockTime);
  }

  /** Owner methods related with Gauge Controller Voting contract */

  /// @inheritdoc ICurveTreasury
  function voteForGaugeWeights(address gauge, uint256 weight) external override onlyOwner {
    ICurveGaugeController(GAUGE_CONTROLLER).vote_for_gauge_weights(gauge, weight);
  }

  /// @inheritdoc ICurveTreasury
  function transferOwnership(address newOwner) external override onlyOwner {
    require(newOwner != address(0), 'New owner cant be the zero address');
    emit OwnershipTransferred(_owner, newOwner);
    _owner = newOwner;
  }

  /// @inheritdoc ICurveTreasury
  function owner() external view override returns (address) {
    return _owner;
  }

  /**
   * @dev Get the implementation revision
   * @return uin256 - The current version of the implementation
   */
  function getRevision() internal pure virtual override returns (uint256) {
    return TREASURY_REVISION;
  }

  /**
   * @dev ERC20 approval to allow entity and gauge staking contracts to pull whitelisted tokens and rewards from the treasury
   * @param entity Entity address
   * @param token Curve LP Token contract address
   * @param gauge Curve Gauge Staking contract address
   * @param amount Amount of tokens
   */
  function _approveEntityTokens(
    address entity,
    address token,
    address gauge,
    bool isGaugeV2,
    uint256 amount
  ) internal {
    IERC20(token).safeApprove(entity, 0);
    IERC20(token).safeApprove(entity, amount);
    if (gauge != address(0)) {
      IERC20(token).safeApprove(gauge, 0);
      IERC20(token).safeApprove(gauge, amount);
      IERC20(CRV_TOKEN).safeApprove(entity, 0);
      IERC20(CRV_TOKEN).safeApprove(entity, amount);
      if (isGaugeV2 == true) {
        for (uint256 index = 0; index < MAX_REWARD_TOKENS; index++) {
          address reward = ICurveGaugeView(gauge).reward_tokens(index);
          if (reward == address(0)) break;
          IERC20(reward).safeApprove(entity, 0);
          IERC20(reward).safeApprove(entity, amount);
        }
      }
    }
  }

  /**
   * @dev Stake underliying token inside the Gauge Staking contract
   * @param gauge Address of the Gauge Staking contract
   * @param amount Amount of the underlying token to stake inside the contract
   */
  function _stakeGauge(address gauge, uint256 amount) internal {
    ICurveGauge(gauge).deposit(amount);
  }

  /**
   * @dev Unstake underliying token from the Gauge Staking contract
   * @param gauge Address of the Gauge Staking contract
   * @param amount Amount of the underlying token to withdraw from the contract
   */
  function _unstakeGauge(address gauge, uint256 amount) internal {
    ICurveGauge(gauge).withdraw(amount);
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {SafeMath} from '../../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IBalancerGauge, IBalancerGaugeView} from '../../interfaces/balancer/IBalancerGauge.sol';
import {IBalancerMinter} from '../../interfaces/balancer/IBalancerMinter.sol';
import {IBalancerGaugeController} from '../../interfaces/balancer/IBalancerGaugeController.sol';
import {IVotingEscrow} from '../../interfaces/curve/IVotingEscrow.sol';
import {
  VersionedInitializable
} from '../../../protocol/libraries/aave-upgradeability/VersionedInitializable.sol';
import {IBalancerFeeDistributor} from '../../interfaces/balancer/IBalancerFeeDistributor.sol';
import {IBalancerTreasury} from '../../interfaces/balancer/IBalancerTreasury.sol';

/**
 * @title Balancer Treasury that holds Balancer Pool Tokens and Gauge tokens
 * @notice The treasury holds Balancer assets like LP or Gauge tokens and can lock veBAL for boosting Balancer yields
 * @author Aave
 */
contract BalancerTreasury is IBalancerTreasury, VersionedInitializable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  // MAX_REWARDS can go upto 9 ie. BAL + 8 other rewards
  // https://github.com/balancer-labs/balancer-v2-monorepo/blob/b12223b86f60ae1ad26f8fba29aece17cd3f9b1e/pkg/liquidity-mining/contracts/gauges/ethereum/LiquidityGaugeV5.vy#L81
  uint256 public constant MAX_REWARD_TOKENS = 10;

  address immutable VOTING_ESCROW;
  address immutable BAL_TOKEN;
  address immutable FEE_DISTRIBUTOR;
  address immutable GAUGE_CONTROLLER;
  address immutable AAVE_COLLECTOR;
  address public MINTER;

  address private _owner;

  uint256 public constant TREASURY_REVISION = 0x1;

  mapping(address => mapping(address => bool)) internal _entityTokenWhitelist;
  mapping(address => mapping(address => address)) internal _entityTokenGauge;

  event MinterUpdated(address indexed previousMinter, address indexed newMinter);
  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  constructor(
    address _votingEscrow,
    address _balToken,
    address _balancerFeeDistributor,
    address _gaugeController,
    address _aaveCollector,
    address _minter
  ) public {
    VOTING_ESCROW = _votingEscrow;
    BAL_TOKEN = _balToken;
    FEE_DISTRIBUTOR = _balancerFeeDistributor;
    GAUGE_CONTROLLER = _gaugeController;
    AAVE_COLLECTOR = _aaveCollector;
    MINTER = _minter;
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

  /// @inheritdoc IBalancerTreasury
  function deposit(
    address token,
    uint256 amount,
    bool useGauge
  ) external override onlyWhitelistedEntity(token) {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    if (useGauge && _entityTokenGauge[msg.sender][token] != address(0)) {
      address gauge = _entityTokenGauge[msg.sender][token];
      _stakeGauge(_entityTokenGauge[msg.sender][token], amount);
    }
  }

  /// @inheritdoc IBalancerTreasury
  function withdraw(
    address token,
    uint256 amount,
    bool useGauge
  ) external override onlyWhitelistedEntity(token) {
    if (useGauge && _entityTokenGauge[msg.sender][token] != address(0)) {
      address gauge = _entityTokenGauge[msg.sender][token];
      _unstakeGauge(_entityTokenGauge[msg.sender][token], amount);
    }
    IERC20(token).safeTransfer(msg.sender, amount);
  }

  /// @inheritdoc IBalancerTreasury
  function setWhitelist(
    address[] calldata entities,
    address[] calldata tokens,
    address[] calldata gauges,
    bool[] memory whitelisted
  ) external override onlyOwner {
    for (uint256 e; e < entities.length; e++) {
      _entityTokenWhitelist[entities[e]][tokens[e]] = whitelisted[e];
      if (whitelisted[e] == true) {
        if (gauges[e] != address(0)) {
          _entityTokenGauge[entities[e]][tokens[e]] = gauges[e];
        }
        _approveEntityTokens(entities[e], tokens[e], gauges[e], type(uint256).max);
      } else {
        _entityTokenGauge[entities[e]][tokens[e]] = address(0);
        _approveEntityTokens(entities[e], tokens[e], gauges[e], 0);
      }
    }
  }

  /// @inheritdoc IBalancerTreasury
  function claimGaugeRewards(address gaugeUnderlyingToken)
    external
    override
    onlyWhitelistedEntity(gaugeUnderlyingToken)
  {
    address gauge = _entityTokenGauge[msg.sender][gaugeUnderlyingToken];

    // Claim BAL from Balancer Minter
    uint256 priorBalBalance = IERC20(BAL_TOKEN).balanceOf(address(this));
    IBalancerMinter(MINTER).mint(gauge);
    uint256 afterBalBalance = IERC20(BAL_TOKEN).balanceOf(address(this));

    // Transfer BAL to entity
    uint256 balRewards = afterBalBalance.sub(priorBalBalance);
    if (balRewards > 0) {
      IERC20(BAL_TOKEN).safeTransfer(msg.sender, balRewards);
    }

    // Claim the extra rewards from Gauge Staking
    uint256[] memory priorRewardsBalance = new uint256[](MAX_REWARD_TOKENS);
    uint256[] memory afterRewardsBalance = new uint256[](MAX_REWARD_TOKENS);

    // Calculate balances prior claiming rewards
    for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
      address rewardToken = IBalancerGaugeView(gauge).reward_tokens(index - 1);
      if (rewardToken == address(0)) break;
      priorRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
    }

    // Claim extra rewards
    IBalancerGauge(gauge).claim_rewards();

    // Transfer extra rewards to entity
    for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
      address rewardToken = IBalancerGaugeView(gauge).reward_tokens(index - 1);
      if (rewardToken == address(0)) break;
      afterRewardsBalance[index] = IERC20(rewardToken).balanceOf(address(this));
      uint256 rewardsAmount = afterRewardsBalance[index].sub(priorRewardsBalance[index]);
      if (rewardsAmount > 0) {
        IERC20(rewardToken).safeTransfer(msg.sender, rewardsAmount);
      }
    }
  }

  /// @inheritdoc IBalancerTreasury
  function claimBalancerDistributorFees(address[] calldata tokens) external override onlyOwner {
    uint256 rewardsLength = tokens.length;
    for (uint256 i; i < rewardsLength; i++) {
      IERC20 rewardsToken = IERC20(tokens[i]);
      uint256 priorBalance = rewardsToken.balanceOf(address(this));
      IBalancerFeeDistributor(FEE_DISTRIBUTOR).claimToken(address(this), rewardsToken);
      uint256 afterBalance = rewardsToken.balanceOf(address(this));
      uint256 rewards = afterBalance.sub(priorBalance);
      if (rewards > 0) {
        rewardsToken.safeTransfer(AAVE_COLLECTOR, rewards);
      }
    }
  }

  /** Owner methods to set params */
  function setMinter(address _minter) external onlyOwner {
    require(_minter != address(0), 'INVALID ADDRESS');
    emit MinterUpdated(MINTER, _minter);
    MINTER = _minter;
  }

  /** Owner methods related with veBAL to interact with Voting Escrow Curve contract */

  /// @inheritdoc IBalancerTreasury
  function lockBal(uint256 amount, uint256 unlockTime) external override onlyOwner {
    IERC20(BAL_TOKEN).safeApprove(VOTING_ESCROW, 0);
    IERC20(BAL_TOKEN).safeApprove(VOTING_ESCROW, amount);
    IVotingEscrow(VOTING_ESCROW).create_lock(amount, unlockTime);
  }

  /// @inheritdoc IBalancerTreasury
  function unlockBal() external override onlyOwner {
    IVotingEscrow(VOTING_ESCROW).withdraw();
  }

  /// @inheritdoc IBalancerTreasury
  function increaseLockedBal(uint256 amount) external override onlyOwner {
    IERC20(BAL_TOKEN).safeApprove(VOTING_ESCROW, 0);
    IERC20(BAL_TOKEN).safeApprove(VOTING_ESCROW, amount);
    IVotingEscrow(VOTING_ESCROW).increase_amount(amount);
  }

  /// @inheritdoc IBalancerTreasury
  function increaseUnlockTimeBal(uint256 unlockTime) external override onlyOwner {
    IVotingEscrow(VOTING_ESCROW).increase_unlock_time(unlockTime);
  }

  /** Owner methods related with Gauge Controller Voting contract */

  /// @inheritdoc IBalancerTreasury
  function voteForGaugeWeights(address gauge, uint256 weight) external override onlyOwner {
    IBalancerGaugeController(GAUGE_CONTROLLER).vote_for_gauge_weights(gauge, weight);
  }

  /// @inheritdoc IBalancerTreasury
  function transferOwnership(address newOwner) external override onlyOwner {
    require(newOwner != address(0), 'New owner cant be the zero address');
    emit OwnershipTransferred(_owner, newOwner);
    _owner = newOwner;
  }

  /// @inheritdoc IBalancerTreasury
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
   * @param token Balancer LP Token contract address
   * @param gauge Balancer Gauge Staking contract address
   * @param amount Amount of tokens
   */
  function _approveEntityTokens(
    address entity,
    address token,
    address gauge,
    uint256 amount
  ) internal {
    IERC20(token).safeApprove(entity, 0);
    IERC20(token).safeApprove(entity, amount);
    if (gauge != address(0)) {
      IERC20(token).safeApprove(gauge, 0);
      IERC20(token).safeApprove(gauge, amount);
      IERC20(BAL_TOKEN).safeApprove(entity, 0);
      IERC20(BAL_TOKEN).safeApprove(entity, amount);
      for (uint256 index = 0; index < MAX_REWARD_TOKENS; index++) {
        address reward = IBalancerGaugeView(gauge).reward_tokens(index);
        if (reward == address(0)) break;
        IERC20(reward).safeApprove(entity, 0);
        IERC20(reward).safeApprove(entity, amount);
      }
    }
  }

  /**
   * @dev Stake underliying token inside the Gauge Staking contract
   * @param gauge Address of the Gauge Staking contract
   * @param amount Amount of the underlying token to stake inside the contract
   */
  function _stakeGauge(address gauge, uint256 amount) internal {
    IBalancerGauge(gauge).deposit(amount);
  }

  /**
   * @dev Unstake underliying token from the Gauge Staking contract
   * @param gauge Address of the Gauge Staking contract
   * @param amount Amount of the underlying token to withdraw from the contract
   */
  function _unstakeGauge(address gauge, uint256 amount) internal {
    IBalancerGauge(gauge).withdraw(amount);
  }
}

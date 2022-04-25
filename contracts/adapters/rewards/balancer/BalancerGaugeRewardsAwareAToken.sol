// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {RewardsAwareAToken} from '../../../protocol/tokenization/RewardsAwareAToken.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IBalancerGauge, IBalancerGaugeView} from '../../interfaces/balancer/IBalancerGauge.sol';
import {IAaveIncentivesController} from '../../../interfaces/IAaveIncentivesController.sol';
import {IBalancerTreasury} from '../../interfaces/balancer/IBalancerTreasury.sol';
import 'hardhat/console.sol';

/**
 * @title Balancer Rewards Aware AToken
 * @notice AToken aware to claim and distribute rewards from an external Balancer Gauge controller.
 * @author Aave
 */
contract BalancerGaugeRewardsAwareAToken is RewardsAwareAToken {
  // BAL token address
  address internal immutable BAL_TOKEN;
  address internal immutable BALANCER_TREASURY;

  // Gauge contract address
  address internal _gaugeController;

  // reward address => pending reward to be distributed;
  mapping(address => uint256) internal _pendingRewards;

  uint256 internal _lastBlockUpdate;

  /**
   * @param balToken The address of the $BAL token
   * @param balTreasury The address of Aave Balancer Treasury
   */
  constructor(address balToken, address balTreasury) public {
    BAL_TOKEN = balToken;
    BALANCER_TREASURY = balTreasury;
  }

  /**
   * @dev Initializes the aToken
   * @param pool The address of the lending pool where this aToken will be used
   * @param treasury The address of the Aave treasury, receiving the fees on this aToken
   * @param underlyingAsset The address of the underlying asset of this aToken (E.g. WETH for aWETH)
   * @param incentivesController The smart contract managing potential incentives distribution
   * @param aTokenDecimals The decimals of the aToken, same as the underlying asset's
   * @param aTokenName The name of the aToken
   * @param aTokenSymbol The symbol of the aToken
   */
  function initialize(
    ILendingPool pool,
    address treasury,
    address underlyingAsset,
    IAaveIncentivesController incentivesController,
    uint8 aTokenDecimals,
    string calldata aTokenName,
    string calldata aTokenSymbol,
    bytes calldata params
  ) external virtual override initializer {
    uint256 chainId;

    //solium-disable-next-line
    assembly {
      chainId := chainid()
    }

    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        EIP712_DOMAIN,
        keccak256(bytes(aTokenName)),
        keccak256(EIP712_REVISION),
        chainId,
        address(this)
      )
    );

    _setName(aTokenName);
    _setSymbol(aTokenSymbol);
    _setDecimals(aTokenDecimals);

    _pool = pool;
    _treasury = treasury;
    _underlyingAsset = underlyingAsset;
    _incentivesController = incentivesController;

    _gaugeController = _decodeGaugeAddress(params);

    // Initialize Balancer Gauge rewards
    _rewardTokens[0] = BAL_TOKEN;

    // Gauge version is V5, discover reward tokens
    // Start for loop with index = 1 to not rewrite first element of rewardTokens
    for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
      address reward = IBalancerGaugeView(_decodeGaugeAddress(params)).reward_tokens(index - 1);
      if (reward == address(0)) break;

      _rewardTokens[index] = reward;
    }

    IERC20(underlyingAsset).safeApprove(BALANCER_TREASURY, type(uint256).max);

    emit Initialized(
      underlyingAsset,
      address(pool),
      treasury,
      address(incentivesController),
      aTokenDecimals,
      aTokenName,
      aTokenSymbol,
      params
    );
  }

  /** Start of Balancer external calls functions */

  /**
   * @dev External call to retrieve the lifetime accrued $BAL token rewards from the gauge contract
   */
  function _getExternalLifetimeBalancer() internal view returns (uint256) {
    return IBalancerGaugeView(_gaugeController).integrate_fraction(BALANCER_TREASURY);
  }

  /**
   * @dev External call to retrieve the current claimable extra token rewards from gauge contract
   */
  function _getExternalClaimableBalancerExtraRewards(address token)
    internal
    view
    returns (uint256)
  {
    return IBalancerGaugeView(_gaugeController).claimable_reward(BALANCER_TREASURY, token);
  }

  /** End of Balancer Specific functions */

  /** Start of Balancer Gauge extra reward functions  */

  /**
   * @dev External call to retrieve the extra rewards of the aToken contract from the gauge contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _getExternalLifetimeExtraRewards(address token) internal returns (uint256) {
    _updateRewards();

    uint256 accrued = _pendingRewards[token];
    _pendingRewards[token] = 0;
    return (_getLifetimeRewards(token).add(accrued));
  }

  /**
   * @dev External call to retrieve the extra rewards of the aToken contract from gauge contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _getExternalLifetimeExtraRewardsView(address token) internal view returns (uint256) {
    return _getLifetimeRewards(token).add(_getExternalClaimableBalancerExtraRewards(token));
  }

  /** End of Balancer Gauge extra reward functions  */

  /** Start of Rewards Aware AToken functions  */

  /**
   * @dev External call to retrieve the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _computeExternalLifetimeRewards(address token) internal override returns (uint256) {
    // The Balancer Gauge can give exact lifetime rewards and accrued rewards for the BAL token
    if (token == BAL_TOKEN) {
      return _getExternalLifetimeBalancer();
    }
    return _getExternalLifetimeExtraRewards(token);
  }

  /**
   * @dev External call to retrieve the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _getExternalLifetimeRewards(address token) internal view override returns (uint256) {
    // The Balancer Gauge can give exact lifetime rewards and accrued rewards for the BAL token
    if (token == BAL_TOKEN) {
      return _getExternalLifetimeBalancer();
    }
    return _getExternalLifetimeExtraRewardsView(token);
  }

  /**
   * @dev External call to claim the lifetime accrued rewards of the aToken contract from the gauge contract
   */
  function _claimRewardsFromController() internal override {
    _updateRewards();
  }

  function _updateRewards() internal {
    if (block.number > _lastBlockUpdate) {
      _lastBlockUpdate = block.number;
      // Claim other gauge tokens, and track the pending rewards to distribute at `_retrieveAvailableReward` call
      uint256[MAX_REWARD_TOKENS] memory priorTokenBalances;

      for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
        address rewardToken = _getRewardsTokenAddress(index);
        if (rewardToken == address(0)) break;
        if (rewardToken == BAL_TOKEN) continue;
        priorTokenBalances[index] = IERC20(rewardToken).balanceOf(address(this));
      }
      // Mint other rewards to aToken
      IBalancerTreasury(BALANCER_TREASURY).claimGaugeRewards(_underlyingAsset);

      for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
        address rewardToken = _getRewardsTokenAddress(index);
        if (rewardToken == address(0)) break;
        if (rewardToken == BAL_TOKEN) continue;
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        _pendingRewards[rewardToken] = _pendingRewards[rewardToken].add(
          balance.sub(priorTokenBalances[index])
        );
      }
    }
  }

  /**
   * @dev Deposit LP tokens at the Balancer Treasury and stake into the Gauge Contract from the Treasury
   * @param token Address of the LP Balancer token
   * @param amount Amount of tokens to deposit
   */
  function _stake(address token, uint256 amount) internal override returns (uint256) {
    if (token == UNDERLYING_ASSET_ADDRESS()) {
      IBalancerTreasury(BALANCER_TREASURY).deposit(token, amount, true);
    }
    return amount;
  }

  /**
   * @dev Withdraw LP tokens at the Balancer Treasury and stake into the Gauge Contract from the Treasury
   * @param token Address of the LP Balancer token
   * @param amount Amount of tokens to withdraw
   */
  function _unstake(address token, uint256 amount) internal override returns (uint256) {
    if (token == UNDERLYING_ASSET_ADDRESS()) {
      IBalancerTreasury(BALANCER_TREASURY).withdraw(token, amount, true);
    }
    return amount;
  }

  /**
   * @dev Param decoder to get Gauge Staking address. The decoder function is splitted due "Stack too deep" at constructor.
   * @param params Additional variadic field to include extra params. Expected parameters:
   * @return address of gauge
   */
  function _decodeGaugeAddress(bytes memory params) internal pure returns (address) {
    address gauge = abi.decode(params, (address));

    return gauge;
  }

  /** End of Rewards Aware AToken functions  */

  /** Start of External getters */
  function getBalToken() external view returns (address) {
    return BAL_TOKEN;
  }

  function getBalancerTreasury() external view returns (address) {
    return BALANCER_TREASURY;
  }

  function getGaugeController() external view returns (address) {
    return _gaugeController;
  }
  /** End of External getters */
}

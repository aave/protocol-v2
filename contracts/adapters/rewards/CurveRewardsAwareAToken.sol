// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {RewardsAwareAToken} from '../../protocol/tokenization/RewardsAwareAToken.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {ICurveMinter} from '../interfaces/curve/ICurveMinter.sol';
import {ICurveGauge, ICurveGaugeView} from '../interfaces/curve/ICurveGauge.sol';
import {IAaveIncentivesController} from '../../interfaces/IAaveIncentivesController.sol';

/**
 * @title Curve Rewards Aware AToken
 * @notice AToken aware to claim and distribute rewards from an external Curve Gauge controller.
 * @author Aave
 */
contract CurveRewardsAwareAToken is RewardsAwareAToken {
  // CRV token address
  address internal immutable CRV_TOKEN;

  // Gauge contract address
  address internal _gaugeController;

  // reward address => pending reward to be distributed;
  mapping(address => uint256) internal _pendingRewards;

  uint256 internal _lastBlockUpdate;

  /**
   * @param crvToken The address of the $CRV token
   */
  constructor(address crvToken) public {
    CRV_TOKEN = crvToken;
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

    // Initialize Curve Gauge rewards
    _gaugeController = underlyingAsset;
    _rewardTokens[0] = CRV_TOKEN;

    // Start for loop with index = 1 to not rewrite first element of rewardTokens
    for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
      address reward = ICurveGaugeView(underlyingAsset).reward_tokens(index - 1);
      if (reward == address(0)) break;

      _rewardTokens[index] = reward;
    }

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

  /** Start of Curve external calls functions */

  /**
   * @dev External call to retrieve the lifetime accrued $CRV token rewards from the external Rewards Controller contract
   */
  function _getExternalLifetimeCurve() internal view returns (uint256) {
    return ICurveGaugeView(_gaugeController).integrate_fraction(address(this));
  }

  /**
   * @dev External call to retrieve the current claimable extra token rewards from the external Rewards Controller contract
   */
  function _getExternalClaimableCurveExtraRewards(address token) internal view returns (uint256) {
    return ICurveGaugeView(_gaugeController).claimable_reward(address(this), token);
  }

  /** End of Curve Specific functions */

  /** Start of Curve Gauge extra reward functions  */

  /**
   * @dev External call to retrieve the extra rewards of the aToken contract from the external Rewards Controller contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _getExternalLifetimeExtraRewards(address token) internal returns (uint256) {
    _updateRewards();

    uint256 accrued = _pendingRewards[token];
    _pendingRewards[token] = 0;
    return (_getLifetimeRewards(token).add(accrued));
  }

  /**
   * @dev External call to retrieve the extra rewards of the aToken contract from the external Rewards Controller contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _getExternalLifetimeExtraRewardsView(address token) internal view returns (uint256) {
    return _getLifetimeRewards(token).add(_getExternalClaimableCurveExtraRewards(token));
  }

  /** End of Curve Gauge extra reward functions  */

  /** Start of Rewards Aware AToken functions  */

  /**
   * @dev External call to retrieve the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _computeExternalLifetimeRewards(address token) internal override returns (uint256) {
    // The Curve Gauge can give exact lifetime rewards and accrued rewards for the CRV token
    if (token == CRV_TOKEN) {
      ICurveGauge(_gaugeController).user_checkpoint(address(this));
      return _getExternalLifetimeCurve();
    }
    // Other rewards from the Curve Gauge can not get the lifetime rewards externally, only at the moment of claim, due they are external rewards outside the Curve ecosystem.
    return _getExternalLifetimeExtraRewards(token);
  }

  /**
   * @dev External call to retrieve the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   * @param token the reward token to retrieve lifetime rewards and accrued since last call
   */
  function _getExternalLifetimeRewards(address token) internal view override returns (uint256) {
    // The Curve Gauge can give exact lifetime rewards and accrued rewards for the CRV token
    if (token == CRV_TOKEN) {
      return _getExternalLifetimeCurve();
    }
    // Other rewards from the Curve Gauge can not get the lifetime rewards externally, only at the moment of claim, due they are external rewards outside the Curve ecosystem.
    return _getExternalLifetimeExtraRewardsView(token);
  }

  /**
   * @dev External call to claim the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   */
  function _claimRewardsFromController() internal override {
    // Mint CRV to aToken
    ICurveMinter(ICurveGaugeView(_gaugeController).minter()).mint(_gaugeController);

    _updateRewards();
  }

  function _updateRewards() internal {
    if (block.number > _lastBlockUpdate) {
      _lastBlockUpdate = block.number;
      // Claim other Curve gauge tokens, and track the pending rewards to distribute at `_retrieveAvailableReward` call
      uint256[MAX_REWARD_TOKENS] memory priorTokenBalances;

      for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
        address rewardToken = _getRewardsTokenAddress(index);
        if (rewardToken == address(0)) break;
        if (rewardToken == CRV_TOKEN) continue;
        priorTokenBalances[index] = IERC20(rewardToken).balanceOf(address(this));
      }
      // Mint other rewards to aToken
      ICurveGauge(_gaugeController).claim_rewards(address(this));

      for (uint256 index = 1; index < MAX_REWARD_TOKENS; index++) {
        address rewardToken = _getRewardsTokenAddress(index);
        if (rewardToken == address(0)) break;
        if (rewardToken == CRV_TOKEN) continue;
        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        _pendingRewards[rewardToken] = _pendingRewards[rewardToken].add(
          balance.sub(priorTokenBalances[index])
        );
      }
    }
  }

  /** End of Rewards Aware AToken functions  */

  /** Start of External getters */
  function getCrvToken() external view returns (address) {
    return CRV_TOKEN;
  }
  /** End of External getters */
}

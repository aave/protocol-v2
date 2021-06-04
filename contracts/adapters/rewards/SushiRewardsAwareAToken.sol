// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {RewardsAwareAToken} from '../../protocol/tokenization/RewardsAwareAToken.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IMasterChef} from '../interfaces/sushi/IMasterChef.sol';
import {ISushiBar} from '../interfaces/sushi/ISushiBar.sol';
import {IAaveIncentivesController} from '../../interfaces/IAaveIncentivesController.sol';
import {ISushiRewardsAwareAToken} from '../interfaces/sushi/ISushiRewardsAwareAToken.sol';

/**
 * @title Sushi LP Rewards Aware AToken
 * @notice AToken aware to claim and distribute XSUSHI rewards from MasterChef farm and SushiBar.
 * @author Aave
 */
contract SushiRewardsAwareAToken is RewardsAwareAToken, ISushiRewardsAwareAToken {
  address internal immutable MASTER_CHEF;
  address internal immutable SUSHI_BAR;
  address internal immutable SUSHI_TOKEN;

  uint256 internal _poolId;
  uint256 internal _pendingXSushiRewards;

  /**
   * @param masterChef The address of Master Chef LP staking contract
   * @param sushiBar The address of Sushi Bar xSUSHI staking contract
   * @param sushiToken The address of SUSHI token
   */
  constructor(
    address masterChef,
    address sushiBar,
    address sushiToken
  ) public {
    MASTER_CHEF = masterChef;
    SUSHI_BAR = sushiBar;
    SUSHI_TOKEN = sushiToken;
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
   * @param params Additional variadic field to include extra params. Expected parameters:
   *  uint256 poolId The id of the Master Chef pool
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

    // Sushi LP RewardsAwareToken init
    _poolId = _decodeParamsPoolId(params);

    // Set reward token as XSUSHI
    _rewardTokens[0] = SUSHI_BAR;

    // Approve moving our SLP into the master chef contract.
    IERC20(UNDERLYING_ASSET_ADDRESS()).approve(MASTER_CHEF, uint256(-1));
    IERC20(SUSHI_TOKEN).approve(SUSHI_BAR, uint256(-1));
  }

  /** Start of Sushi implementation */
  function _stakeSushi(uint256 amount) internal {
    uint256 priorXSushiBalance = _xSushiBalance();

    // Stake SUSHI rewards to Sushi Bar
    ISushiBar(SUSHI_BAR).enter(amount);

    // Pending XSUSHI to reward, will be claimed at `_updateDistribution` call
    _pendingXSushiRewards = _pendingXSushiRewards.add((_xSushiBalance()).sub(priorXSushiBalance));
  }

  function _unstakeSushi(uint256 amount) internal {
    ISushiBar(SUSHI_BAR).leave(amount);
  }

  function _sushiBalance() internal view returns (uint256) {
    return IERC20(SUSHI_TOKEN).balanceOf(address(this));
  }

  function _xSushiBalance() internal view returns (uint256) {
    return IERC20(SUSHI_BAR).balanceOf(address(this));
  }

  function _stakeMasterChef(uint256 amount) internal {
    uint256 priorSushiBalance = _sushiBalance();

    // Deposit to Master Chef and retrieve farmed SUSHI
    IMasterChef(MASTER_CHEF).deposit(_poolId, amount);

    uint256 balance = (_sushiBalance()).sub(priorSushiBalance);

    // Stake SUSHI rewards to Sushi Bar
    if (balance > 0) {
      _stakeSushi(balance);
    }
  }

  function _unstakeMasterChef(uint256 amount) internal {
    uint256 priorSushiBalance = _sushiBalance();

    // Deposit to Master Chef and retrieve farmed SUSHI
    IMasterChef(MASTER_CHEF).withdraw(_poolId, amount);

    uint256 balance = (_sushiBalance()).sub(priorSushiBalance);

    // Stake SUSHI rewards to Sushi Bar
    if (balance > 0) {
      _stakeSushi(balance);
    }
  }

  /** End of Sushi implementation */

  /** Start of Rewards Aware AToken implementation   */

  /**
   * @dev Param decoder to get Master Chef, Sushi bar and $SUSHI token addresses.
   * @param params Additional variadic field to include extra params. Expected parameters:
   *  uint256 poolId The id of the Master Chef pool
   * @return uint256 The pool id
   */
  function _decodeParamsPoolId(bytes memory params) internal pure returns (uint256) {
    uint256 poolId = abi.decode(params, (uint256));

    return poolId;
  }

  /**
   * @dev External call to retrieve the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   */
  function _computeExternalLifetimeRewards(address)
    internal
    override
    returns (uint256 lifetimeRewards)
  {
    uint256 pendingRewards = _pendingXSushiRewards;
    _pendingXSushiRewards = 0;
    return _getLifetimeRewards(SUSHI_BAR).add(pendingRewards);
  }

  /**
   * @dev External call to retrieve the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   */
  function _getExternalLifetimeRewards(address)
    internal
    view
    override
    returns (uint256 lifetimeRewards)
  {
    return _getLifetimeRewards(SUSHI_BAR).add(_pendingXSushiRewards);
  }

  /**
   * @dev External call to claim and stake SUSHI rewards
   */
  function _claimRewardsFromController() internal override {
    _stakeMasterChef(0);
  }

  function _stake(address token, uint256 amount) internal override returns (uint256) {
    if (token == UNDERLYING_ASSET_ADDRESS()) {
      _stakeMasterChef(amount);
    }
    return amount;
  }

  function _unstake(address token, uint256 amount) internal override returns (uint256) {
    if (token == UNDERLYING_ASSET_ADDRESS()) {
      _unstakeMasterChef(amount);
      return amount;
    }
    return amount;
  }

  /** End of Rewards Aware AToken functions  */

  /** Start of External getters */
  function getMasterChef() external view override returns (address) {
    return MASTER_CHEF;
  }

  function getSushiBar() external view override returns (address) {
    return SUSHI_BAR;
  }

  function getSushiToken() external view override returns (address) {
    return SUSHI_TOKEN;
  }

  function getMasterChefPoolId() external view override returns (uint256) {
    return _poolId;
  }
  /** End of External getters */
}

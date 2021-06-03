// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {IDelegationToken} from '../../interfaces/IDelegationToken.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {AToken} from './AToken.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IRewardsAwareAToken} from '../../interfaces/IRewardsAwareAToken.sol';
import {IAToken} from '../../interfaces/IRewardsAwareAToken.sol';
import {PercentageMath} from '../../protocol/libraries/math/PercentageMath.sol';

/**
 * @title Rewards Aware AToken
 * @notice AToken aware to claim and distribute rewards from an external rewards controller.
 * @author Aave
 */
abstract contract RewardsAwareAToken is AToken, IRewardsAwareAToken {
  using SafeERC20 for IERC20;
  using PercentageMath for uint256;

  // Precision of the multiplier for calculating distribution percentages
  uint256 public constant PRECISION = 24;
  // Max rewards allowed
  uint256 public constant MAX_REWARD_TOKENS = 9;
  // Multiplier for calculating share indexes
  uint256 public constant MULTIPLIER = 10**PRECISION;
  // Max rewards reserve factor
  uint256 public constant MAX_VALID_RESERVE_FACTOR = 10000;
  // Rewards Reserve Factor
  uint256 internal rewardsReserveFactor;

  // token => user => userIndex
  mapping(address => mapping(address => uint256)) private _userIndex;
  // token => user => userRewardsAccrued
  mapping(address => mapping(address => uint256)) private _userRewardsAccrued;
  // token => user => userRewardsClaimed
  mapping(address => mapping(address => uint256)) private _userRewardsClaimed;

  // token => rewardIndex
  mapping(address => uint256) private _rewardIndex;
  // reward address => lifetime rewards
  mapping(address => uint256) private _lifetimeRewards;
  // token => lifetimeMinted
  mapping(address => uint256) private _lifetimeClaimed;
  // reward tokens
  address[MAX_REWARD_TOKENS] internal _rewardTokens;

  modifier onlyPoolAdmin {
    address poolAdmin =
      ILendingPoolAddressesProvider(ILendingPool(_pool).getAddressesProvider()).getPoolAdmin();
    require(_msgSender() == poolAdmin, Errors.AT_CALLER_MUST_BE_POOL_ADMIN);
    _;
  }

  /**
   * @dev Get the current claimable rewards dinamically by calling the external rewards contract and simulate the rewards without storage
   * @param token Address of the rewards token
   * @param user Address of the account to get current claimable rewards
   * @return The claimable rewards of the address passed at the "user" argument
   */
  function getClaimableRewards(address token, address user) public view override returns (uint256) {
    return _getPendingRewards(token, user);
  }

  /**
   * @dev Get the total lifetime rewards of an address from contract storage
   * @param token Address of the rewards token
   * @param user Address of the account to get the total lifetime rewards
   * @return The total lifetime rewards of an address, this includes claimed and pending rewards
   */
  function getUserRewardsAccrued(address token, address user)
    external
    view
    override
    returns (uint256)
  {
    return _userRewardsAccrued[token][user];
  }

  /**
   * @dev Get the claimed rewards of an address from contract storage
   * @param token Address of the rewards token
   * @param user Address of the account to get the claimed rewards
   * @return The claimed rewards of an address
   */
  function getUserClaimedRewards(address token, address user)
    external
    view
    override
    returns (uint256)
  {
    return _userRewardsClaimed[token][user];
  }

  /**
   * @dev Get lifetime rewards of a rewards token
   * @param token Address of the rewards token
   * @return The total of lifetime rewards
   */
  function getLifetimeRewards(address token) external view override returns (uint256) {
    return _getLifetimeRewards(token);
  }

  /**
   * @dev Get lifetime minted rewards of a rewards token
   * @param token Address of the rewards token
   * @return The lifetime rewards claimed
   */
  function getLifetimeClaimed(address token) external view override returns (uint256) {
    return _lifetimeClaimed[token];
  }

  /**
   * @dev Get the user checkpoint of the aToken contract itself, from contract storage
   * @param token Address of the rewards token
   * @param user Address of the account to get the claimed rewards
   * @return The total lifetime rewards, this includes claimed and pending rewards from the aToken contract
   */
  function getUserIndex(address token, address user) external view override returns (uint256) {
    return _userIndex[token][user];
  }

  /**
   * @dev Get the rewards ERC20 token address by index position
   * @param index The position of the rewards, starting from zero up
   * @return The rewards ERC20 token address
   */
  function getRewardsTokenAddress(uint256 index) external view override returns (address) {
    return _getRewardsTokenAddress(index);
  }

  /**
   * @dev Get all the rewards token addresses
   * @return The list of rewards token addresseses
   */
  function getRewardsTokenAddressList()
    external
    view
    override
    returns (address[MAX_REWARD_TOKENS] memory)
  {
    return _rewardTokens;
  }

  /**
   * @dev Claim the available token rewards from the caller and transfers to `msg.sender`
   */
  function claim(address token) external override {
    _claim(token);
  }

  /**
   * @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
   * - Only callable by the LendingPool, as extra state updates there need to be managed
   * @param user The owner of the aTokens, getting them burned
   * @param receiverOfUnderlying The address that will receive the underlying
   * @param amount The amount being burned
   * @param index The new liquidity index of the reserve
   **/
  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) public virtual override(AToken, IAToken) onlyLendingPool {
    // Unstake
    _unstake(UNDERLYING_ASSET_ADDRESS(), amount);

    // Update distribution of rewards
    // _updateDistribution(user);

    // burns aTokens
    return super.burn(user, receiverOfUnderlying, amount, index);
  }

  /**
   * @dev Mints `amount` aTokens to `user`
   * - Only callable by the LendingPool, as extra state updates there need to be managed
   * @param user The address receiving the minted tokens
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   * @return `true` if the the previous balance of the user was 0
   */
  function mint(
    address user,
    uint256 amount,
    uint256 index
  ) public virtual override(AToken, IAToken) onlyLendingPool returns (bool) {
    // Stake
    _stake(UNDERLYING_ASSET_ADDRESS(), amount);

    // Update distribution of rewards
    // _updateDistribution(user);

    // mint aTokens
    return super.mint(user, amount, index);
  }

  /**
   * @dev Transfers the underlying asset to `target`. Used by the LendingPool to transfer
   * assets in borrow(), withdraw() and flashLoan()
   * @param target The recipient of the aTokens
   * @param amount The amount getting transferred
   * @return The amount transferred
   **/
  function transferUnderlyingTo(address target, uint256 amount)
    external
    virtual
    override(AToken, IAToken)
    onlyLendingPool
    returns (uint256)
  {
    _unstake(UNDERLYING_ASSET_ADDRESS(), amount);
    _updateDistribution(target);

    IERC20(UNDERLYING_ASSET_ADDRESS()).safeTransfer(target, amount);
    return amount;
  }

  /**
   * @dev Invoked to execute actions on the aToken side after a repayment.
   * @param user The user executing the repayment
   * @param amount The amount getting repaid
   **/
  function handleRepayment(address user, uint256 amount)
    external
    virtual
    override(AToken, IAToken)
    onlyLendingPool
  {
    _stake(UNDERLYING_ASSET_ADDRESS(), amount);
    _updateDistribution(user);
  }

  /**
   * @dev Set the rewards reserve factor to the treasury, only allowed by LendingPoolAddressesProvider pool admin
   * @param reserveFactor reserve factor in percent value
   */
  function setRewardsReserveFactor(uint256 reserveFactor) external override onlyPoolAdmin {
    _setRewardsReserveFactor(reserveFactor);
  }

  /**
   * @dev Return the rewards reserve factor to the treasury
   * @return reserve factor in percent value
   */
  function getRewardsReserveFactor() external view override returns (uint256) {
    return rewardsReserveFactor;
  }

  /**
   * @dev Hook to update distributions before token transfer. Called at "burn" and "transferUnderlyingTo".
   * @param from address of the `from`
   * @param to address of the `to`
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256
  ) internal override {
    _updateDistribution(from);
    _updateDistribution(to);
  }

  /**
   * @dev Get lifetime rewards of a rewards token
   * @param token Address of the rewards token
   * @return The total of lifetime rewards
   */
  function _getLifetimeRewards(address token) internal view returns (uint256) {
    return _lifetimeRewards[token];
  }

  /**
   * @dev Get the rewards ERC20 token address by index position
   * @param index The position of the rewards, starting from zero up
   * @return The rewards ERC20 token address
   */
  function _getRewardsTokenAddress(uint256 index) internal view returns (address) {
    if (index > MAX_REWARD_TOKENS) return address(0);

    return _rewardTokens[index];
  }

  /**
   * @dev Calculate rewards distribution in proportion of aTokens balance during a timeframe.
   * @param aTokensBalance The amounts of aTokens of the user
   * @param lastRewardIndex The last reward token index of the distribution percentage
   * @param lastUserIndex The last user index of the distribution percentage
   * @return The proportional rewards between two distribution percentages indexes
   */
  function _getRewards(
    uint256 aTokensBalance,
    uint256 lastRewardIndex,
    uint256 lastUserIndex
  ) internal pure returns (uint256) {
    return aTokensBalance.mul(lastRewardIndex.sub(lastUserIndex)).div(MULTIPLIER);
  }

  /**
   * @dev Calculate the next reward token index, that contains the sums of the percentages of the distribution of the token rewards.
   * @param latestRewardIndex The latest reward token index
   * @param accruedRewards The accrued rewards during the current distribution
   * @param aTokenSupply The total supply of this aToken contract
   * @return The sums of the reward indexes plus the latest percentage distribution index of the reward
   */
  function _getRewardIndex(
    uint256 latestRewardIndex,
    uint256 accruedRewards,
    uint256 aTokenSupply
  ) internal pure returns (uint256) {
    return latestRewardIndex.add(accruedRewards.mul(MULTIPLIER).div(aTokenSupply));
  }

  /**
   * @dev Getter for virtually calculating the pending rewards of an user without altering the storage of the contract
   * @param user Address of the user to lookup for rewards
   * @param token The rewards token to lookup for user rewards
   * @return Expected token rewards for an user
   */
  function _getPendingRewards(address token, address user) internal view returns (uint256) {
    uint256 aTokenTotalSupply = totalSupply();
    uint256 externalLifetimeRewards = _getExternalLifetimeRewards(token);
    uint256 rewardAccrued = externalLifetimeRewards.sub(_lifetimeRewards[token]);
    uint256 rewardAssetIndex = _rewardIndex[token];

    if (aTokenTotalSupply != 0 && rewardAccrued != 0) {
      rewardAssetIndex = _getRewardIndex(_rewardIndex[token], rewardAccrued, aTokenTotalSupply);
    }

    uint256 userLatestRewards =
      _getRewards(balanceOf(user), rewardAssetIndex, _userIndex[token][user]);

    return
      _userRewardsAccrued[token][user].add(userLatestRewards).sub(_userRewardsClaimed[token][user]);
  }

  /**
   * @dev Retrieve the latest rewards distribution to an user and update the distribution of a token rewards at storage
   * @param user The `user` address to update the rewards index and retrieve latest reward distribution
   * @param token The reward token to lookup the distribution
   * @param aTokenBalance The aToken balance of the user determines his share during the distribution
   * @param aTokenSupply The current total supply of this aToken
   */
  function _updateRewardDistribution(
    address user,
    address token,
    uint256 aTokenBalance,
    uint256 aTokenSupply
  ) private {
    uint256 userRewardsIndex = _userIndex[token][user];
    uint256 externalLifetimeRewards = _computeExternalLifetimeRewards(token);
    uint256 rewardAccrued = externalLifetimeRewards.sub(_lifetimeRewards[token]);
    uint256 previousRewardIndex = _rewardIndex[token];
    uint256 rewardIndex = _getRewardIndex(previousRewardIndex, rewardAccrued, aTokenSupply);

    // Check reward index
    if (rewardIndex != previousRewardIndex) {
      _rewardIndex[token] = rewardIndex;
      _setLifetimeRewards(token, externalLifetimeRewards);
      emit RewardIndexUpdate(token, rewardIndex);
    }

    // Check user reward index
    if (userRewardsIndex != rewardIndex) {
      _userIndex[token][user] = rewardIndex;
      emit UserIndexUpdate(user, token, rewardIndex);

      uint256 userRewardAccrued = _getRewards(aTokenBalance, rewardIndex, userRewardsIndex);
      if (userRewardAccrued != 0) {
        _userRewardsAccrued[token][user] = _userRewardsAccrued[token][user].add(userRewardAccrued);
        emit UserRewardSnapshot(user, token, userRewardAccrued);
      }
    }
  }

  /**
   * @dev Update the distribution of each rewards configured at this aToken
   * @param user The `user` address to update the rewards index and retrieve latest reward distribution
   */
  function _updateDistribution(address user) internal {
    if (user == address(0)) return;

    uint256 aTokenBalance = balanceOf(user);
    if (aTokenBalance == 0) {
      return;
    }

    uint256 aTokenSupply = totalSupply();
    if (aTokenSupply == 0) {
      return;
    }

    for (uint256 index; index < MAX_REWARD_TOKENS; index++) {
      address rewardToken = _rewardTokens[index];
      if (rewardToken == address(0)) break;

      _updateRewardDistribution(user, rewardToken, aTokenBalance, aTokenSupply);
    }
  }

  /**
   * @dev Set token rewards claimed from an `user` address
   * @param user The `user` address to sum and set the claimed rewards
   * @param token The claimed reward `token` address
   * @param claimed The amount of `claimed` rewards by the `user`
   */
  function _setUserRewardsClaimed(
    address user,
    address token,
    uint256 claimed
  ) private {
    _userRewardsClaimed[token][user] = _userRewardsClaimed[token][user].add(claimed);
    _lifetimeClaimed[token] = _lifetimeClaimed[token].add(claimed);
  }

  /**
   * @dev Claim the available rewards from the caller and transfers to `msg.sender`
   * @param token Reward adresss to lookup rewards and claim
   */
  function _claim(address token) private {
    // Mint the available rewards from the external rewards controller to this aToken contract implementation
    _claimRewardsFromController();

    // Update aToken and user rewards
    _updateDistribution(msg.sender);

    // Get the remaining tokens to claim
    uint256 accruedRewards =
      _userRewardsAccrued[token][msg.sender].sub(_userRewardsClaimed[token][msg.sender]);

    if (accruedRewards > 0) {
      // Track the claimed rewards
      _setUserRewardsClaimed(msg.sender, token, accruedRewards);
      // Unstake reward token, if needed
      uint256 unstaked = _unstake(token, accruedRewards);
      uint256 userRewards = unstaked;

      // Transfer rewards to treasury
      if (_treasury != address(0)) {
        uint256 reserveRewards = unstaked.percentMul(rewardsReserveFactor);
        if (reserveRewards > 0) {
          userRewards = unstaked.sub(reserveRewards);
          IERC20(token).safeTransfer(_treasury, reserveRewards);
        }
      }

      // Transfer rewards to user
      IERC20(token).safeTransfer(msg.sender, userRewards);
      emit Claim(msg.sender, token, accruedRewards, userRewards);
    }
  }

  /**
   * @dev Set the lifetime token lifetime rewards
   * @param token The reward token address
   * @param amount The amount of lifetime rewards
   */
  function _setLifetimeRewards(address token, uint256 amount) private {
    _lifetimeRewards[token] = amount;
  }

  /**
   * @dev External call to retrieve the lifetime rewards of the aToken contract to the external Rewards Controller contract
   * @notice Should only mutate the state outside RewardsAwareAToken abstract contract
   * @param token Reward adresss to lookup available rewards
   * @notice To be implemented by the contract that inherits this abstract contract RewardsAwareAToken
   */
  function _computeExternalLifetimeRewards(address token) internal virtual returns (uint256);

  /**
   * @dev External view call to retrieve the lifetime rewards of the aToken contract to the external Rewards Controller contract
   * @param token Reward adresss to lookup available rewards
   * @notice To be implemented by the contract that inherits this abstract contract RewardsAwareAToken
   */
  function _getExternalLifetimeRewards(address token) internal view virtual returns (uint256);

  /**
   * @dev External call to claim the lifetime accrued rewards of the aToken contract to the external Rewards Controller contract
   * @notice To be implemented by the contract that inherits this abstract contract RewardsAwareAToken
   * @notice WIP pending to check virtual balance versus claimed
   */
  function _claimRewardsFromController() internal virtual;

  /**
   * @dev External call to stake a token of the aToken contract
   * @notice Optional, to be implemented by the contract that inherits this abstract contract RewardsAwareAToken,if needed.
   * @param amount to stake
   */
  function _stake(address, uint256 amount) internal virtual returns (uint256) {
    return amount;
  }

  /**
   * @dev External call to unstake a token of the aToken contract
   * @notice Optional, to be implemented by the contract that inherits this abstract contract RewardsAwareAToken, if needed.
   * @param amount to unstake
   */
  function _unstake(address, uint256 amount) internal virtual returns (uint256) {
    return amount;
  }

  /**
   * @dev Set the rewards reserve factor to the treasury
   * @param reserveFactor reserve factor in percent value
   */
  function _setRewardsReserveFactor(uint256 reserveFactor) internal {
    require(reserveFactor <= MAX_VALID_RESERVE_FACTOR, Errors.RC_INVALID_RESERVE_FACTOR);
    rewardsReserveFactor = reserveFactor;
    emit RewardsReserveFactorUpdate(rewardsReserveFactor);
  }
}

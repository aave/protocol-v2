// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {Context} from '@openzeppelin/contracts/GSN/Context.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {DebtTokenBase} from './base/DebtTokenBase.sol';
import {MathUtils} from '../libraries/math/MathUtils.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {IStableDebtToken} from './interfaces/IStableDebtToken.sol';

/**
 * @title contract StableDebtToken
 * @notice Implements a stable debt token to track the user positions
 * @author Aave
 **/
contract StableDebtToken is IStableDebtToken, DebtTokenBase {
  using WadRayMath for uint256;

  uint256 public constant DEBT_TOKEN_REVISION = 0x1;

  uint256 private _avgStableRate;
  mapping(address => uint40) _timestamps;
  uint40 _totalSupplyTimestamp;

  constructor(
    address pool,
    address underlyingAsset,
    string memory name,
    string memory symbol,
    address incentivesController
  ) public DebtTokenBase(pool, underlyingAsset, name, symbol, incentivesController) {}

  /**
   * @dev gets the revision of the stable debt token implementation
   * @return the debt token implementation revision
   **/
  function getRevision() internal virtual override pure returns (uint256) {
    return DEBT_TOKEN_REVISION;
  }

  /**
   * @dev returns the average stable rate across all the stable rate debt
   * @return the average stable rate
   **/
  function getAverageStableRate() external virtual override view returns (uint256) {
    return _avgStableRate;
  }

  /**
   * @dev returns the timestamp of the last user action
   * @return the last update timestamp
   **/
  function getUserLastUpdated(address user) external virtual override view returns (uint40) {
    return _timestamps[user];
  }

  /**
   * @dev returns the stable rate of the user
   * @param user the address of the user
   * @return the stable rate of user
   **/
  function getUserStableRate(address user) external virtual override view returns (uint256) {
    return _usersData[user];
  }

  /**
   * @dev calculates the current user debt balance
   * @return the accumulated debt of the user
   **/
  function balanceOf(address account) public virtual override view returns (uint256) {
    uint256 accountBalance = super.balanceOf(account);
    uint256 stableRate = _usersData[account];
    if (accountBalance == 0) {
      return 0;
    }
    uint256 cumulatedInterest = MathUtils.calculateCompoundedInterest(
      stableRate,
      _timestamps[account]
    );
    return accountBalance.rayMul(cumulatedInterest);
  }

  struct MintLocalVars {
    uint256 currentSupply;
    uint256 nextSupply;
    uint256 amountInRay;
    uint256 newStableRate;
    uint256 currentAvgStableRate;
  }

  /**
   * @dev mints debt token to the target user. The resulting rate is the weighted average
   * between the rate of the new debt and the rate of the previous debt
   * @param user the address of the user
   * @param amount the amount of debt tokens to mint
   * @param rate the rate of the debt being minted.
   **/
  function mint(
    address user,
    uint256 amount,
    uint256 rate
  ) external override onlyLendingPool {
    MintLocalVars memory vars;

    //cumulates the user debt
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(user);

    //accrueing the interest accumulation to the stored total supply and caching it
    vars.currentSupply = totalSupply();
    vars.currentAvgStableRate = _avgStableRate;
    vars.nextSupply = _totalSupply = vars.currentSupply.add(amount);

    vars.amountInRay = amount.wadToRay();

    //calculates the new stable rate for the user
    vars.newStableRate = _usersData[user]
      .rayMul(currentBalance.wadToRay())
      .add(vars.amountInRay.rayMul(rate))
      .rayDiv(currentBalance.add(amount).wadToRay());

    require(vars.newStableRate < (1 << 128), 'Debt token: stable rate overflow');
    _usersData[user] = vars.newStableRate;

    //updating the user and supply timestamp
    //solium-disable-next-line
    _totalSupplyTimestamp = _timestamps[user] = uint40(block.timestamp);

    //calculates the updated average stable rate
    _avgStableRate = vars.currentAvgStableRate
      .rayMul(vars.currentSupply.wadToRay())
      .add(rate.rayMul(vars.amountInRay))
      .rayDiv(vars.nextSupply.wadToRay());

    _mint(user, amount.add(balanceIncrease));

    // transfer event to track balances
    emit Transfer(address(0), user, amount);

    emit MintDebt(
      user,
      amount,
      previousBalance,
      currentBalance,
      balanceIncrease,
      vars.newStableRate
    );
  }

  /**
   * @dev burns debt of the target user.
   * @param user the address of the user
   * @param amount the amount of debt tokens to mint
   **/
  function burn(address user, uint256 amount) external override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(user);

      
    uint256 currentSupply = totalSupply();
    uint256 currentAvgStableRate = _avgStableRate;
   

    if (currentSupply <= amount) {
      _avgStableRate = 0;
      _totalSupply = 0;
    } else {
       uint256 nextSupply = _totalSupply = currentSupply.sub(amount);
      _avgStableRate = _avgStableRate
        .rayMul(currentSupply.wadToRay())
        .sub(_usersData[user].rayMul(amount.wadToRay()))
        .rayDiv(nextSupply.wadToRay());
    }

    if (amount == currentBalance) {
      _usersData[user] = 0;
      _timestamps[user] = 0;

    } else {
      //solium-disable-next-line
      _timestamps[user] = uint40(block.timestamp);
    }
    //solium-disable-next-line
    _totalSupplyTimestamp = uint40(block.timestamp);

    if (balanceIncrease > amount) {
      _mint(user, balanceIncrease.sub(amount));
    } else {
      _burn(user, amount.sub(balanceIncrease));
    }

    // transfer event to track balances
    emit Transfer(user, address(0), amount);
 
    emit BurnDebt(user, amount, previousBalance, currentBalance, balanceIncrease);
  }

  /**
   * @dev Calculates the increase in balance since the last user interaction
   * @param user The address of the user for which the interest is being accumulated
   * @return The previous principal balance, the new principal balance, the balance increase
   * and the new user index
   **/
  function _calculateBalanceIncrease(address user)
    internal
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    uint256 previousPrincipalBalance = super.balanceOf(user);

    if (previousPrincipalBalance == 0) {
      return (0, 0, 0);
    }

    // Calculation of the accrued interest since the last accumulation
    uint256 balanceIncrease = balanceOf(user).sub(previousPrincipalBalance);

    return (
      previousPrincipalBalance,
      previousPrincipalBalance.add(balanceIncrease),
      balanceIncrease
    );
  }

  function getSupplyData() public override view returns (uint256, uint256, uint256) {
    uint256 avgRate = _avgStableRate;
    return (super.totalSupply(), _calcTotalSupply(avgRate), avgRate);
  }

  function getTotalSupplyAndAvgRate() public override view returns (uint256, uint256) {
    uint256 avgRate = _avgStableRate;
    return (_calcTotalSupply(avgRate), avgRate);
  }

  function totalSupply() public override view returns (uint256) {
    _calcTotalSupply(_avgStableRate);
  }
  
  function getTotalSupplyLastUpdated() public override view returns(uint40) {
    return _totalSupplyTimestamp;
  }

  /**
   * @dev Returns the principal debt balance of the user from
   * @return The debt balance of the user since the last burn/mint action
   **/
  function principalBalanceOf(address user) external virtual override view returns (uint256) {
    return super.balanceOf(user);
  }

  function _calcTotalSupply(uint256 avgRate) internal view returns(uint256) {
    uint256 principalSupply = super.totalSupply();
    if (principalSupply == 0) {
      return 0;
    }
    uint256 cumulatedInterest = MathUtils.calculateCompoundedInterest(
      avgRate,
      _totalSupplyTimestamp
    );
    return principalSupply.rayMul(cumulatedInterest);
  }
}

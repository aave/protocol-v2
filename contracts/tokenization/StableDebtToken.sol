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
    string memory symbol
  ) public DebtTokenBase(pool, underlyingAsset, name, symbol) {}

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
    uint256 accountBalance = principalBalanceOf(account);
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
    uint256 supplyAfterMint;
    uint256 supplyBeforeMint;
    uint256 amountInRay;
    uint256 newStableRate;
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

    vars.supplyBeforeMint = totalSupply().add(balanceIncrease);
    vars.supplyAfterMint = vars.supplyBeforeMint.add(amount);

    vars.amountInRay = amount.wadToRay();

    //calculates the new stable rate for the user
    vars.newStableRate = _usersData[user]
      .rayMul(currentBalance.wadToRay())
      .add(vars.amountInRay.rayMul(rate))
      .rayDiv(currentBalance.add(amount).wadToRay());

    require(vars.newStableRate < (1 << 128), 'Debt token: stable rate overflow');
    _usersData[user] = vars.newStableRate;

    //solium-disable-next-line
    _totalSupplyTimestamp = _timestamps[user] = uint40(block.timestamp);


    //calculates the updated average stable rate
    _avgStableRate = _avgStableRate
      .rayMul(vars.supplyBeforeMint.wadToRay())
      .add(rate.rayMul(vars.amountInRay))
      .rayDiv(vars.supplyAfterMint.wadToRay());

    _mint(user, amount.add(balanceIncrease));

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

    uint256 supplyBeforeBurn = totalSupply().add(balanceIncrease);
    uint256 supplyAfterBurn = supplyBeforeBurn.sub(amount);

    if (supplyAfterBurn == 0) {
      _avgStableRate = 0;
    } else {
      _avgStableRate = _avgStableRate
        .rayMul(supplyBeforeBurn.wadToRay())
        .sub(_usersData[user].rayMul(amount.wadToRay()))
        .rayDiv(supplyAfterBurn.wadToRay());
    }

    if (amount == currentBalance) {
      _usersData[user] = 0;
      _timestamps[user] = 0;
    } else {
      //solium-disable-next-line
      _totalSupplyTimestamp = _timestamps[user] = uint40(block.timestamp);
    }

    if (balanceIncrease > amount) {
      _mint(user, balanceIncrease.sub(amount));
    } else {
      _burn(user, amount.sub(balanceIncrease));
    }

    emit BurnDebt(user, amount, previousBalance, currentBalance, balanceIncrease);
  }


  /**
   * @dev Calculates the increase in balance since the last user interaction
   * @param user The address of the user for which the interest is being accumulated
   * @return The previous principal balance, the new principal balance, the balance increase
   * and the new user index
   **/
  function _calculateBalanceIncrease(address user) internal view returns (uint256, uint256, uint256) {
    uint256 previousPrincipalBalance = principalBalanceOf(user);

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

  function principalTotalSupply() public override view returns(uint256) {
    return super.totalSupply();
  }
  
  function totalSupply() public override view returns(uint256) {
    uint256 principalSupply = super.totalSupply();
    if (principalSupply == 0) {
      return 0;
    }
    uint256 cumulatedInterest = MathUtils.calculateCompoundedInterest(
      _avgStableRate,
      _totalSupplyTimestamp
    );
    return principalSupply.rayMul(cumulatedInterest);
  }

}

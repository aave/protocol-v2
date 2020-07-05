pragma solidity ^0.6.0;

import '@openzeppelin/contracts/GSN/Context.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import {DebtTokenBase} from './base/DebtTokenBase.sol';
import {MathUtils} from '../libraries/MathUtils.sol';
import {WadRayMath} from '../libraries/WadRayMath.sol';
import {IStableDebtToken} from './interfaces/IStableDebtToken.sol';

contract StableDebtToken is IStableDebtToken, DebtTokenBase {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using Address for address;

  struct UserData {
    uint256 currentRate;
    uint40 lastUpdateTimestamp;
  }

  uint256 private avgStableRate;

  mapping(address => UserData) usersData;

  event mintDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease,
    uint256 _newRate
  );
  event burnDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease
  );

  function getAverageStableRate() external virtual override view returns (uint256) {
    return avgStableRate;
  }

  function getUserLastUpdated(address _user) external virtual override view returns (uint40) {
    return usersData[_user].lastUpdateTimestamp;
  }


  function getUserStableRate(address _user) external virtual override view returns (uint256) {
    return usersData[_user].currentRate;
  }

  /**
   * @dev See {IERC20-balanceOf}.
   */
  function balanceOf(address account) public virtual override view returns (uint256) {
    if(balances[account] == 0) {
        return 0;
    }

    UserData storage userData = usersData[account];

    uint256 cumulatedInterest = MathUtils.calculateCompoundedInterest(
      userData.currentRate,
      userData.lastUpdateTimestamp
    );
    return balances[account].wadToRay().rayMul(cumulatedInterest).rayToWad();
  }

  /** @dev Creates `amount` tokens and assigns them to `account`, increasing
   * the total supply.
   *
   * Emits a {Transfer} event with `from` set to the zero address.
   *
   * Requirements
   *
   * - `to` cannot be the zero address.
   */

  struct MintLocalVars {
    uint256 newSupply;
    uint256 amountInRay;
    uint256 newStableRate;
  }

  function mint(
    address account,
    uint256 amount,
    uint256 rate
  ) public override onlyLendingPool {

    MintLocalVars memory vars;
    
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = internalCumulateBalance(account);


    vars.newSupply = totalSupply.add(amount);

    vars.amountInRay = amount.wadToRay();

    vars.newStableRate = usersData[account]
      .currentRate
      .rayMul(currentBalance.wadToRay())
      .add(vars.amountInRay.rayMul(rate))
      .rayDiv(currentBalance.add(amount).wadToRay());

    usersData[account].currentRate = vars.newStableRate;

    usersData[account].lastUpdateTimestamp = uint40(block.timestamp);

    avgStableRate = avgStableRate
      .rayMul(totalSupply.wadToRay())
      .add(rate.rayMul(vars.amountInRay))
      .rayDiv(vars.newSupply.wadToRay());

    internalMint(account, amount);

    emit mintDebt(
      account,
      amount,
      previousBalance,
      currentBalance,
      balanceIncrease,
      vars.newStableRate
    );
  }

  /**
   * @dev Destroys `amount` tokens from `account`, reducing the
   * total supply.
   *
   * Emits a {Transfer} event with `to` set to the zero address.
   *
   * Requirements
   *
   * - `account` cannot be the zero address.
   * - `account` must have at least `amount` tokens.
   */
  function burn(address _account, uint256 _amount) public override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = internalCumulateBalance(_account);

    uint256 newSupply = totalSupply.sub(_amount);

    uint256 amountInRay = _amount.wadToRay();

    if (newSupply == 0) {
      avgStableRate = 0;
    } else {
      avgStableRate = avgStableRate
        .rayMul(totalSupply.wadToRay())
        .sub(usersData[_account].currentRate.rayMul(amountInRay))
        .rayDiv(newSupply.wadToRay());
    }

    if(_amount == currentBalance){
      usersData[_account].currentRate = 0;
      usersData[_account].lastUpdateTimestamp = 0;
    }

    internalBurn(_account, _amount);

    emit burnDebt(_account, _amount, previousBalance, currentBalance, balanceIncrease);
  }

  /**
   * @dev accumulates the accrued interest of the user to the principal balance
   * @param _user the address of the user for which the interest is being accumulated
   * @return the previous principal balance, the new principal balance, the balance increase
   **/
  function internalCumulateBalance(address _user)
    internal
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    uint256 previousPrincipalBalance = balances[_user];

    if(previousPrincipalBalance == 0){
      return (0,0,0);
    }

    //calculate the accrued interest since the last accumulation
    uint256 balanceIncrease = balanceOf(_user).sub(previousPrincipalBalance);
    //mints an amount of tokens equivalent to the amount accumulated
    internalMint(_user, balanceIncrease);

    return (
      previousPrincipalBalance,
      previousPrincipalBalance.add(balanceIncrease),
      balanceIncrease
    );
  }
}

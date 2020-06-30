pragma solidity ^0.6.0;

import '@openzeppelin/contracts/GSN/Context.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import {DebtTokenBase} from './base/DebtTokenBase.sol';
import {WadRayMath} from '../libraries/WadRayMath.sol';
import '@nomiclabs/buidler/console.sol';
import {IVariableDebtToken} from './interfaces/IVariableDebtToken.sol';


contract VariableDebtToken is DebtTokenBase, IVariableDebtToken {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using Address for address;

  mapping(address => uint256) private userIndexes;

  event mintDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease,
    uint256 _index
  );
  event burnDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease,
    uint256 _index
  );

  /**
   * @dev See {IERC20-balanceOf}.
   */
  function balanceOf(address account) public virtual override view returns (uint256) {

    if (balances[account] == 0) {
      return 0;
    }

    return
      balances[account]
        .wadToRay()
        .rayMul(pool.getReserveNormalizedVariableDebt(underlyingAssetAddress))
        .rayToWad();
  }

  function getUserIndex(address _user) public virtual override view returns(uint256) {
    return userIndexes[_user];
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
  function mint(address account, uint256 amount) public override onlyLendingPool {

    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease,
      uint256 index
    ) = internalCumulateBalance(account);

    internalMint(account, amount);

    emit mintDebt(account, amount, previousBalance, currentBalance, balanceIncrease, index);
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
  function burn(address account, uint256 amount) public override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease,
      uint256 index
    ) = internalCumulateBalance(account);

    internalBurn(account, amount);

    emit burnDebt(account, amount, previousBalance, currentBalance, balanceIncrease, index);
  }

  /**
   * @dev accumulates the accrued interest of the user to the principal balance
   * @param _user the address of the user for which the interest is being accumulated
   * @return the previous principal balance, the new principal balance, the balance increase
   * and the new user index
   **/
  function internalCumulateBalance(address _user)
    internal
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    uint256 previousPrincipalBalance = balances[_user];

    //calculate the accrued interest since the last accumulation
    uint256 balanceIncrease = balanceOf(_user).sub(previousPrincipalBalance);
    //mints an amount of tokens equivalent to the amount accumulated
    internalMint(_user, balanceIncrease);
    //updates the user index
    uint256 index = userIndexes[_user] = pool.getReserveNormalizedVariableDebt(
      underlyingAssetAddress
    );
    return (
      previousPrincipalBalance,
      previousPrincipalBalance.add(balanceIncrease),
      balanceIncrease,
      index
    );
  }
}

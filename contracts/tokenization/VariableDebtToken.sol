pragma solidity ^0.6.0;

import '@openzeppelin/contracts/GSN/Context.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import {DebtTokenBase} from './base/DebtTokenBase.sol';
import {WadRayMath} from '../libraries/WadRayMath.sol';
import '@nomiclabs/buidler/console.sol';
import {IVariableDebtToken} from './interfaces/IVariableDebtToken.sol';

/**
 * @title interface IVariableDebtToken
 * @author Aave
 * @notice defines the basic interface for a variable debt token.
 * @dev does not inherit from IERC20 to save in contract size
 **/
contract VariableDebtToken is DebtTokenBase, IVariableDebtToken {
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using Address for address;

  mapping(address => uint256) private userIndexes;

  /**
   * @dev emitted when new variable debt is minted
   * @param _user the user receiving the debt
   * @param _amount the amount of debt being minted
   * @param _previousBalance the previous balance of the user
   * @param _currentBalance the current balance of the user
   * @param _balanceIncrease the debt accumulated since the last action
   * @param _index the index of the user
   **/
  event mintDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease,
    uint256 _index
  );

  /**
   * @dev emitted when variable debt is burnt
   * @param _user the user which debt has been burned
   * @param _amount the amount of debt being burned
   * @param _previousBalance the previous balance of the user
   * @param _currentBalance the current balance of the user
   * @param _balanceIncrease the debt accumulated since the last action
   * @param _index the index of the user
   **/
  event burnDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease,
    uint256 _index
  );

    constructor(address _pool, address _underlyingAsset) DebtTokenBase(_pool, _underlyingAsset) public {
    
  }
  
  /**
   * @dev calculates the accumulated debt balance of the user
   * @return the debt balance of the user
   **/
  function balanceOf(address _user) public virtual override view returns (uint256) {
    if (balances[_user] == 0) {
      return 0;
    }

    return
      balances[_user]
        .wadToRay()
        .rayMul(pool.getReserveNormalizedVariableDebt(underlyingAssetAddress))
        .rayDiv(userIndexes[_user])
        .rayToWad();
  }

  /**
   * @dev returns the index of the last user action
   * @return the user index
   **/

  function getUserIndex(address _user) public virtual override view returns (uint256) {
    return userIndexes[_user];
  }

  /**
   * @dev mints new variable debt
   * @param _user the user receiving the debt
   * @param _amount the amount of debt being minted
   **/
  function mint(address _user, uint256 _amount) public override onlyLendingPool {
    (uint256 previousBalance, uint256 currentBalance, uint256 balanceIncrease) = _cumulateBalance(
      _user
    );

    _mint(_user, _amount);

    userIndexes[_user] = pool.getReserveNormalizedVariableDebt(underlyingAssetAddress);

    emit mintDebt(
      _user,
      _amount,
      previousBalance,
      currentBalance,
      balanceIncrease,
      userIndexes[_user]
    );
  }

  /**
   * @dev burns user variable debt
   * @param _user the user which debt is burnt
   * @param _amount the amount of debt being burned
   **/
  function burn(address _user, uint256 _amount) public override onlyLendingPool {
    (uint256 previousBalance, uint256 currentBalance, uint256 balanceIncrease) = _cumulateBalance(
      _user
    );

    _burn(_user, _amount);

    //if user repaid everything
    if (currentBalance == _amount) {
      userIndexes[_user] = 0;
    } else {
      userIndexes[_user] = pool.getReserveNormalizedVariableDebt(underlyingAssetAddress);
    }

    emit burnDebt(
      _user,
      _amount,
      previousBalance,
      currentBalance,
      balanceIncrease,
      userIndexes[_user]
    );
  }

  /**
   * @dev accumulates the accrued interest of the user to the principal balance
   * @param _user the address of the user for which the interest is being accumulated
   * @return the previous principal balance, the new principal balance, the balance increase
   * and the new user index
   **/
  function _cumulateBalance(address _user)
    internal
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    uint256 previousPrincipalBalance = balances[_user];

    if (previousPrincipalBalance == 0) {
      return (0, 0, 0);
    }

    //calculate the accrued interest since the last accumulation
    uint256 balanceIncrease = balanceOf(_user).sub(previousPrincipalBalance);

    //mints an _amount of tokens equivalent to the _amount accumulated
    _mint(_user, balanceIncrease);

    return (
      previousPrincipalBalance,
      previousPrincipalBalance.add(balanceIncrease),
      balanceIncrease
    );
  }
}

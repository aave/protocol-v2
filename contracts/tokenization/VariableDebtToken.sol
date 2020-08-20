// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {Context} from '@openzeppelin/contracts/GSN/Context.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {DebtTokenBase} from './base/DebtTokenBase.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
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

  uint256 public constant DEBT_TOKEN_REVISION = 0x1;

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
  event MintDebt(
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
  event BurnDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease,
    uint256 _index
  );

  constructor(
    address _pool,
    address _underlyingAsset,
    string memory _name,
    string memory _symbol
  ) public DebtTokenBase(_pool, _underlyingAsset, _name, _symbol) {}

  /**
   * @dev gets the revision of the stable debt token implementation
   * @return the debt token implementation revision
   **/
  function getRevision() internal virtual override pure returns (uint256) {
    return DEBT_TOKEN_REVISION;
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

  function getUserIndex(address _user) external virtual override view returns (uint256) {
    return userIndexes[_user];
  }

  /**
   * @dev mints new variable debt
   * @param _user the user receiving the debt
   * @param _amount the amount of debt being minted
   **/
  function mint(address _user, uint256 _amount) external override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(_user);

    _mint(_user, _amount.add(balanceIncrease));

    uint256 newUserIndex = pool.getReserveNormalizedVariableDebt(underlyingAssetAddress);
    userIndexes[_user] = newUserIndex;

    emit MintDebt(_user, _amount, previousBalance, currentBalance, balanceIncrease, newUserIndex);
  }

  /**
   * @dev burns user variable debt
   * @param _user the user which debt is burnt
   * @param _amount the amount of debt being burned
   **/
  function burn(address _user, uint256 _amount) external override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(_user);

    if (balanceIncrease > _amount) {
      _mint(_user, balanceIncrease.sub(_amount));
    } else {
      _burn(_user, _amount.sub(balanceIncrease));
    }

    uint256 newUserIndex = 0;
    //if user not repaid everything
    if (currentBalance != _amount) {
      newUserIndex = pool.getReserveNormalizedVariableDebt(underlyingAssetAddress);
    }
    userIndexes[_user] = newUserIndex;

    emit BurnDebt(_user, _amount, previousBalance, currentBalance, balanceIncrease, newUserIndex);
  }
}

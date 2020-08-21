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

  mapping(address => uint256) private _userIndexes;

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
   * @dev calculates the accumulated debt balance of the user
   * @return the debt balance of the user
   **/
  function balanceOf(address user) public virtual override view returns (uint256) {
    uint256 userBalance = _balances[user];
    if (userBalance == 0) {
      return 0;
    }

    return
      userBalance
        .wadToRay()
        .rayMul(_pool.getReserveNormalizedVariableDebt(_underlyingAssetAddress))
        .rayDiv(_userIndexes[user])
        .rayToWad();
  }

  /**
   * @dev returns the index of the last user action
   * @return the user index
   **/

  function getUserIndex(address user) external virtual override view returns (uint256) {
    return _userIndexes[user];
  }

  /**
   * @dev mints new variable debt
   * @param user the user receiving the debt
   * @param amount the amount of debt being minted
   **/
  function mint(address user, uint256 amount) external override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(user);

    _mint(user, amount.add(balanceIncrease));

    uint256 newUserIndex = _pool.getReserveNormalizedVariableDebt(_underlyingAssetAddress);
    _userIndexes[user] = newUserIndex;

    emit MintDebt(user, amount, previousBalance, currentBalance, balanceIncrease, newUserIndex);
  }

  /**
   * @dev burns user variable debt
   * @param user the user which debt is burnt
   * @param amount the amount of debt being burned
   **/
  function burn(address user, uint256 amount) external override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(user);

    if (balanceIncrease > amount) {
      _mint(user, balanceIncrease.sub(amount));
    } else {
      _burn(user, amount.sub(balanceIncrease));
    }

    uint256 newUserIndex = 0;
    //if user not repaid everything
    if (currentBalance != amount) {
      newUserIndex = _pool.getReserveNormalizedVariableDebt(_underlyingAssetAddress);
    }
    _userIndexes[user] = newUserIndex;

    emit BurnDebt(user, amount, previousBalance, currentBalance, balanceIncrease, newUserIndex);
  }
}

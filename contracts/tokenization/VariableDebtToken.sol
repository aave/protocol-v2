// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {Context} from '@openzeppelin/contracts/GSN/Context.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {DebtTokenBase} from './base/DebtTokenBase.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {IVariableDebtToken} from './interfaces/IVariableDebtToken.sol';

/**
 * @title contract VariableDebtToken
 * @notice Implements a variable debt token to track the user positions
 * @author Aave
 **/
contract VariableDebtToken is DebtTokenBase, IVariableDebtToken {
  using WadRayMath for uint256;

  uint256 public constant DEBT_TOKEN_REVISION = 0x1;

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
   * @dev calculates the accumulated debt balance of the user
   * @return the debt balance of the user
   **/
  function balanceOf(address user) public virtual override view returns (uint256) {
    uint256 scaledBalance = super.balanceOf(user);

    if (scaledBalance == 0) {
      return 0;
    }

    return scaledBalance.rayMul(POOL.getReserveNormalizedVariableDebt(UNDERLYING_ASSET));
  }

  /**
   * @dev mints new variable debt
   * @param user the user receiving the debt
   * @param amount the amount of debt being minted
   * @param index the variable debt index of the reserve
   **/
  function mint(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    
    _mint(user, amount.rayDiv(index));

    emit Transfer(address(0), user, amount);
    emit Mint(user, amount, index);
  }

  /**
   * @dev burns user variable debt
   * @param user the user which debt is burnt
   * @param index the variable debt index of the reserve
   **/
  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    _burn(user, amount.rayDiv(index));

    emit Transfer(user, address(0), amount);
    emit Burn(user, amount, index);
  }

  /**
   * @dev Returns the principal debt balance of the user from
   * @return The debt balance of the user since the last burn/mint action
   **/
  function scaledBalanceOf(address user) public virtual override view returns (uint256) {
    return super.balanceOf(user);
  }

  /**
   * @dev Returns the total supply of the variable debt token. Represents the total debt accrued by the users
   * @return the total supply
   **/
  function totalSupply() public virtual override view returns (uint256) {
    return super.totalSupply().rayMul(POOL.getReserveNormalizedVariableDebt(UNDERLYING_ASSET));
  }

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(borrows/index)
   * @return the scaled total supply
   **/
  function scaledTotalSupply() public virtual override view returns (uint256) {
    return super.totalSupply();
  }

    /**
   * @dev returns the principal balance of the user and principal total supply.
   * @param user the address of the user
   * @return the principal balance of the user
   * @return the principal total supply
   **/
  function getScaledUserBalanceAndSupply(address user) external override view returns (uint256, uint256){
    return (super.balanceOf(user), super.totalSupply());
  }

}

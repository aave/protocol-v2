// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IVariableDebtToken} from '../../../interfaces/IVariableDebtToken.sol';
import {WadRayMath} from '../../libraries/math/WadRayMath.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {DebtTokenBase} from '../base/DebtTokenBase.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';

/*
  AMPL specific AmplVariableDebtToken implementation.
  The AmplAmplVariableDebtToken doesn't alter any logic but performs some additional book-keeping.

  On mint and burn a private variable `_totalGonsBorrowed` keeps track of
    the scaled AMPL principal borrowed.

  * fetchAMPLBorrowData() returns the total AMPL borrowed and the total scaled AMPL borrowed
  * fetchGonsPerAMPL() fetches AMPL's supply scaling factor
*/
contract AmplVariableDebtToken is DebtTokenBase, IVariableDebtToken {
  using WadRayMath for uint256;

  uint256 public constant DEBT_TOKEN_REVISION = 0x1;

  // ---------------------------------------------------------------------------
  // aAMPL additions
  // This is a constant on the AMPL contract, which is used to calculate the scalar
  // which controls the AMPL expansion/contraction.
  // TOTAL_GONS/ampl.scaledTotalSupply, saving an external call to the AMPL contract
  // and setting it as a local contract constant.
  // NOTE: This should line up EXACTLY with the value on the AMPL contract
  uint256 private constant GONS_TOTAL_SUPPLY = uint256(type(int128).max);

  // Keeps track of the 'gons' borrowed from the aave system
  uint256 private _totalGonsBorrowed;
  // ---------------------------------------------------------------------------

  constructor(
    address pool,
    address underlyingAsset,
    string memory name,
    string memory symbol,
    address incentivesController
  ) public DebtTokenBase(pool, underlyingAsset, name, symbol, incentivesController) {}

  /**
   * @dev Gets the revision of the stable debt token implementation
   * @return The debt token implementation revision
   **/
  function getRevision() internal pure virtual override returns (uint256) {
    return DEBT_TOKEN_REVISION;
  }

  /**
   * @dev Calculates the accumulated debt balance of the user
   * @return The debt balance of the user
   **/
  function balanceOf(address user) public view virtual override returns (uint256) {
    uint256 scaledBalance = super.balanceOf(user);

    if (scaledBalance == 0) {
      return 0;
    }

    return scaledBalance.rayMul(POOL.getReserveNormalizedVariableDebt(UNDERLYING_ASSET_ADDRESS));
  }

  /**
   * @dev Mints debt token to the `onBehalfOf` address
   * -  Only callable by the LendingPool
   * @param user The address receiving the borrowed underlying, being the delegatee in case
   * of credit delegate, or same as `onBehalfOf` otherwise
   * @param onBehalfOf The address receiving the debt tokens
   * @param amount The amount of debt being minted
   * @param index The variable debt index of the reserve
   * @return `true` if the the previous balance of the user is 0
   **/
  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool returns (bool) {
    if (user != onBehalfOf) {
      _decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    uint256 previousBalance = super.balanceOf(onBehalfOf);
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    _mint(onBehalfOf, amountScaled);

    // NOTE: this additional book keeping to keep track of 'unborrowed' AMPLs
    _totalGonsBorrowed = _totalGonsBorrowed.add(amountScaled.mul(fetchGonsPerAMPL()));

    emit Transfer(address(0), onBehalfOf, amount);
    emit Mint(user, onBehalfOf, amount, index);

    return previousBalance == 0;
  }

  /**
   * @dev Burns user variable debt
   * - Only callable by the LendingPool
   * @param user The user whose debt is getting burned
   * @param amount The amount getting burned
   * @param index The variable debt index of the reserve
   **/
  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);

    _burn(user, amountScaled);

    // NOTE: this additional book keeping to keep track of 'unborrowed' AMPLs
    _totalGonsBorrowed = _totalGonsBorrowed.sub(amountScaled.mul(fetchGonsPerAMPL()));

    emit Transfer(user, address(0), amount);
    emit Burn(user, amount, index);
  }

  /**
   * @dev Returns the principal debt balance of the user from
   * @return The debt balance of the user since the last burn/mint action
   **/
  function scaledBalanceOf(address user) public view virtual override returns (uint256) {
    return super.balanceOf(user);
  }

  /**
   * @dev Returns the total supply of the variable debt token. Represents the total debt accrued by the users
   * @return The total supply
   **/
  function totalSupply() public view virtual override returns (uint256) {
    return
      super.totalSupply().rayMul(POOL.getReserveNormalizedVariableDebt(UNDERLYING_ASSET_ADDRESS));
  }

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
   * @return the scaled total supply
   **/
  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  /**
   * @dev Returns the principal balance of the user and principal total supply.
   * @param user The address of the user
   * @return The principal balance of the user
   * @return The principal total supply
   **/
  function getScaledUserBalanceAndSupply(address user)
    external
    view
    override
    returns (uint256, uint256)
  {
    return (super.balanceOf(user), super.totalSupply());
  }

  // ---------------------------------------------------------------------------
  // Custom methods for aAMPL

  function getAMPLBorrowData() external view returns (uint256, uint256) {
    return (super.totalSupply(), _totalGonsBorrowed);
  }

  function fetchGonsPerAMPL() internal view returns (uint256) {
    return GONS_TOTAL_SUPPLY.div(IERC20(UNDERLYING_ASSET_ADDRESS).totalSupply());
  }
}

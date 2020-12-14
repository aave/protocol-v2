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

  On mint and burn a private variable `_totalScaledAMPLSupply` keeps track of
    the scaled AMPL principal borrowed.

  * getAMPLBorrowData() returns the total AMPL borrowed and the total scaled AMPL borrowed
  * getAMPLScalar() fetches AMPL's supply scaling factor
*/
contract AmplVariableDebtToken is DebtTokenBase, IVariableDebtToken {
  using WadRayMath for uint256;

  uint256 public constant DEBT_TOKEN_REVISION = 0x1;

  // AMPL constants
  uint256 private constant MAX_UINT256 = ~uint256(0); // (2^256) - 1
  uint256 private constant AMPL_DECIMALS = 9;
  uint256 private constant INITIAL_AMPL_SUPPLY = 50 * 10**6 * 10**AMPL_DECIMALS;
  uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_AMPL_SUPPLY);

  // ampl scaled supply
  uint256 private _totalScaledAMPLSupply;

  constructor(
    address pool,
    address underlyingAsset,
    string memory name,
    string memory symbol,
    address incentivesController
  ) public DebtTokenBase(pool, underlyingAsset, name, symbol, incentivesController) {}

  function getRevision() internal pure virtual override returns (uint256) {
    return DEBT_TOKEN_REVISION;
  }

  function balanceOf(address user) public view virtual override returns (uint256) {
    uint256 scaledBalance = super.balanceOf(user);

    if (scaledBalance == 0) {
      return 0;
    }

    return scaledBalance.rayMul(POOL.getReserveNormalizedVariableDebt(UNDERLYING_ASSET_ADDRESS));
  }

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
    _totalScaledAMPLSupply = _totalScaledAMPLSupply.add(amountScaled.mul(getAMPLScalar()));

    emit Transfer(address(0), onBehalfOf, amount);
    emit Mint(user, onBehalfOf, amount, index);

    return previousBalance == 0;
  }


  function burn(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);

    _burn(user, amountScaled);

    // NOTE: this additional book keeping to keep track of 'unborrowed' AMPLs
    _totalScaledAMPLSupply = _totalScaledAMPLSupply.sub(amountScaled.mul(getAMPLScalar()));

    emit Transfer(user, address(0), amount);
    emit Burn(user, amount, index);
  }


  function scaledBalanceOf(address user) public view virtual override returns (uint256) {
    return super.balanceOf(user);
  }

  function totalSupply() public view virtual override returns (uint256) {
    return
      super.totalSupply().rayMul(POOL.getReserveNormalizedVariableDebt(UNDERLYING_ASSET_ADDRESS));
  }

  function scaledTotalSupply() public view virtual override returns (uint256) {
    return super.totalSupply();
  }

  function getScaledUserBalanceAndSupply(address user)
    external
    view
    override
    returns (uint256, uint256)
  {
    return (super.balanceOf(user), super.totalSupply());
  }

  // returns the scaledTotalSupply and the scaledTotalScaledAMPLSupply
  function getAMPLBorrowData() external view returns (uint256, uint256) {
    return (super.totalSupply(), _totalScaledAMPLSupply);
  }

  function getAMPLScalar() internal view returns (uint256) {
    return TOTAL_GONS.div(IERC20(UNDERLYING_ASSET_ADDRESS).totalSupply());
  }
}

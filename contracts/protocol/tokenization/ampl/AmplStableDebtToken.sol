// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {DebtTokenBase} from '../base/DebtTokenBase.sol';
import {MathUtils} from '../../libraries/math/MathUtils.sol';
import {WadRayMath} from '../../libraries/math/WadRayMath.sol';
import {IStableDebtToken} from '../../../interfaces/IStableDebtToken.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';

/*

  AMPL specific StableDebtToken implementation.
  The AmplStableDebtToken doesn't alter any logic but performs some additional book-keeping.

  On mint and burn a private variable `_totalScaledAMPLSupply` keeps track of
    the scaled AMPL principal borrowed.

  * getAMPLBorrowData() returns the total AMPL borrowed and the total scaled AMPL borrowed
  * getAMPLScalar() fetches AMPL's supply scaling factor

*/
contract AmplStableDebtToken is IStableDebtToken, DebtTokenBase {
  using WadRayMath for uint256;

  uint256 public constant DEBT_TOKEN_REVISION = 0x1;

  // AMPL constants
  uint256 private constant MAX_UINT256 = ~uint256(0); // (2^256) - 1
  uint256 private constant AMPL_DECIMALS = 9;
  uint256 private constant INITIAL_AMPL_SUPPLY = 50 * 10**6 * 10**AMPL_DECIMALS;
  uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_AMPL_SUPPLY);

  // ampl scaled supply
  uint256 private _totalScaledAMPLSupply;

  uint256 internal _avgStableRate;
  mapping(address => uint40) internal _timestamps;
  mapping(address => uint256) internal _usersStableRate;
  uint40 internal _totalSupplyTimestamp;

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

  function getAverageStableRate() external view virtual override returns (uint256) {
    return _avgStableRate;
  }

  function getUserLastUpdated(address user) external view virtual override returns (uint40) {
    return _timestamps[user];
  }

  function getUserStableRate(address user) external view virtual override returns (uint256) {
    return _usersStableRate[user];
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    uint256 accountBalance = super.balanceOf(account);
    uint256 stableRate = _usersStableRate[account];
    if (accountBalance == 0) {
      return 0;
    }
    uint256 cumulatedInterest =
      MathUtils.calculateCompoundedInterest(stableRate, _timestamps[account]);
    return accountBalance.rayMul(cumulatedInterest);
  }

  struct MintLocalVars {
    uint256 previousSupply;
    uint256 nextSupply;
    uint256 amountInRay;
    uint256 newStableRate;
    uint256 currentAvgStableRate;
  }

  function mint(
    address user,
    address onBehalfOf,
    uint256 amount,
    uint256 rate
  ) external override onlyLendingPool returns (bool) {
    MintLocalVars memory vars;

    if (user != onBehalfOf) {
      _decreaseBorrowAllowance(onBehalfOf, user, amount);
    }

    (, uint256 currentBalance, uint256 balanceIncrease) = _calculateBalanceIncrease(onBehalfOf);

    vars.previousSupply = totalSupply();
    vars.currentAvgStableRate = _avgStableRate;
    vars.nextSupply = _totalSupply = vars.previousSupply.add(amount);

    vars.amountInRay = amount.wadToRay();

    vars.newStableRate = _usersStableRate[onBehalfOf]
      .rayMul(currentBalance.wadToRay())
      .add(vars.amountInRay.rayMul(rate))
      .rayDiv(currentBalance.add(amount).wadToRay());

    require(vars.newStableRate <= type(uint128).max, Errors.SDT_STABLE_DEBT_OVERFLOW);
    _usersStableRate[onBehalfOf] = vars.newStableRate;

    //solium-disable-next-line
    _totalSupplyTimestamp = _timestamps[onBehalfOf] = uint40(block.timestamp);

    // Calculates the updated average stable rate
    vars.currentAvgStableRate = _avgStableRate = vars
      .currentAvgStableRate
      .rayMul(vars.previousSupply.wadToRay())
      .add(rate.rayMul(vars.amountInRay))
      .rayDiv(vars.nextSupply.wadToRay());

    _mint(onBehalfOf, amount.add(balanceIncrease), vars.previousSupply);

    emit Transfer(address(0), onBehalfOf, amount);

    emit Mint(
      user,
      onBehalfOf,
      amount,
      currentBalance,
      balanceIncrease,
      vars.newStableRate,
      vars.currentAvgStableRate,
      vars.nextSupply
    );

    return currentBalance == 0;
  }


  function burn(address user, uint256 amount) external override onlyLendingPool {
    (, uint256 currentBalance, uint256 balanceIncrease) = _calculateBalanceIncrease(user);

    uint256 previousSupply = totalSupply();
    uint256 newAvgStableRate = 0;
    uint256 nextSupply = 0;
    uint256 userStableRate = _usersStableRate[user];

    // Since the total supply and each single user debt accrue separately,
    // there might be accumulation errors so that the last borrower repaying
    // mght actually try to repay more than the available debt supply.
    // In this case we simply set the total supply and the avg stable rate to 0
    if (previousSupply <= amount) {
      _avgStableRate = 0;
      _totalSupply = 0;
    } else {
      nextSupply = _totalSupply = previousSupply.sub(amount);
      uint256 firstTerm = _avgStableRate.rayMul(previousSupply.wadToRay());
      uint256 secondTerm = userStableRate.rayMul(amount.wadToRay());

      // For the same reason described above, when the last user is repaying it might
      // happen that user rate * user balance > avg rate * total supply. In that case,
      // we simply set the avg rate to 0
      if (secondTerm >= firstTerm) {
        newAvgStableRate = _avgStableRate = _totalSupply = 0;
      } else {
        newAvgStableRate = _avgStableRate = firstTerm.sub(secondTerm).rayDiv(nextSupply.wadToRay());
      }
    }

    if (amount == currentBalance) {
      _usersStableRate[user] = 0;
      _timestamps[user] = 0;
    } else {
      //solium-disable-next-line
      _timestamps[user] = uint40(block.timestamp);
    }
    //solium-disable-next-line
    _totalSupplyTimestamp = uint40(block.timestamp);

    if (balanceIncrease > amount) {
      uint256 amountToMint = balanceIncrease.sub(amount);
      _mint(user, amountToMint, previousSupply);
      emit Mint(
        user,
        user,
        amountToMint,
        currentBalance,
        balanceIncrease,
        userStableRate,
        newAvgStableRate,
        nextSupply
      );
    } else {
      uint256 amountToBurn = amount.sub(balanceIncrease);
      _burn(user, amountToBurn, previousSupply);
      emit Burn(user, amountToBurn, currentBalance, balanceIncrease, newAvgStableRate, nextSupply);
    }

    emit Transfer(user, address(0), amount);
  }

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


  function getSupplyData()
    public
    view
    override
    returns (
      uint256,
      uint256,
      uint256,
      uint40
    )
  {
    uint256 avgRate = _avgStableRate;
    return (super.totalSupply(), _calcTotalSupply(avgRate), avgRate, _totalSupplyTimestamp);
  }


  function getTotalSupplyAndAvgRate() public view override returns (uint256, uint256) {
    uint256 avgRate = _avgStableRate;
    return (_calcTotalSupply(avgRate), avgRate);
  }


  function totalSupply() public view override returns (uint256) {
    return _calcTotalSupply(_avgStableRate);
  }


  function getTotalSupplyLastUpdated() public view override returns (uint40) {
    return _totalSupplyTimestamp;
  }


  function principalBalanceOf(address user) external view virtual override returns (uint256) {
    return super.balanceOf(user);
  }


  function _calcTotalSupply(uint256 avgRate) internal view virtual returns (uint256) {
    uint256 principalSupply = super.totalSupply();

    if (principalSupply == 0) {
      return 0;
    }

    uint256 cumulatedInterest =
      MathUtils.calculateCompoundedInterest(avgRate, _totalSupplyTimestamp);

    return principalSupply.rayMul(cumulatedInterest);
  }


  function _mint(
    address account,
    uint256 amount,
    uint256 oldTotalSupply
  ) internal {
    uint256 oldAccountBalance = _balances[account];
    _balances[account] = oldAccountBalance.add(amount);

    // NOTE: this additional book keeping to keep track of 'unborrowed' AMPLs
    _totalScaledAMPLSupply = _totalScaledAMPLSupply.add(amount.mul(getAMPLScalar()));

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _burn(
    address account,
    uint256 amount,
    uint256 oldTotalSupply
  ) internal {
    uint256 oldAccountBalance = _balances[account];
    _balances[account] = oldAccountBalance.sub(amount, Errors.SDT_BURN_EXCEEDS_BALANCE);

    // NOTE: this additional book keeping to keep track of 'unborrowed' AMPLs
    _totalScaledAMPLSupply = _totalScaledAMPLSupply.sub(amount.mul(getAMPLScalar()));

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  // returns the scaledTotalSupply and the scaledTotalScaledAMPLSupply
  function getAMPLBorrowData() external view returns (uint256, uint256) {
    return (super.totalSupply(), _totalScaledAMPLSupply);
  }

  function getAMPLScalar() internal view returns (uint256) {
    return TOTAL_GONS.div(IERC20(UNDERLYING_ASSET_ADDRESS).totalSupply());
  }
}

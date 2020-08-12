pragma solidity ^0.6.0;

import {Context} from '@openzeppelin/contracts/GSN/Context.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {DebtTokenBase} from './base/DebtTokenBase.sol';
import {MathUtils} from '../libraries/MathUtils.sol';
import {WadRayMath} from '../libraries/WadRayMath.sol';
import {IStableDebtToken} from './interfaces/IStableDebtToken.sol';

/**
 * @title contract StableDebtToken
 *
 * @notice defines the interface for the stable debt token
 *
 * @dev it does not inherit from IERC20 to save in code size
 *
 * @author Aave
 *
 **/
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

  /**
   * @dev emitted when new stable debt is minted
   * @param _user the address of the user
   * @param _amount the amount minted
   * @param _previousBalance the previous balance of the user
   * @param _currentBalance the current balance of the user
   * @param _balanceIncrease the debt increase since the last update
   * @param _newRate the rate of the debt after the minting
   **/
  event mintDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease,
    uint256 _newRate
  );

  /**
   * @dev emitted when new stable debt is burned
   * @param _user the address of the user
   * @param _amount the amount minted
   * @param _previousBalance the previous balance of the user
   * @param _currentBalance the current balance of the user
   * @param _balanceIncrease the debt increase since the last update
   **/
  event burnDebt(
    address _user,
    uint256 _amount,
    uint256 _previousBalance,
    uint256 _currentBalance,
    uint256 _balanceIncrease
  );

  constructor(address _pool, address _underlyingAsset)
    public
    DebtTokenBase(_pool, _underlyingAsset)
  {}

  /**
   * @dev returns the average stable rate across all the stable rate debt
   * @return the average stable rate
   **/
  function getAverageStableRate() external virtual override view returns (uint256) {
    return avgStableRate;
  }

  /**
   * @dev returns the timestamp of the last user action
   * @return the last update timestamp
   **/
  function getUserLastUpdated(address _user) external virtual override view returns (uint40) {
    return usersData[_user].lastUpdateTimestamp;
  }

  /**
   * @dev returns the stable rate of the user
   * @param _user the address of the user
   * @return the stable rate of _user
   **/
  function getUserStableRate(address _user) external virtual override view returns (uint256) {
    return usersData[_user].currentRate;
  }

  /**
   * @dev calculates the current user debt balance
   * @return the accumulated debt of the user
   **/
  function balanceOf(address account) public virtual override view returns (uint256) {
    if (balances[account] == 0) {
      return 0;
    }

    UserData storage userData = usersData[account];

    uint256 cumulatedInterest = MathUtils.calculateCompoundedInterest(
      userData.currentRate,
      userData.lastUpdateTimestamp
    );
    return balances[account].wadToRay().rayMul(cumulatedInterest).rayToWad();
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
   * @param _user the address of the user
   * @param _amount the amount of debt tokens to mint
   * @param _rate the rate of the debt being minted.
   **/
  function mint(
    address _user,
    uint256 _amount,
    uint256 _rate
  ) public override onlyLendingPool {
    MintLocalVars memory vars;

    //cumulates the user debt
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(_user);

    vars.supplyBeforeMint = totalSupply.add(balanceIncrease);
    vars.supplyAfterMint = vars.supplyBeforeMint.add(_amount);

    vars.amountInRay = _amount.wadToRay();

    //calculates the new stable rate for the user
    vars.newStableRate = usersData[_user]
      .currentRate
      .rayMul(currentBalance.wadToRay())
      .add(vars.amountInRay.rayMul(_rate))
      .rayDiv(currentBalance.add(_amount).wadToRay());

    usersData[_user].currentRate = vars.newStableRate;

    //solium-disable-next-line
    usersData[_user].lastUpdateTimestamp = uint40(block.timestamp);

    //calculates the updated average stable rate
    avgStableRate = avgStableRate
      .rayMul(vars.supplyBeforeMint.wadToRay())
      .add(_rate.rayMul(vars.amountInRay))
      .rayDiv(vars.supplyAfterMint.wadToRay());

    _mint(_user, _amount.add(balanceIncrease));

    emit mintDebt(
      _user,
      _amount,
      previousBalance,
      currentBalance,
      balanceIncrease,
      vars.newStableRate
    );
  }

  /**
   * @dev burns debt of the target user.
   * @param _user the address of the user
   * @param _amount the amount of debt tokens to mint
   **/
  function burn(address _user, uint256 _amount) public override onlyLendingPool {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateCumulatedBalance(_user);

    uint256 supplyBeforeBurn = totalSupply.add(balanceIncrease);
    uint256 supplyAfterBurn = supplyBeforeBurn.sub(_amount);

    uint256 newSupply = totalSupply.add(balanceIncrease).sub(_amount);

    uint256 amountInRay = _amount.wadToRay();

    if (newSupply == 0) {
      avgStableRate = 0;
    } else {
      avgStableRate = avgStableRate
        .rayMul(supplyBeforeBurn.wadToRay())
        .sub(usersData[_user].currentRate.rayMul(amountInRay))
        .rayDiv(supplyAfterBurn.wadToRay());
    }

    if (_amount == currentBalance) {
      usersData[_user].currentRate = 0;
      usersData[_user].lastUpdateTimestamp = 0;
    }

    if (balanceIncrease > _amount) {
      _mint(_user, balanceIncrease.sub(_amount));
    } else {
      _burn(_user, _amount.sub(balanceIncrease));
    }

    emit burnDebt(_user, _amount, previousBalance, currentBalance, balanceIncrease);
  }

  /**
   * @dev calculates the increase in balance since the last user action
   * @param _user the address of the user for which the interest is being accumulated
   * @return the previous principal balance, the new principal balance, the balance increase
   **/
  function _calculateBalanceIncrease(address _user)
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

    return (
      previousPrincipalBalance,
      previousPrincipalBalance.add(balanceIncrease),
      balanceIncrease
    );
  }
}

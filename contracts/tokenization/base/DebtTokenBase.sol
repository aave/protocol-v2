// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {Context} from '@openzeppelin/contracts/GSN/Context.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {
  VersionedInitializable
} from '../../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {IERC20Detailed} from '../../interfaces/IERC20Detailed.sol';

/**
 * @title contract DebtTokenBase
 * @author Aave
 * @notice base contract for StableDebtToken and VariableDebtToken
 */

abstract contract DebtTokenBase is IERC20Detailed, VersionedInitializable {
  using SafeMath for uint256;

  uint256 internal _totalSupply;

  string internal _name;
  string internal _symbol;
  uint8 internal _decimals;
  address internal immutable _underlyingAssetAddress;

  ILendingPool internal immutable _pool;
  mapping(address => uint256) internal _balances;

  /**
   * @dev only lending pool can call functions marked by this modifier
   **/
  modifier onlyLendingPool {
    require(msg.sender == address(_pool), 'The caller of this function must be a lending pool');
    _;
  }

  constructor(
    address pool,
    address underlyingAssetAddress,
    string memory name,
    string memory symbol
  ) public {
    _pool = ILendingPool(pool);
    _underlyingAssetAddress = underlyingAssetAddress;
    _name = name;
    _symbol = symbol;
  }

  /**
   * @dev initializes the debt token.
   * @param name the name of the token
   * @param symbol the symbol of the token
   * @param decimals the decimals of the token
   */
  function initialize(
    uint8 decimals,
    string memory name,
    string memory symbol
  ) public initializer {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
  }

  function name() public override view returns (string memory) {
    return _name;
  }

  function symbol() public override view returns (string memory) {
    return _symbol;
  }

  function decimals() public override view returns (uint8) {
    return _decimals;
  }

  function totalSupply() public override view returns (uint256) {
    return _totalSupply;
  }

  function underlyingAssetAddress() public view returns (address) {
    return _underlyingAssetAddress;
  }

  /**
   * @dev calculates the accumulated debt balance of the user
   * @return the debt balance of the user
   **/
  function balanceOf(address user) public virtual override view returns (uint256);

  /**
   * @dev returns the principal debt balance of the user from
   * @return the debt balance of the user since the last burn/mint action
   **/
  function principalBalanceOf(address user) public view returns (uint256) {
    return _balances[user];
  }

  /**
   * @dev basic accounting for the mint action
   * @dev _user the target user of the minting action
   * @dev _amount the amount to mint
   **/
  function _mint(address user, uint256 amount) internal {
    _totalSupply = _totalSupply.add(amount);
    _balances[user] = _balances[user].add(amount);
  }

  /**
   * @dev basic accounting for the burn action
   * @dev _user the target user of the burning action
   * @dev _amount the amount to burn
   **/
  function _burn(address user, uint256 amount) internal {
    _totalSupply = _totalSupply.sub(amount);
    _balances[user] = _balances[user].sub(amount);
  }

  /**
   * @dev being non transferrable, the debt token does not implement any of the
   * standard ERC20 functions for transfer and allowance.
   **/
  function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function allowance(address owner, address spender)
    external
    virtual
    override
    view
    returns (uint256)
  {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function approve(address spender, uint256 amount) external virtual override returns (bool) {
    revert('APPROVAL_NOT_SUPPORTED');
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external virtual override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function increaseAllowance(address spender, uint256 addedValue) external virtual returns (bool) {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function decreaseAllowance(address spender, uint256 subtractedValue)
    external
    virtual
    returns (bool)
  {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  /**
   * @dev calculates the increase in balance since the last user interaction
   * @param user the address of the user for which the interest is being accumulated
   * @return the previous principal balance, the new principal balance, the balance increase
   * and the new user index
   **/
  function _calculateBalanceIncrease(address user)
    internal
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    uint256 previousPrincipalBalance = _balances[user];

    if (previousPrincipalBalance == 0) {
      return (0, 0, 0);
    }

    //calculate the accrued interest since the last accumulation
    uint256 balanceIncrease = balanceOf(user).sub(previousPrincipalBalance);

    return (
      previousPrincipalBalance,
      previousPrincipalBalance.add(balanceIncrease),
      balanceIncrease
    );
  }
}

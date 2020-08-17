pragma solidity ^0.6.0;

import {Context} from '@openzeppelin/contracts/GSN/Context.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {SafeMath} from '@openzeppelin/contracts/math/SafeMath.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {LendingPool} from '../../lendingpool/LendingPool.sol';
import {VersionedInitializable} from '../../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';

/**
 * @title contract DebtTokenBase
 * @author Aave
 * @notice base contract for StableDebtToken and VariableDebtToken
 */

abstract contract DebtTokenBase is IERC20, VersionedInitializable {
  using SafeMath for uint256;
  using Address for address;

  uint256 public override totalSupply;

  string public name;
  string public symbol;
  uint8 public decimals;
  address public immutable underlyingAssetAddress;

  LendingPool internal immutable pool;
  mapping(address => uint256) internal balances;

  /**
   * @dev only lending pool can call functions marked by this modifier
   **/
  modifier onlyLendingPool {
    require(msg.sender == address(pool), 'The caller of this function must be a lending pool');
    _;
  }

  constructor(address _pool, address _underlyingAssetAddress) public {
    pool = LendingPool(payable(_pool));
    underlyingAssetAddress = _underlyingAssetAddress; 
  }
  /**
   * @dev initializes the debt token.
   * @param _name the name of the token
   * @param _symbol the symbol of the token
   * @param _decimals the decimals of the token
   */
  function initialize(
    uint8 _decimals,
    string memory _name,
    string memory _symbol
  ) public initializer {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
  }

  /**
   * @dev calculates the accumulated debt balance of the user
   * @return the debt balance of the user
   **/
  function balanceOf(address _user) public virtual override view returns (uint256);

  /**
   * @dev returns the principal debt balance of the user from
   * @return the debt balance of the user since the last burn/mint action
   **/
  function principalBalanceOf(address _user) public view returns (uint256) {
    return balances[_user];
  }

  /**
   * @dev basic accounting for the mint action
   * @dev _user the target user of the minting action
   * @dev _amount the amount to mint
   **/
  function _mint(address _user, uint256 _amount) internal {
    totalSupply = totalSupply.add(_amount);
    balances[_user] = balances[_user].add(_amount);
  }

  /**
   * @dev basic accounting for the burn action
   * @dev _user the target user of the burning action
   * @dev _amount the amount to burn
   **/
  function _burn(address _user, uint256 _amount) internal {
    totalSupply = totalSupply.sub(_amount);
    balances[_user] = balances[_user].sub(_amount);
  }

  /**
   * @dev being non transferrable, the debt token does not implement any of the
   * standard ERC20 functions for transfer and allowance.
   **/
  function transfer(address recipient, uint256 _amount) public virtual override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function allowance(address owner, address spender)
    public
    virtual
    override
    view
    returns (uint256)
  {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function approve(address spender, uint256 _amount) public virtual override returns (bool) {
    revert('APPROVAL_NOT_SUPPORTED');
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 _amount
  ) public virtual override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function decreaseAllowance(address spender, uint256 subtractedValue)
    public
    virtual
    returns (bool)
  {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }
}

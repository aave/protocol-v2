pragma solidity ^0.6.0;

import '@openzeppelin/contracts/GSN/Context.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/Address.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {LendingPool} from '../../lendingpool/LendingPool.sol';


abstract contract DebtTokenBase is IERC20 {
  using SafeMath for uint256;
  using Address for address;

  uint256 public override totalSupply;

  string public name;
  string public symbol;
  uint8  public decimals;
  address public underlyingAssetAddress;

  LendingPool internal pool;
  mapping(address => uint256) internal balances;



      modifier onlyLendingPool {
        require(
            msg.sender == address(pool),
            "The caller of this function must be a lending pool"
        );
        _;
    }


  /**
   * @dev Sets the values for {name} and {symbol}, initializes {decimals} with
   * a default value of 18.
   *
   * To select a different value for {decimals}, use {_setupDecimals}.
   *
   * All three of these values are immutable: they can only be set once during
   * construction.
   */
  function init(
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    address _underlying,
    ILendingPoolAddressesProvider _addressesProvider
  ) public {
    name = _name;
    symbol = _symbol;
    decimals = _decimals;
    underlyingAssetAddress = _underlying;
    pool = LendingPool(payable(_addressesProvider.getLendingPool()));
  }


  /**
   * @dev See {IERC20-balanceOf}.
   */
  function balanceOf(address account) public virtual override view returns (uint256);


  /**
   * @dev See {IERC20-balanceOf}.
   */
  function principalBalanceOf(address account) public view returns (uint256) {
    return balances[account];
  }

  /**
   * @dev See {IERC20-transfer}.
   *
   * Requirements:
   *
   * - `recipient` cannot be the zero address.
   * - the caller must have a balance of at least `amount`.
   */
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  /**
   * @dev See {IERC20-allowance}.
   */
  function allowance(address owner, address spender)
    public
    virtual
    override
    view
    returns (uint256)
  {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  /**
   * @dev See {IERC20-approve}.
   *
   * Requirements:
   *
   * - `spender` cannot be the zero address.
   */
  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    revert('APPROVAL_NOT_SUPPORTED');
  }

  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    revert('TRANSFER_NOT_SUPPORTED');
  }

  /**
   * @dev Atomically increases the allowance granted to `spender` by the caller.
   *
   * This is an alternative to {approve} that can be used as a mitigation for
   * problems described in {IERC20-approve}.
   *
   * Emits an {Approval} event indicating the updated allowance.
   *
   * Requirements:
   *
   * - `spender` cannot be the zero address.
   */
  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  /**
   * @dev Atomically decreases the allowance granted to `spender` by the caller.
   *
   * This is an alternative to {approve} that can be used as a mitigation for
   * problems described in {IERC20-approve}.
   *
   * Emits an {Approval} event indicating the updated allowance.
   *
   * Requirements:
   *
   * - `spender` cannot be the zero address.
   * - `spender` must have allowance for the caller of at least
   * `subtractedValue`.
   */
  function decreaseAllowance(address spender, uint256 subtractedValue)
    public
    virtual
    returns (bool)
  {
    revert('ALLOWANCE_NOT_SUPPORTED');
  }

  function _mint(address account, uint256 amount) internal {
    totalSupply = totalSupply.add(amount);
    balances[account] = balances[account].add(amount);
  }

  function _burn(address account, uint256 amount) internal {
    totalSupply = totalSupply.sub(amount);
    balances[account] = balances[account].sub(amount);
  }
}

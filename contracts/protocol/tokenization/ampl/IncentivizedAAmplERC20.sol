// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {Context} from '../../../dependencies/openzeppelin/contracts/Context.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {SafeMath} from '../../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IAaveIncentivesController} from '../../../interfaces/IAaveIncentivesController.sol';

// TODO: optimize external calls for AMPL scaling factor and reads
contract IncentivizedAAmplERC20 is Context, IERC20, IERC20Detailed {
  using SafeMath for uint256;

  IAaveIncentivesController internal immutable _incentivesController;

  mapping(address => uint256) private _balances;
  mapping(address => mapping(address => uint256)) private _allowances;

  uint256 internal _totalScaledAMPLDeposited;
  uint256 internal _totalSupply;

  string private _name;
  string private _symbol;
  uint8 private _decimals;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals,
    address incentivesController,
    address baseAsset
  ) public {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
    _incentivesController = IAaveIncentivesController(incentivesController);
  }

  /**
   * @return The name of the token
   **/
  function name() public view override returns (string memory) {
    return _name;
  }

  /**
   * @return The symbol of the token
   **/
  function symbol() public view override returns (string memory) {
    return _symbol;
  }

  /**
   * @return The decimals of the token
   **/
  function decimals() public view override returns (uint8) {
    return _decimals;
  }


  /**
   * @return The total supply of the token
   *
   *  totalSupply() = unborrowed + borrowed
   *                = (totalScaledAMPLDeposited - totalScaledAMPLBorrowed)/AMPL_SCALAR + totalAMPLBorrowed
   **/
  function totalSupply() public view virtual override returns (uint256) {
    uint256 totalAMPLBorrowed;
    uint256 totalScaledAMPLBorrowed;
    (totalAMPLBorrowed, totalScaledAMPLBorrowed) = getAMPLBorrowData();
    return _totalScaledAMPLDeposited.sub(totalScaledAMPLBorrowed).div(getAMPLScalar()).add(totalAMPLBorrowed);
  }

  /**
   * @return The external balance of the token
   *
   *  balanceOf(account) = account's share of (unborrowed + borrowed)
   *                     = _balances[account]/_totalSupply * totalSupply()
   **/
  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account].mul(totalSupply()).div(_totalSupply);
  }

  /**
   * @dev Executes a transfer of tokens from _msgSender() to recipient
   * @param recipient The recipient of the tokens
   * @param amount The amount of tokens being transferred
   * @return `true` if the transfer succeeds, `false` otherwise
   **/
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    emit Transfer(_msgSender(), recipient, amount);
    return true;
  }

  /**
   * @dev Returns the allowance of spender on the tokens owned by owner
   * @param owner The owner of the tokens
   * @param spender The user allowed to spend the owner's tokens
   * @return The amount of owner's tokens spender is allowed to spend
   **/
  function allowance(address owner, address spender)
    public
    view
    virtual
    override
    returns (uint256)
  {
    return _allowances[owner][spender];
  }

  /**
   * @dev Allows `spender` to spend the tokens owned by _msgSender()
   * @param spender The user allowed to spend _msgSender() tokens
   * @return `true`
   **/
  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    _approve(_msgSender(), spender, amount);
    return true;
  }

  /**
   * @dev Executes a transfer of token from sender to recipient, if _msgSender() is allowed to do so
   * @param sender The owner of the tokens
   * @param recipient The recipient of the tokens
   * @param amount The amount of tokens being transferred
   * @return `true` if the transfer succeeds, `false` otherwise
   **/
  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) public virtual override returns (bool) {
    _transfer(sender, recipient, amount);
    _approve(
      sender,
      _msgSender(),
      _allowances[sender][_msgSender()].sub(amount, 'AAmplERC20: transfer amount exceeds allowance')
    );
    emit Transfer(sender, recipient, amount);
    return true;
  }

  /**
   * @dev Increases the allowance of spender to spend _msgSender() tokens
   * @param spender The user allowed to spend on behalf of _msgSender()
   * @param addedValue The amount being added to the allowance
   * @return `true`
   **/
  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender].add(addedValue));
    return true;
  }

  /**
   * @dev Decreases the allowance of spender to spend _msgSender() tokens
   * @param spender The user allowed to spend on behalf of _msgSender()
   * @param subtractedValue The amount being subtracted to the allowance
   * @return `true`
   **/
  function decreaseAllowance(address spender, uint256 subtractedValue)
    public
    virtual
    returns (bool)
  {
    _approve(
      _msgSender(),
      spender,
      _allowances[_msgSender()][spender].sub(
        subtractedValue,
        'AAmplERC20: decreased allowance below zero'
      )
    );
    return true;
  }

  /*
    wkt, amount = _transferAmount/_totalSupply * totalSupply()

    internal transfer amount for book-keeping is calculated as:
    _transferAmount = (amount * _totalSupply) / totalSupply()

    _balances[sender] -= _transferAmount
    _balances[recipient] += _transferAmount
  */
  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), 'AAmplERC20: transfer from the zero address');
    require(recipient != address(0), 'AAmplERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);

    uint256 currentTotalSupply = totalSupply();
    uint256 oldSenderBalance = balanceOf(sender);
    uint256 oldRecipientBalance = balanceOf(recipient);

    uint256 _transferAmount = amount.mul(_totalSupply).div(currentTotalSupply);
    _balances[sender] = _balances[sender].sub(_transferAmount, 'AAmplERC20: transfer amount exceeds balance');
    _balances[recipient] = _balances[recipient].add(_transferAmount);

    if(address(_incentivesController) != address(0)) {
      _incentivesController.handleAction(sender, currentTotalSupply, oldSenderBalance);
      if (sender != recipient) {
        _incentivesController.handleAction(recipient, currentTotalSupply, oldRecipientBalance);
      }
    }
  }


  /*
    Before 'amount' is mint to account wkt,

    _balances[account] / _totalSupply = balanceOf(account) / totalSupply()

    We calculate _mintAmount such that the following holds true

    (_balances[account] + _mintAmount) / (_totalSupply + _mintAmount)
      = (balanceOf(account) + amount)/ (totalSupply() + amount)

    newTotalSupply = totalSupply() + amount
    newAccountBalance = balanceOf(account) + amount
    remainingAccountBalance = totalSupply() - balanceOf(account)

    Thus:
    => _mintAmount = (_totalSupply * newAccountBalance) - (_balances[account] * newTotalSupply) / remainingAccountBalance
  */
  function _mint(address account, uint256 amount) internal virtual {
    require(account != address(0), 'AAmplERC20: mint to the zero address');

    _beforeTokenTransfer(address(0), account, amount);

    uint256 oldTotalSupply = totalSupply();
    uint256 oldAccountBalance = balanceOf(account);
    uint256 oldRemainingAccountBalance = oldTotalSupply.sub(oldAccountBalance);

    uint256 _oldAccountBalance = _balances[account];
    uint256 _oldTotalSupply = _totalSupply;

    uint256 newTotalSupply = oldTotalSupply.add(amount);
    uint256 newAccountBalance = oldAccountBalance.add(amount);

    uint256 _mintAmount = _oldTotalSupply
      .mul(newAccountBalance)
      .sub(_oldAccountBalance.mul(newTotalSupply))
      .div(oldRemainingAccountBalance);

    _totalSupply = _totalSupply.add(_mintAmount);
    _balances[account] = _oldAccountBalance.add(_mintAmount);

    // NOTE: this additional book keeping to keep track of 'unborrowed' AMPLs
    _totalScaledAMPLDeposited = _totalScaledAMPLDeposited.add(amount.mul(getAMPLScalar()));

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }


  /*
    Calculated same as above:
    => _burnAmount = (_balances[account] * newTotalSupply) - (_totalSupply * newAccountBalance) / remainingAccountBalance
  */
  function _burn(address account, uint256 amount) internal virtual {
    require(account != address(0), 'AAmplERC20: burn from the zero address');

    _beforeTokenTransfer(account, address(0), amount);

    uint256 oldTotalSupply = totalSupply();
    uint256 oldAccountBalance = balanceOf(account);
    uint256 oldRemainingAccountBalance = oldTotalSupply.sub(oldAccountBalance);

    uint256 _oldAccountBalance = _balances[account];
    uint256 _oldTotalSupply = _totalSupply;

    uint256 newTotalSupply = oldTotalSupply.sub(amount);
    uint256 newAccountBalance = oldAccountBalance.sub(amount);

    uint256 burnAmount = _oldAccountBalance
      .mul(newTotalSupply)
      .sub(_oldTotalSupply.mul(newAccountBalance))
      .div(oldRemainingAccountBalance);

    _totalSupply = _totalSupply.sub(burnAmount);
    _balances[account] = _oldAccountBalance.sub(burnAmount, 'AAmplERC20: burn amount exceeds balance');

    // NOTE: this additional book keeping to keep track of 'unborrowed' AMPLs
    _totalScaledAMPLDeposited = _totalScaledAMPLDeposited.sub(amount.mul(getAMPLScalar()));

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), 'AAmplERC20: approve from the zero address');
    require(spender != address(0), 'AAmplERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  function _setName(string memory newName) internal {
    _name = newName;
  }

  function _setSymbol(string memory newSymbol) internal {
    _symbol = newSymbol;
  }

  function _setDecimals(uint8 newDecimals) internal {
    _decimals = newDecimals;
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual {}

  /**
   * @return The scalar balance multiple
   **/
  function getAMPLBorrowData() internal virtual view returns (uint256, uint256) { }
  function getAMPLScalar() internal virtual view returns (uint256) { }
}

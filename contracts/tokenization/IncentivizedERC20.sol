// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.8;

import {Context} from '../misc/Context.sol';
import {IERC20} from '../interfaces/IERC20.sol';
import {IERC20Detailed} from '../interfaces/IERC20Detailed.sol';
import {SafeMath} from '../libraries/math/SafeMath.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';

/**
 * @title ERC20
 * @notice Basic ERC20 implementation
 * @author Aave, inspired by the Openzeppelin ERC20 implementation
 **/
contract IncentivizedERC20 is Context, IERC20, IERC20Detailed {
  using SafeMath for uint256;

  IAaveIncentivesController internal immutable _incentivesController;

  mapping(address => uint256) internal _balances;

  mapping(address => mapping(address => uint256)) private _allowances;
  uint256 internal _totalSupply;
  string private _name;
  string private _symbol;
  uint8 private _decimals;

  constructor(
    string memory name,
    string memory symbol,
    uint8 decimals,
    address incentivesController
  ) public {
    _name = name;
    _symbol = symbol;
    _decimals = decimals;
    _incentivesController = IAaveIncentivesController(incentivesController);
  }

  /**
   * @return the name of the token
   **/
  function name() public override view returns (string memory) {
    return _name;
  }

  /**
   * @return the symbol of the token
   **/
  function symbol() public override view returns (string memory) {
    return _symbol;
  }

  /**
   * @return the decimals of the token
   **/
  function decimals() public override view returns (uint8) {
    return _decimals;
  }

  /**
   * @return the total supply of the token
   **/
  function totalSupply() public virtual override view returns (uint256) {
    return _totalSupply;
  }

  /**
   * @return the balance of the token
   **/
  function balanceOf(address account) public virtual override view returns (uint256) {
    return _balances[account];
  }

  /**
   * @dev executes a transfer of tokens from msg.sender to recipient
   * @param recipient the recipient of the tokens
   * @param amount the amount of tokens being transferred
   * @return true if the transfer succeeds, false otherwise
   **/
  function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    emit Transfer(msg.sender, recipient, amount);
    return true;
  }

  /**
   * @dev returns the allowance of spender on the tokens owned by owner
   * @param owner the owner of the tokens
   * @param spender the user allowed to spend the owner's tokens
   * @return the amount of owner's tokens spender is allowed to spend
   **/
  function allowance(address owner, address spender)
    public
    virtual
    override
    view
    returns (uint256)
  {
    return _allowances[owner][spender];
  }

  /**
   * @dev allows spender to spend the tokens owned by msg.sender
   * @param spender the user allowed to spend msg.sender tokens
   * @return true
   **/
  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    _approve(_msgSender(), spender, amount);
    return true;
  }

  /**
   * @dev executes a transfer of token from sender to recipient, if msg.sender is allowed to do so
   * @param sender the owner of the tokens
   * @param recipient the recipient of the tokens
   * @param amount the amount of tokens being transferred
   * @return true if the transfer succeeds, false otherwise
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
      _allowances[sender][_msgSender()].sub(amount, 'ERC20: transfer amount exceeds allowance')
    );
    emit Transfer(sender, recipient, amount);
    return true;
  }

  /**
   * @dev increases the allowance of spender to spend msg.sender tokens
   * @param spender the user allowed to spend on behalf of msg.sender
   * @param addedValue the amount being added to the allowance
   * @return true
   **/
  function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender].add(addedValue));
    return true;
  }

  /**
   * @dev decreases the allowance of spender to spend msg.sender tokens
   * @param spender the user allowed to spend on behalf of msg.sender
   * @param subtractedValue the amount being subtracted to the allowance
   * @return true
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
        'ERC20: decreased allowance below zero'
      )
    );
    return true;
  }

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), 'ERC20: transfer from the zero address');
    require(recipient != address(0), 'ERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);

    uint256 oldSenderBalance = _balances[sender];
    _balances[sender] = oldSenderBalance.sub(amount, 'ERC20: transfer amount exceeds balance');
    uint256 oldRecipientBalance = _balances[recipient];
    _balances[recipient] = _balances[recipient].add(amount);

    if (address(_incentivesController) != address(0)) {
      uint256 totalSupply = _totalSupply;
      _incentivesController.handleAction(sender, totalSupply, oldSenderBalance);
      if (sender != recipient) {
        _incentivesController.handleAction(recipient, totalSupply, oldRecipientBalance);
      }
    }
  }

  function _mint(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ERC20: mint to the zero address');

    _beforeTokenTransfer(address(0), account, amount);

    uint256 oldTotalSupply = _totalSupply;
    _totalSupply = oldTotalSupply.add(amount);

    uint256 oldAccountBalance = _balances[account];
    _balances[account] = oldAccountBalance.add(amount);

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _burn(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ERC20: burn from the zero address');

    _beforeTokenTransfer(account, address(0), amount);

    uint256 oldTotalSupply = _totalSupply;
    _totalSupply = oldTotalSupply.sub(amount);

    uint256 oldAccountBalance = _balances[account];
    _balances[account] = oldAccountBalance.sub(amount, 'ERC20: burn amount exceeds balance');

    if (address(_incentivesController) != address(0)) {
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

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
}

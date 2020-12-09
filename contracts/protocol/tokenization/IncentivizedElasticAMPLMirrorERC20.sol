// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {Context} from '../../dependencies/openzeppelin/contracts/Context.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {IAaveIncentivesController} from '../../interfaces/IAaveIncentivesController.sol';

/**
 * @title IncentivizedElasticAMPLMirrorERC20
 * @notice Basic implementation of a Mirrored Elastic ERC20 token.
 * @dev It behaves similar to Aave's IncentivizedERC20, but is elastic (ie balances change).
 *      Elasticity is mirrored based on the AMPL ERC-20 token contract.
 *      The `ElasticAMPLMirrorERC20` balances expand and contract proportionally based on
 *      how the referenced AMPL token expands and contracts.
 *
 *      The AMPL token exhibits elastic balances by representing public balances using 2
 *      numbers. A hidden unit called gons and a scalar value called `gonsPerAMPL`.
 *      Public ampl balances are represented as the product of the hidden balance and the scalar.
 *        => public_balance = gon_balance * gonsPerAMPL
 *      Thus by changing the scalar up/down, all token balances are changed proportionally.
 *
 *      The `ElasticAMPLMirrorERC20` also uses 2 numbers to represent public balances similar to AMPL,
 *      a hidden 'internal balance' and a scalar multiple (`gonsPerAMPL`).
 *        => public_balance = internal_balance * gonsPerAMPL
 *      It 'mimics' the AMPL's elasticity by mirroring the scalar multiple value used by the AMPL token.
 *      Thus when AMPL balances expand or contract, `ElasticAMPLMirrorERC20` balances also change by the same proportion.
 *
 * @author AmpleforthEng & Aave
 **/
contract IncentivizedElasticAMPLMirrorERC20 is Context, IERC20, IERC20Detailed {
  using SafeMath for uint256;

  IAaveIncentivesController internal immutable _incentivesController;

  address public immutable AMPL_ADDRESS;

  uint256 private constant MAX_UINT256 = ~uint256(0); // (2^256) - 1
  uint256 private constant AMPL_DECIMALS = 9;
  uint256 private constant INITIAL_AMPL_SUPPLY = 50 * 10**6 * 10**AMPL_DECIMALS;
  uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_AMPL_SUPPLY);

  mapping(address => uint256) internal _internalBalances;
  mapping(address => mapping(address => uint256)) private _allowances;

  uint256 internal _totalSupplyInternal;
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
    AMPL_ADDRESS = baseAsset;
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
   **/
  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupplyInternal.div(gonsPerAMPL());
  }

  /**
   * @return The external balance of the token
   **/
  function balanceOf(address account) public view virtual override returns (uint256) {
    return _internalBalances[account].div(gonsPerAMPL());
  }

  /**
   * @return The scalar balance multiple
   **/
  function gonsPerAMPL() private view returns (uint256) {
    return TOTAL_GONS.div(IERC20(AMPL_ADDRESS).totalSupply());
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
      _allowances[sender][_msgSender()].sub(amount, 'ElasticAMPLMirrorERC20: transfer amount exceeds allowance')
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
        'ElasticAMPLMirrorERC20: decreased allowance below zero'
      )
    );
    return true;
  }

  function _transfer(
    address sender,
    address recipient,
    uint256 amount
  ) internal virtual {
    require(sender != address(0), 'ElasticAMPLMirrorERC20: transfer from the zero address');
    require(recipient != address(0), 'ElasticAMPLMirrorERC20: transfer to the zero address');

    _beforeTokenTransfer(sender, recipient, amount);

    uint256 gonsPerAMPL_ = gonsPerAMPL();
    uint256 internalAmount = amount.mul(gonsPerAMPL_);

    uint256 oldSenderBalanceInternal = _internalBalances[sender];
    _internalBalances[sender] = oldSenderBalanceInternal.sub(internalAmount, 'ElasticAMPLMirrorERC20: transfer amount exceeds balance');
    uint256 oldRecipientBalanceInternal = _internalBalances[recipient];
    _internalBalances[recipient] = _internalBalances[recipient].add(internalAmount);

    if(address(_incentivesController) != address(0)) {
      uint256 currentTotalSupply = _totalSupplyInternal.div(gonsPerAMPL_);
      uint256 oldSenderBalance = oldSenderBalanceInternal.div(gonsPerAMPL_);
      uint256 oldRecipientBalance = oldRecipientBalanceInternal.div(gonsPerAMPL_);
      _incentivesController.handleAction(sender, currentTotalSupply, oldSenderBalance);
      if (sender != recipient) {
        _incentivesController.handleAction(recipient, currentTotalSupply, oldRecipientBalance);
      }
    }
  }

  function _mint(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ElasticAMPLMirrorERC20: mint to the zero address');

    _beforeTokenTransfer(address(0), account, amount);

    uint256 gonsPerAMPL_ = gonsPerAMPL();
    uint256 internalAmount = amount.mul(gonsPerAMPL_);

    uint256 oldTotalSupplyInternal = _totalSupplyInternal;
    _totalSupplyInternal = oldTotalSupplyInternal.add(internalAmount);

    uint256 oldAccountBalanceInternal = _internalBalances[account];
    _internalBalances[account] = oldAccountBalanceInternal.add(internalAmount);

    if (address(_incentivesController) != address(0)) {
      uint256 oldTotalSupply = oldTotalSupplyInternal.div(gonsPerAMPL_);
      uint256 oldAccountBalance = oldAccountBalanceInternal.div(gonsPerAMPL_);
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _burn(address account, uint256 amount) internal virtual {
    require(account != address(0), 'ElasticAMPLMirrorERC20: burn from the zero address');

    _beforeTokenTransfer(account, address(0), amount);

    uint256 gonsPerAMPL_ = gonsPerAMPL();
    uint256 internalAmount = amount.mul(gonsPerAMPL_);

    uint256 oldTotalSupplyInternal = _totalSupplyInternal;
    _totalSupplyInternal = oldTotalSupplyInternal.sub(internalAmount);

    uint256 oldAccountBalanceInternal = _internalBalances[account];
    _internalBalances[account] = oldAccountBalanceInternal.sub(internalAmount, 'ElasticAMPLMirrorERC20: burn amount exceeds balance');

    if (address(_incentivesController) != address(0)) {
      uint256 oldTotalSupply = oldTotalSupplyInternal.div(gonsPerAMPL_);
      uint256 oldAccountBalance = oldAccountBalanceInternal.div(gonsPerAMPL_);
      _incentivesController.handleAction(account, oldTotalSupply, oldAccountBalance);
    }
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal virtual {
    require(owner != address(0), 'ElasticAMPLMirrorERC20: approve from the zero address');
    require(spender != address(0), 'ElasticAMPLMirrorERC20: approve to the zero address');

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

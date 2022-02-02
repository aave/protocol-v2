// SPDX-FileCopyrightText: 2020 Lido <info@lido.fi>
pragma solidity 0.6.12;

/**
 * @notice Mock was based on the original StETH contract from the Lido organization
 * https://github.com/lidofinance/lido-dao/blob/master/contracts/0.4.24/StETH.sol
 * and tries to be as close as possible to the original implementation.
 */
contract StETHMocked {
  using LidoSafeMath for uint256;

  // use there values like real stETH has
  uint256 internal _totalShares = 1608965089698263670456320;
  uint256 internal _pooledEther = 1701398689820002221426255;
  mapping(address => uint256) private shares;
  mapping(address => mapping(address => uint256)) private allowances;

  function name() public pure returns (string memory) {
    return 'Liquid staked Ether 2.0';
  }

  function symbol() public pure returns (string memory) {
    return 'stETH';
  }

  function decimals() public pure returns (uint8) {
    return 18;
  }

  function totalSupply() public view returns (uint256) {
    return _getTotalPooledEther();
  }

  function getTotalPooledEther() public view returns (uint256) {
    return _getTotalPooledEther();
  }

  function balanceOf(address _account) public view returns (uint256) {
    return getPooledEthByShares(_sharesOf(_account));
  }

  function transfer(address _recipient, uint256 _amount) public returns (bool) {
    _transfer(msg.sender, _recipient, _amount);
    return true;
  }

  function allowance(address _owner, address _spender) public view returns (uint256) {
    return allowances[_owner][_spender];
  }

  function approve(address _spender, uint256 _amount) public returns (bool) {
    _approve(msg.sender, _spender, _amount);
    return true;
  }

  function transferFrom(
    address _sender,
    address _recipient,
    uint256 _amount
  ) public returns (bool) {
    uint256 currentAllowance = allowances[_sender][msg.sender];
    require(currentAllowance >= _amount, 'TRANSFER_AMOUNT_EXCEEDS_ALLOWANCE');

    _transfer(_sender, _recipient, _amount);
    _approve(_sender, msg.sender, currentAllowance.sub(_amount));
    return true;
  }

  function increaseAllowance(address _spender, uint256 _addedValue) public returns (bool) {
    _approve(msg.sender, _spender, allowances[msg.sender][_spender].add(_addedValue));
    return true;
  }

  function decreaseAllowance(address _spender, uint256 _subtractedValue) public returns (bool) {
    uint256 currentAllowance = allowances[msg.sender][_spender];
    require(currentAllowance >= _subtractedValue, 'DECREASED_ALLOWANCE_BELOW_ZERO');
    _approve(msg.sender, _spender, currentAllowance.sub(_subtractedValue));
    return true;
  }

  function getTotalShares() public view returns (uint256) {
    return _getTotalShares();
  }

  function sharesOf(address _account) public view returns (uint256) {
    return _sharesOf(_account);
  }

  function getSharesByPooledEth(uint256 _ethAmount) public view returns (uint256) {
    uint256 totalPooledEther = _getTotalPooledEther();
    if (totalPooledEther == 0) {
      return 0;
    } else {
      return _ethAmount.mul(_getTotalShares()).div(totalPooledEther);
    }
  }

  function getPooledEthByShares(uint256 _sharesAmount) public view returns (uint256) {
    uint256 totalShares = _getTotalShares();
    if (totalShares == 0) {
      return 0;
    } else {
      return _sharesAmount.mul(_getTotalPooledEther()).div(totalShares);
    }
  }

  function mint(address _recipient, uint256 amount) external returns (uint256) {
    return _submit(_recipient, amount);
  }

  function positiveRebase(uint256 amount) external {
    _pooledEther = _pooledEther.add(amount);
  }

  function negativeRebase(uint256 amount) external {
    _pooledEther = _pooledEther.sub(amount);
  }

  function _getTotalPooledEther() internal view returns (uint256) {
    return _pooledEther;
  }

  function _transfer(
    address _sender,
    address _recipient,
    uint256 _amount
  ) internal {
    uint256 _sharesToTransfer = getSharesByPooledEth(_amount);
    _transferShares(_sender, _recipient, _sharesToTransfer);
    emit Transfer(_sender, _recipient, _amount);
  }

  function _approve(
    address _owner,
    address _spender,
    uint256 _amount
  ) internal {
    require(_owner != address(0), 'APPROVE_FROM_ZERO_ADDRESS');
    require(_spender != address(0), 'APPROVE_TO_ZERO_ADDRESS');

    allowances[_owner][_spender] = _amount;
    emit Approval(_owner, _spender, _amount);
  }

  function _getTotalShares() internal view returns (uint256) {
    return _totalShares;
  }

  function _sharesOf(address _account) internal view returns (uint256) {
    return shares[_account];
  }

  function _transferShares(
    address _sender,
    address _recipient,
    uint256 _sharesAmount
  ) internal {
    require(_sender != address(0), 'TRANSFER_FROM_THE_ZERO_ADDRESS');
    require(_recipient != address(0), 'TRANSFER_TO_THE_ZERO_ADDRESS');

    uint256 currentSenderShares = shares[_sender];
    require(_sharesAmount <= currentSenderShares, 'TRANSFER_AMOUNT_EXCEEDS_BALANCE');

    shares[_sender] = currentSenderShares.sub(_sharesAmount);
    shares[_recipient] = shares[_recipient].add(_sharesAmount);
  }

  function _mintShares(address _recipient, uint256 _sharesAmount)
    internal
    returns (uint256 newTotalShares)
  {
    require(_recipient != address(0), 'MINT_TO_THE_ZERO_ADDRESS');

    newTotalShares = _getTotalShares().add(_sharesAmount);
    _totalShares = newTotalShares;

    shares[_recipient] = shares[_recipient].add(_sharesAmount);
  }

  function _burnShares(address _account, uint256 _sharesAmount)
    internal
    returns (uint256 newTotalShares)
  {
    require(_account != address(0), 'BURN_FROM_THE_ZERO_ADDRESS');

    uint256 accountShares = shares[_account];
    require(_sharesAmount <= accountShares, 'BURN_AMOUNT_EXCEEDS_BALANCE');

    newTotalShares = _getTotalShares().sub(_sharesAmount);
    _totalShares = newTotalShares;

    shares[_account] = accountShares.sub(_sharesAmount);
  }

  function _submit(address sender, uint256 deposit) internal returns (uint256) {
    require(deposit != 0, 'ZERO_DEPOSIT');

    uint256 sharesAmount = getSharesByPooledEth(deposit);
    if (sharesAmount == 0) {
      sharesAmount = deposit;
    }

    _mintShares(sender, sharesAmount);
    _pooledEther = _pooledEther.add(deposit);
    return sharesAmount;
  }

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title SafeMath
 * @dev Math operations with safety checks that revert on error. Prefix Lido used to not
 * conflict with OpenZeppelin SafeMath contract.
 */
library LidoSafeMath {
  string private constant ERROR_ADD_OVERFLOW = 'MATH_ADD_OVERFLOW';
  string private constant ERROR_SUB_UNDERFLOW = 'MATH_SUB_UNDERFLOW';
  string private constant ERROR_MUL_OVERFLOW = 'MATH_MUL_OVERFLOW';
  string private constant ERROR_DIV_ZERO = 'MATH_DIV_ZERO';

  /**
   * @dev Multiplies two numbers, reverts on overflow.
   */
  function mul(uint256 _a, uint256 _b) internal pure returns (uint256) {
    if (_a == 0) {
      return 0;
    }

    uint256 c = _a * _b;
    require(c / _a == _b, ERROR_MUL_OVERFLOW);

    return c;
  }

  /**
   * @dev Integer division of two numbers truncating the quotient, reverts on division by zero.
   */
  function div(uint256 _a, uint256 _b) internal pure returns (uint256) {
    require(_b > 0, ERROR_DIV_ZERO); // Solidity only automatically asserts when dividing by 0
    uint256 c = _a / _b;
    // assert(_a == _b * c + _a % _b); // There is no case in which this doesn't hold

    return c;
  }

  /**
   * @dev Subtracts two numbers, reverts on overflow (i.e. if subtrahend is greater than minuend).
   */
  function sub(uint256 _a, uint256 _b) internal pure returns (uint256) {
    require(_b <= _a, ERROR_SUB_UNDERFLOW);
    uint256 c = _a - _b;

    return c;
  }

  /**
   * @dev Adds two numbers, reverts on overflow.
   */
  function add(uint256 _a, uint256 _b) internal pure returns (uint256) {
    uint256 c = _a + _b;
    require(c >= _a, ERROR_ADD_OVERFLOW);

    return c;
  }

  /**
   * @dev Divides two numbers and returns the remainder (unsigned integer modulo),
   * reverts when dividing by zero.
   */
  function mod(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, ERROR_DIV_ZERO);
    return a % b;
  }
}

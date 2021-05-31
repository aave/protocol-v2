// SPDX-License-Identifier: MIT
pragma solidity 0.8.3;

struct UserRewards {
  uint256 unclaimedBalance;
  uint256 lastClaimedContractBalance;
}

struct AppStorage {
  uint256 totalSupply;
  IAmToken amToken;
  mapping(address => uint256) balances;
  mapping(address => mapping(address => uint256)) allowances;
  mapping(address => mapping(address => UserRewards)) rewards;
  mapping(address => uint256) tokenVsRewards;
}

contract VamToken {
  AppStorage s;
  event Transfer(address indexed _from, address indexed _to, uint256 _value);
  event Approval(address indexed _owner, address indexed _spender, uint256 _value);
  event RewardsClaimed(address indexed _token, address _user, uint256 amount);

  uint256 internal constant P27 = 1e27;
  uint256 internal constant HALF_P27 = P27 / 2;

  constructor(IAmToken _amToken) {
    s.amToken = _amToken;
  }

  function name() external view returns (string memory) {
    return string(abi.encodePacked('Value ', s.amToken.name()));
  }

  function symbol() external view returns (string memory) {
    return string(abi.encodePacked('v', s.amToken.symbol()));
  }

  function decimals() external view returns (uint8) {
    return s.amToken.decimals();
  }

  function totalSupply() external view returns (uint256) {
    return s.totalSupply;
  }

  function balanceOf(address _owner) public view returns (uint256 balance_) {
    balance_ = s.balances[_owner];
  }

  function approve(address _spender, uint256 _value) external returns (bool) {
    _approve(msg.sender, _spender, _value);
    return true;
  }

  function increaseAllowance(address _spender, uint256 _addedValue) external returns (bool) {
    _approve(msg.sender, _spender, s.allowances[msg.sender][_spender] + _addedValue);
    return true;
  }

  function getamToken() external view returns (address) {
    return address(s.amToken);
  }

  function decreaseAllowance(address _spender, uint256 _subtractedValue)
    public
    virtual
    returns (bool)
  {
    uint256 currentAllowance = s.allowances[msg.sender][_spender];
    require(currentAllowance >= _subtractedValue, 'Cannot decrease allowance to less than 0');
    _approve(msg.sender, _spender, currentAllowance - _subtractedValue);

    return true;
  }

  function allowance(address _owner, address _spender) external view returns (uint256 remaining_) {
    return s.allowances[_owner][_spender];
  }

  function transfer(address _to, uint256 _value) external returns (bool) {
    _transfer(msg.sender, _to, _value);
    return true;
  }

  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  ) external returns (bool success) {
    _transfer(_from, _to, _value);

    uint256 currentAllowance = s.allowances[_from][msg.sender];
    require(currentAllowance >= _value, 'transfer amount exceeds allowance');
    _approve(_from, msg.sender, currentAllowance - _value);

    return true;
  }

  function mint(uint256 _amTokenValue) external {
    claimRewardsFromController();
    updateUserRewards(msg.sender);
    uint256 vamTokenValue = getVamTokenValue(_amTokenValue);
    s.balances[msg.sender] += vamTokenValue;
    s.totalSupply += vamTokenValue;
    emit Transfer(address(0), msg.sender, vamTokenValue);
    s.amToken.transferFrom(msg.sender, address(this), _amTokenValue);
  }

  function burn(uint256 _vamTokenValue) external {
    claimRewardsFromController();
    updateUserRewards(msg.sender);
    s.balances[msg.sender] -= _vamTokenValue;
    s.totalSupply -= _vamTokenValue;
    emit Transfer(msg.sender, address(0), _vamTokenValue);
    uint256 amTokenValue = getAmTokenValue(_vamTokenValue);
    s.amToken.transfer(msg.sender, amTokenValue);
  }

  function updateUserRewardsForToken(address user, address rewardsToken) public {
    if (rewardsToken != address(0) && s.totalSupply > 0 && user != address(0)) {
      UserRewards storage _userRewards = s.rewards[user][rewardsToken];
      uint256 userApplicableBalance =
        s.tokenVsRewards[rewardsToken] - _userRewards.lastClaimedContractBalance;
      uint256 userShare = (s.balances[user] * userApplicableBalance) / s.totalSupply;
      _userRewards.lastClaimedContractBalance = s.tokenVsRewards[rewardsToken];
      _userRewards.unclaimedBalance += userShare;
    }
  }

  function updateUserRewards(address user) public {
    IAaveIncentivesController controller = s.amToken.getIncentivesController();
    if (address(controller) != address(0)) {
      address rewardsToken = controller.REWARD_TOKEN();
      updateUserRewardsForToken(user, rewardsToken);
    }
  }

  function claimRewardsFromController() public {
    IAaveIncentivesController controller = s.amToken.getIncentivesController();

    if (address(controller) != address(0)) {
      address rewardsToken = controller.REWARD_TOKEN();
      address[] memory assets = new address[](1);
      assets[0] = address(s.amToken);

      uint256 amountReceived = controller.claimRewards(assets, type(uint256).max, address(this));
      s.tokenVsRewards[rewardsToken] += amountReceived;
    }
  }

  function claimRewards(address user, address token) public {
    if (token == address(0)) {
      IAaveIncentivesController controller = s.amToken.getIncentivesController();
      token = controller.REWARD_TOKEN();
    }

    UserRewards storage _userRewards = s.rewards[user][token];
    uint256 amount = _userRewards.unclaimedBalance;
    _userRewards.unclaimedBalance = 0;
    IERC20(token).transfer(user, amount);
    emit RewardsClaimed(token, user, amount);
  }

  function _transfer(
    address _from,
    address _to,
    uint256 _value
  ) internal {
    claimRewardsFromController();
    updateUserRewards(_from);
    updateUserRewards(_to);

    require(_from != address(0), '_from cannot be zero address');
    require(_to != address(0), '_to cannot be zero address');
    uint256 balance = s.balances[_from];
    require(balance >= _value, '_value greater than balance');
    s.balances[_from] -= _value;
    s.balances[_to] += _value;
    emit Transfer(_from, _to, _value);
  }

  function _approve(
    address owner,
    address spender,
    uint256 amount
  ) internal {
    require(owner != address(0), 'approve from the zero address');
    require(spender != address(0), 'approve to the zero address');

    s.allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  /**
   * @dev Divides two 27 decimal percision values, rounding half up to the nearest decimal
   * @param a 27 decimal percision value
   * @param b 27 decimal percision value
   * @return The result of a/b, in 27 decimal percision value
   **/
  function p27Div(uint256 a, uint256 b) internal pure returns (uint256) {
    require(b != 0, 'p27 division by 0');
    uint256 c = a * P27;
    require(a == c / P27, 'p27 multiplication overflow');
    uint256 bDividedByTwo = b / 2;
    c += bDividedByTwo;
    require(c >= bDividedByTwo, 'p27 multiplication addition overflow');
    return c / b;
  }

  /**
   * @dev Multiplies two 27 decimal percision values, rounding half up to the nearest decimal
   * @param a 27 decimal percision value
   * @param b 27 decimal percision value
   * @return The result of a*b, in 27 decimal percision value
   **/
  function p27Mul(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a * b;
    if (c == 0) {
      return 0;
    }
    require(b == c / a, 'p27 multiplication overflow');
    c += HALF_P27;
    require(c >= HALF_P27, 'p27 multiplication addition overflow');
    return c / P27;
  }

  /**
   * @dev Converts amToken value to maToken value
   * @param _amTokenValue aToken value to convert
   * @return vamTokenValue_ The converted maToken value
   **/
  function getVamTokenValue(uint256 _amTokenValue) public view returns (uint256 vamTokenValue_) {
    ILendingPool pool = s.amToken.POOL();
    uint256 liquidityIndex = pool.getReserveNormalizedIncome(s.amToken.UNDERLYING_ASSET_ADDRESS());
    vamTokenValue_ = p27Div(_amTokenValue, liquidityIndex);
  }

  /**
   * @dev Converts maToken value to aToken value
   * @param _vamTokenValue maToken value to convert
   * @return amTokenValue_ The converted aToken value
   **/
  function getAmTokenValue(uint256 _vamTokenValue) public view returns (uint256 amTokenValue_) {
    ILendingPool pool = s.amToken.POOL();
    uint256 liquidityIndex = pool.getReserveNormalizedIncome(s.amToken.UNDERLYING_ASSET_ADDRESS());
    amTokenValue_ = p27Mul(_vamTokenValue, liquidityIndex);
  }
}

interface ILendingPool {
  function getReserveNormalizedIncome(address _asset) external view returns (uint256);
}

interface IERC20 {
  function name() external view returns (string memory);

  function symbol() external view returns (string memory);

  function decimals() external view returns (uint8);

  function totalSupply() external view returns (uint256);

  function balanceOf(address _owner) external view returns (uint256 balance);

  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  ) external returns (bool success);

  function transfer(address _to, uint256 _value) external returns (bool success);

  function approve(address _spender, uint256 _value) external returns (bool success);

  function allowance(address _owner, address _spender) external view returns (uint256 remaining);
}

interface IAmToken is IERC20 {
  function POOL() external view returns (ILendingPool);

  function UNDERLYING_ASSET_ADDRESS() external view returns (address);

  function getIncentivesController() external view returns (IAaveIncentivesController);
}

interface IAaveIncentivesController {
  function handleAction(
    address asset,
    uint256 userBalance,
    uint256 totalSupply
  ) external;

  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external returns (uint256);

  function REWARD_TOKEN() external view returns (address);
}

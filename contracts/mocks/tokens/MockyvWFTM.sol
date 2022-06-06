// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import {ERC20} from '../../dependencies/openzeppelin/contracts/ERC20.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {TransferHelper} from '../../protocol/libraries/helpers/TransferHelper.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';

contract MockyvWFTM is ERC20 {
  using WadRayMath for uint256;

  uint256 internal constant SECONDS_PER_YEAR = 365 days;
  uint256 public rewardRatio;
  uint256 public lastReport;
  address public rewards;
  uint256 constant MAX_BPS = 10_000; // 100%, or 10k basis points
  uint256 constant SECS_PER_YEAR = 31_556_952; // 365.2425 days

  ERC20 public token;
  address public governance;
  address public management;
  address public guardian;
  bool public isIncreasing;

  constructor(
    address _token,
    address _governance,
    address _rewards,
    string memory nameOverride,
    string memory symbolOverride,
    address _guardian, //default is msg.sender
    address _management //default is msg.sender
  )
    ERC20(
      string(abi.encodePacked(IERC20Detailed(_token).symbol(), ' yVault')),
      string(abi.encodePacked('yv', IERC20Detailed(_token).symbol()))
    )
  {
    token = ERC20(_token);

    _setupDecimals(IERC20Detailed(_token).decimals());

    governance = _governance;
    management = _management;
    rewards = _rewards;
    guardian = _guardian;
    rewardRatio = 10**25; // 0.01 * ray() = 1%
    lastReport = block.timestamp;
    isIncreasing = true;
  }

  function setRewardRation(uint256 ratio) external {
    rewardRatio = ratio;
  }

  function setIncreasing(bool increasing) external {
    isIncreasing = increasing;
  }

  function deposit(uint256 _amount, address recipient) external returns (uint256) {
    require(recipient != address(this) && recipient != address(0));

    uint256 amount = _amount;
    if (amount == type(uint256).max) amount = token.balanceOf(msg.sender);

    require(amount > 0);

    uint256 shares = _issueSharesForAmount(recipient, amount);

    TransferHelper.safeTransferFrom(address(token), msg.sender, address(this), amount);

    return shares;
  }

  function withdraw(
    uint256 maxShares,
    address recipient,
    uint256
  ) external returns (uint256) {
    uint256 shares = maxShares;
    // require(maxLoss <= MAX_BPS);

    if (shares == type(uint256).max) shares = balanceOf(msg.sender);

    require(shares <= balanceOf(msg.sender));
    require(shares > 0);

    uint256 value = _shareValue(shares);

    _burn(msg.sender, shares);

    TransferHelper.safeTransfer(address(token), recipient, value);

    return value;
  }

  function pricePerShare() external view returns (uint256) {
    uint256 decimal = decimals();
    return _shareValue(10**decimal);
  }

  function _issueSharesForAmount(address to, uint256 amount) internal returns (uint256) {
    uint256 decimal = decimals();
    uint256 shares = amount.rayDiv(_shareValue(10**decimal).wadToRay());
    require(shares != 0);

    _mint(to, shares);

    return shares;
  }

  function _shareValue(uint256 shares) internal view returns (uint256) {
    uint256 timeDifference = block.timestamp - lastReport;
    if (!isIncreasing) {
      timeDifference = 3 days;
    }

    uint256 linearReward = ((rewardRatio * timeDifference) / SECONDS_PER_YEAR) + WadRayMath.ray();

    return shares.rayMul(linearReward);
  }
}

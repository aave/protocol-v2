// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {ERC20} from '../../dependencies/openzeppelin/contracts/ERC20.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';
import {PercentageMath} from '../../protocol/libraries/math/PercentageMath.sol';

/*
 * @dev Mocked token with linear distribution via emission by time distributed to token holders
 */
contract RewardsToken is ERC20 {
  using WadRayMath for uint256;
  using PercentageMath for uint256;

  uint256 private constant EMISION_PER_SECOND = 1 ether;
  uint256 public immutable INIT_TIMESTAMP;

  uint256 internal lifetimeMintable;

  mapping(address => uint256) userMinted;
  mapping(address => uint256) userLifetimeRewards;
  mapping(address => uint256) userCheckpoint;

  constructor() public ERC20('Rewards', 'REW') {
    INIT_TIMESTAMP = block.timestamp;
  }

  /*
   * @dev Get accumulated rewards of a user between
   */
  function getAccruedRewards(address user, uint256 totalMintable) internal view returns (uint256) {
    uint256 balance = balanceOf(user);
    if (balance == 0) return 0;

    return balance.rayDiv(this.totalSupply()).rayMul(totalMintable.sub(userCheckpoint[user]));
  }

  /*
   * @dev Update lifetimeMintable state and user lifeTimeRewards
   */
  function updateMintableEmission(address user) public {
    if (user == address(0)) return;

    lifetimeMintable = (block.timestamp.sub(INIT_TIMESTAMP)).mul(EMISION_PER_SECOND);
    userLifetimeRewards[user] = userLifetimeRewards[user].add(
      getAccruedRewards(user, lifetimeMintable)
    );
    userCheckpoint[user] = lifetimeMintable;
  }

  /*
   * @dev Claim rewards from the extra emission by time
   */
  function claimRewards() public returns (bool) {
    updateMintableEmission(msg.sender);
    uint256 claimableRewards = userLifetimeRewards[msg.sender].sub(userMinted[msg.sender]);
    userMinted[msg.sender] = claimableRewards.add(userMinted[msg.sender]);
    _mint(msg.sender, claimableRewards);
    return true;
  }

  /*
   * @dev Getter for retrieving the expected claimable rewards
   */
  function getLifetimeRewards(address user) public view returns (uint256) {
    uint256 totalMintable = (block.timestamp.sub(INIT_TIMESTAMP)).mul(EMISION_PER_SECOND);

    return userLifetimeRewards[user].add(getAccruedRewards(user, totalMintable));
  }

  /*
   * @dev Getter for retrieving the expected claimable rewards
   */
  function getClaimableRewards(address user) external view returns (uint256) {
    return getLifetimeRewards(user).sub(userMinted[user]);
  }

  /*
   * @dev Mint an arbitrary amount of  REW to the msg.sender and start rewards to msg.sender
   */
  function mint(uint256 value) external returns (bool) {
    _mint(msg.sender, value);
    return true;
  }

  /*
   * @dev Update user distribution state at transfer/mint hook
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256
  ) internal override {
    updateMintableEmission(from);
    updateMintableEmission(to);
  }
}

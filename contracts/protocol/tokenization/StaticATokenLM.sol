// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {IAToken} from '../../interfaces/IAToken.sol';
import {IStaticATokenLM} from '../../interfaces/IStaticATokenLM.sol';
import {IAaveIncentivesController} from '../../interfaces/IAaveIncentivesController.sol';
import {IInitializableStaticATokenLM} from '../../interfaces/IInitializableStaticATokenLM.sol';
import {VersionedInitializable} from '../libraries/aave-upgradeability/VersionedInitializable.sol';

import {StaticATokenErrors} from '../libraries/helpers/StaticATokenErrors.sol';

import {ERC20} from '../../dependencies/openzeppelin/contracts/ERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';
import {RayMathNoRounding} from '../../protocol/libraries/math/RayMathNoRounding.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';

/**
 * @title StaticATokenLM
 * @notice Wrapper token that allows to deposit tokens on the Aave protocol and receive
 * a token which balance doesn't increase automatically, but uses an ever-increasing exchange rate.
 * The token support claiming liquidity mining rewards from the Aave system.
 * @author Aave
 **/
contract StaticATokenLM is
  VersionedInitializable,
  ERC20('STATIC_ATOKEN_IMPL', 'STATIC_ATOKEN_IMPL'),
  IStaticATokenLM
{
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;
  using RayMathNoRounding for uint256;

  bytes public constant EIP712_REVISION = bytes('1');
  bytes32 internal constant EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)');
  bytes32 public constant METADEPOSIT_TYPEHASH =
    keccak256(
      'Deposit(address depositor,address recipient,uint256 value,uint16 referralCode,bool fromUnderlying,uint256 nonce,uint256 deadline)'
    );
  bytes32 public constant METAWITHDRAWAL_TYPEHASH =
    keccak256(
      'Withdraw(address owner,address recipient,uint256 staticAmount,uint256 dynamicAmount,bool toUnderlying,uint256 nonce,uint256 deadline)'
    );

  uint256 public constant STATIC_ATOKEN_LM_REVISION = 0x1;

  ILendingPool public override LENDING_POOL;
  IAaveIncentivesController public override INCENTIVES_CONTROLLER;
  IERC20 public override ATOKEN;
  IERC20 public override ASSET;
  IERC20 public override REWARD_TOKEN;

  mapping(address => uint256) public _nonces;

  uint256 internal _accRewardsPerToken;
  uint256 internal _lifetimeRewardsClaimed;
  uint256 internal _lifetimeRewards;
  uint256 internal _lastRewardBlock;

  // user => _accRewardsPerToken at last interaction (in RAYs)
  mapping(address => uint256) private _userSnapshotRewardsPerToken;
  // user => unclaimedRewards (in RAYs)
  mapping(address => uint256) private _unclaimedRewards;

  bool public isImplementation;

  modifier onlyProxy() {
    require(isImplementation == false, StaticATokenErrors.ONLY_PROXY_MAY_CALL);
    _;
  }

  constructor() public {
    isImplementation = true;
  }

  ///@inheritdoc VersionedInitializable
  function getRevision() internal pure virtual override returns (uint256) {
    return STATIC_ATOKEN_LM_REVISION;
  }

  ///@inheritdoc IInitializableStaticATokenLM
  function initialize(
    ILendingPool pool,
    address aToken,
    string calldata staticATokenName,
    string calldata staticATokenSymbol
  ) external override initializer {
    LENDING_POOL = pool;
    ATOKEN = IERC20(aToken);

    _name = staticATokenName;
    _symbol = staticATokenSymbol;
    _setupDecimals(IERC20Detailed(aToken).decimals());

    ASSET = IERC20(IAToken(aToken).UNDERLYING_ASSET_ADDRESS());
    ASSET.safeApprove(address(pool), type(uint256).max);

    try IAToken(aToken).getIncentivesController() returns (
      IAaveIncentivesController incentivesController
    ) {
      if (address(incentivesController) != address(0)) {
        INCENTIVES_CONTROLLER = incentivesController;
        REWARD_TOKEN = IERC20(INCENTIVES_CONTROLLER.REWARD_TOKEN());
      }
    } catch {}

    emit Initialized(address(pool), aToken, staticATokenName, staticATokenSymbol);
  }

  ///@inheritdoc IStaticATokenLM
  function deposit(
    address recipient,
    uint256 amount,
    uint16 referralCode,
    bool fromUnderlying
  ) external override returns (uint256) {
    return _deposit(msg.sender, recipient, amount, referralCode, fromUnderlying);
  }

  ///@inheritdoc IStaticATokenLM
  function withdraw(
    address recipient,
    uint256 amount,
    bool toUnderlying
  ) external override returns (uint256, uint256) {
    return _withdraw(msg.sender, recipient, amount, 0, toUnderlying);
  }

  ///@inheritdoc IStaticATokenLM
  function withdrawDynamicAmount(
    address recipient,
    uint256 amount,
    bool toUnderlying
  ) external override returns (uint256, uint256) {
    return _withdraw(msg.sender, recipient, 0, amount, toUnderlying);
  }

  ///@inheritdoc IStaticATokenLM
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external override {
    require(owner != address(0), StaticATokenErrors.INVALID_OWNER);
    //solium-disable-next-line
    require(block.timestamp <= deadline, StaticATokenErrors.INVALID_EXPIRATION);
    uint256 currentValidNonce = _nonces[owner];
    bytes32 digest =
      keccak256(
        abi.encodePacked(
          '\x19\x01',
          getDomainSeparator(),
          keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, currentValidNonce, deadline))
        )
      );
    require(owner == ecrecover(digest, v, r, s), StaticATokenErrors.INVALID_SIGNATURE);
    _nonces[owner] = currentValidNonce.add(1);
    _approve(owner, spender, value);
  }

  ///@inheritdoc IStaticATokenLM
  function metaDeposit(
    address depositor,
    address recipient,
    uint256 value,
    uint16 referralCode,
    bool fromUnderlying,
    uint256 deadline,
    SignatureParams calldata sigParams
  ) external override returns (uint256) {
    require(depositor != address(0), StaticATokenErrors.INVALID_DEPOSITOR);
    //solium-disable-next-line
    require(block.timestamp <= deadline, StaticATokenErrors.INVALID_EXPIRATION);
    uint256 currentValidNonce = _nonces[depositor];
    bytes32 digest =
      keccak256(
        abi.encodePacked(
          '\x19\x01',
          getDomainSeparator(),
          keccak256(
            abi.encode(
              METADEPOSIT_TYPEHASH,
              depositor,
              recipient,
              value,
              referralCode,
              fromUnderlying,
              currentValidNonce,
              deadline
            )
          )
        )
      );
    require(
      depositor == ecrecover(digest, sigParams.v, sigParams.r, sigParams.s),
      StaticATokenErrors.INVALID_SIGNATURE
    );
    _nonces[depositor] = currentValidNonce.add(1);
    return _deposit(depositor, recipient, value, referralCode, fromUnderlying);
  }

  ///@inheritdoc IStaticATokenLM
  function metaWithdraw(
    address owner,
    address recipient,
    uint256 staticAmount,
    uint256 dynamicAmount,
    bool toUnderlying,
    uint256 deadline,
    SignatureParams calldata sigParams
  ) external override returns (uint256, uint256) {
    require(owner != address(0), StaticATokenErrors.INVALID_OWNER);
    //solium-disable-next-line
    require(block.timestamp <= deadline, StaticATokenErrors.INVALID_EXPIRATION);
    uint256 currentValidNonce = _nonces[owner];
    bytes32 digest =
      keccak256(
        abi.encodePacked(
          '\x19\x01',
          getDomainSeparator(),
          keccak256(
            abi.encode(
              METAWITHDRAWAL_TYPEHASH,
              owner,
              recipient,
              staticAmount,
              dynamicAmount,
              toUnderlying,
              currentValidNonce,
              deadline
            )
          )
        )
      );

    require(
      owner == ecrecover(digest, sigParams.v, sigParams.r, sigParams.s),
      StaticATokenErrors.INVALID_SIGNATURE
    );
    _nonces[owner] = currentValidNonce.add(1);
    return _withdraw(owner, recipient, staticAmount, dynamicAmount, toUnderlying);
  }

  ///@inheritdoc IStaticATokenLM
  function dynamicBalanceOf(address account) external view override returns (uint256) {
    return _staticToDynamicAmount(balanceOf(account), rate());
  }

  ///@inheritdoc IStaticATokenLM
  function staticToDynamicAmount(uint256 amount) external view override returns (uint256) {
    return _staticToDynamicAmount(amount, rate());
  }

  ///@inheritdoc IStaticATokenLM
  function dynamicToStaticAmount(uint256 amount) external view override returns (uint256) {
    return _dynamicToStaticAmount(amount, rate());
  }

  ///@inheritdoc IStaticATokenLM
  function rate() public view override returns (uint256) {
    return LENDING_POOL.getReserveNormalizedIncome(address(ASSET));
  }

  ///@inheritdoc IStaticATokenLM
  function getDomainSeparator() public view override returns (bytes32) {
    uint256 chainId;
    assembly {
      chainId := chainid()
    }
    return
      keccak256(
        abi.encode(
          EIP712_DOMAIN,
          keccak256(bytes(name())),
          keccak256(EIP712_REVISION),
          chainId,
          address(this)
        )
      );
  }

  function _dynamicToStaticAmount(uint256 amount, uint256 rate) internal pure returns (uint256) {
    return amount.rayDiv(rate);
  }

  function _staticToDynamicAmount(uint256 amount, uint256 rate) internal pure returns (uint256) {
    return amount.rayMul(rate);
  }

  function _deposit(
    address depositor,
    address recipient,
    uint256 amount,
    uint16 referralCode,
    bool fromUnderlying
  ) internal onlyProxy returns (uint256) {
    require(recipient != address(0), StaticATokenErrors.INVALID_RECIPIENT);
    _updateRewards();

    if (fromUnderlying) {
      ASSET.safeTransferFrom(depositor, address(this), amount);
      LENDING_POOL.deposit(address(ASSET), amount, address(this), referralCode);
    } else {
      ATOKEN.safeTransferFrom(depositor, address(this), amount);
    }
    uint256 amountToMint = _dynamicToStaticAmount(amount, rate());
    _mint(recipient, amountToMint);

    return amountToMint;
  }

  function _withdraw(
    address owner,
    address recipient,
    uint256 staticAmount,
    uint256 dynamicAmount,
    bool toUnderlying
  ) internal returns (uint256, uint256) {
    require(recipient != address(0), StaticATokenErrors.INVALID_RECIPIENT);
    require(
      staticAmount == 0 || dynamicAmount == 0,
      StaticATokenErrors.ONLY_ONE_AMOUNT_FORMAT_ALLOWED
    );
    _updateRewards();

    uint256 userBalance = balanceOf(owner);

    uint256 amountToWithdraw;
    uint256 amountToBurn;

    uint256 currentRate = rate();
    if (staticAmount > 0) {
      amountToBurn = (staticAmount > userBalance) ? userBalance : staticAmount;
      amountToWithdraw = _staticToDynamicAmount(amountToBurn, currentRate);
    } else {
      uint256 dynamicUserBalance = _staticToDynamicAmount(userBalance, currentRate);
      amountToWithdraw = (dynamicAmount > dynamicUserBalance) ? dynamicUserBalance : dynamicAmount;
      amountToBurn = _dynamicToStaticAmount(amountToWithdraw, currentRate);
    }

    _burn(owner, amountToBurn);

    if (toUnderlying) {
      LENDING_POOL.withdraw(address(ASSET), amountToWithdraw, recipient);
    } else {
      ATOKEN.safeTransfer(recipient, amountToWithdraw);
    }

    return (amountToBurn, amountToWithdraw);
  }

  /**
   * @notice Updates rewards for senders and receiver in a transfer (not updating rewards for address(0))
   * @param from The address of the sender of tokens
   * @param to The address of the receiver of tokens
   * @param amount The amount of tokens to transfer in WAD
   */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return;
    }
    if (from != address(0)) {
      _updateUser(from);
    }
    if (to != address(0)) {
      _updateUser(to);
    }
  }

  /**
   * @notice Updates virtual internal accounting of rewards.
   */
  function _updateRewards() internal {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return;
    }
    if (block.number > _lastRewardBlock) {
      _lastRewardBlock = block.number;
      uint256 supply = totalSupply();
      if (supply == 0) {
        // No rewards can have accrued since last because there were no funds.
        return;
      }

      address[] memory assets = new address[](1);
      assets[0] = address(ATOKEN);

      uint256 freshRewards = INCENTIVES_CONTROLLER.getRewardsBalance(assets, address(this));
      uint256 lifetimeRewards = _lifetimeRewardsClaimed.add(freshRewards);
      uint256 rewardsAccrued = lifetimeRewards.sub(_lifetimeRewards).wadToRay();

      _accRewardsPerToken = _accRewardsPerToken.add(
        (rewardsAccrued).rayDivNoRounding(supply.wadToRay())
      );
      _lifetimeRewards = lifetimeRewards;
    }
  }

  ///@inheritdoc IStaticATokenLM
  function collectAndUpdateRewards() public override {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return;
    }

    _lastRewardBlock = block.number;
    uint256 supply = totalSupply();

    address[] memory assets = new address[](1);
    assets[0] = address(ATOKEN);

    uint256 freshlyClaimed =
      INCENTIVES_CONTROLLER.claimRewards(assets, type(uint256).max, address(this));
    uint256 lifetimeRewards = _lifetimeRewardsClaimed.add(freshlyClaimed);
    uint256 rewardsAccrued = lifetimeRewards.sub(_lifetimeRewards).wadToRay();

    if (supply > 0 && rewardsAccrued > 0) {
      _accRewardsPerToken = _accRewardsPerToken.add(
        (rewardsAccrued).rayDivNoRounding(supply.wadToRay())
      );
    }

    if (rewardsAccrued > 0) {
      _lifetimeRewards = lifetimeRewards;
    }

    _lifetimeRewardsClaimed = lifetimeRewards;
  }

  /**
   * @notice Claim rewards on behalf of a user and send them to a receiver
   * @param onBehalfOf The address to claim on behalf of
   * @param receiver The address to receive the rewards
   * @param forceUpdate Flag to retrieve latest rewards from `INCENTIVES_CONTROLLER`
   */
  function _claimRewardsOnBehalf(
    address onBehalfOf,
    address receiver,
    bool forceUpdate
  ) internal {
    if (forceUpdate) {
      collectAndUpdateRewards();
    }

    uint256 balance = balanceOf(onBehalfOf);
    uint256 reward = _getClaimableRewards(onBehalfOf, balance, false);
    uint256 totBal = REWARD_TOKEN.balanceOf(address(this));
    if (reward > totBal) {
      reward = totBal;
    }
    if (reward > 0) {
      _unclaimedRewards[onBehalfOf] = 0;
      _updateUserSnapshotRewardsPerToken(onBehalfOf);
      REWARD_TOKEN.safeTransfer(receiver, reward);
    }
  }

  function claimRewardsOnBehalf(
    address onBehalfOf,
    address receiver,
    bool forceUpdate
  ) external override {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return;
    }

    require(
      msg.sender == onBehalfOf || msg.sender == INCENTIVES_CONTROLLER.getClaimer(onBehalfOf),
      StaticATokenErrors.INVALID_CLAIMER
    );
    _claimRewardsOnBehalf(onBehalfOf, receiver, forceUpdate);
  }

  function claimRewards(address receiver, bool forceUpdate) external override {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return;
    }
    _claimRewardsOnBehalf(msg.sender, receiver, forceUpdate);
  }

  function claimRewardsToSelf(bool forceUpdate) external override {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return;
    }
    _claimRewardsOnBehalf(msg.sender, msg.sender, forceUpdate);
  }

  /**
   * @notice Update the rewardDebt for a user with balance as his balance
   * @param user The user to update
   */
  function _updateUserSnapshotRewardsPerToken(address user) internal {
    _userSnapshotRewardsPerToken[user] = _accRewardsPerToken;
  }

  /**
   * @notice Adding the pending rewards to the unclaimed for specific user and updating user index
   * @param user The address of the user to update
   */
  function _updateUser(address user) internal {
    uint256 balance = balanceOf(user);
    if (balance > 0) {
      uint256 pending = _getPendingRewards(user, balance, false);
      _unclaimedRewards[user] = _unclaimedRewards[user].add(pending);
    }
    _updateUserSnapshotRewardsPerToken(user);
  }

  /**
   * @notice Compute the pending in RAY (rounded down). Pending is the amount to add (not yet unclaimed) rewards in RAY (rounded down).
   * @param user The user to compute for
   * @param balance The balance of the user
   * @param fresh Flag to account for rewards not claimed by contract yet
   * @return The amound of pending rewards in RAY
   */
  function _getPendingRewards(
    address user,
    uint256 balance,
    bool fresh
  ) internal view returns (uint256) {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return 0;
    }

    if (balance == 0) {
      return 0;
    }

    uint256 rayBalance = balance.wadToRay();

    uint256 supply = totalSupply();
    uint256 accRewardsPerToken = _accRewardsPerToken;

    if (supply != 0 && fresh) {
      address[] memory assets = new address[](1);
      assets[0] = address(ATOKEN);

      uint256 freshReward = INCENTIVES_CONTROLLER.getRewardsBalance(assets, address(this));
      uint256 lifetimeRewards = _lifetimeRewardsClaimed.add(freshReward);
      uint256 rewardsAccrued = lifetimeRewards.sub(_lifetimeRewards).wadToRay();
      accRewardsPerToken = accRewardsPerToken.add(
        (rewardsAccrued).rayDivNoRounding(supply.wadToRay())
      );
    }

    return rayBalance.rayMulNoRounding(accRewardsPerToken.sub(_userSnapshotRewardsPerToken[user]));
  }

  /**
   * @notice Compute the claimable rewards for a user
   * @param user The address of the user
   * @param balance The balance of the user in WAD
   * @param fresh Flag to account for rewards not claimed by contract yet
   * @return The total rewards that can be claimed by the user (if `fresh` flag true, after updating rewards)
   */
  function _getClaimableRewards(
    address user,
    uint256 balance,
    bool fresh
  ) internal view returns (uint256) {
    uint256 reward = _unclaimedRewards[user].add(_getPendingRewards(user, balance, fresh));
    return reward.rayToWadNoRounding();
  }

  ///@inheritdoc IStaticATokenLM
  function getTotalClaimableRewards() external view override returns (uint256) {
    if (address(INCENTIVES_CONTROLLER) == address(0)) {
      return 0;
    }

    address[] memory assets = new address[](1);
    assets[0] = address(ATOKEN);
    uint256 freshRewards = INCENTIVES_CONTROLLER.getRewardsBalance(assets, address(this));
    return REWARD_TOKEN.balanceOf(address(this)).add(freshRewards);
  }

  ///@inheritdoc IStaticATokenLM
  function getClaimableRewards(address user) external view override returns (uint256) {
    return _getClaimableRewards(user, balanceOf(user), true);
  }

  ///@inheritdoc IStaticATokenLM
  function getUnclaimedRewards(address user) external view override returns (uint256) {
    return _unclaimedRewards[user].rayToWadNoRounding();
  }

  function getAccRewardsPerToken() external view override returns (uint256) {
    return _accRewardsPerToken;
  }

  function getLifetimeRewardsClaimed() external view override returns (uint256) {
    return _lifetimeRewardsClaimed;
  }

  function getLifetimeRewards() external view override returns (uint256) {
    return _lifetimeRewards;
  }

  function getLastRewardBlock() external view override returns (uint256) {
    return _lastRewardBlock;
  }

  function getIncentivesController() external view override returns (IAaveIncentivesController) {
    return INCENTIVES_CONTROLLER;
  }

  function UNDERLYING_ASSET_ADDRESS() external view override returns (address) {
    return address(ASSET);
  }
}

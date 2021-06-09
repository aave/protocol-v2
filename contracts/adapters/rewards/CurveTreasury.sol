// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {ICurveGauge, ICurveGaugeView} from '../interfaces/curve/ICurveGauge.sol';
import {IVotingEscrow} from '../interfaces/curve/IVotingEscrow.sol';
import {
  VersionedInitializable
} from '../../protocol/libraries/aave-upgradeability/VersionedInitializable.sol';
import {ICurveFeeDistributor} from '../interfaces/curve/ICurveFeeDistributor.sol';

/**
 * @title Curve Treasury that holds Curve LP and Gauge tokens
 * @notice The treasury holds Curve assets like LP or Gauge tokens and can lock veCRV for boosting Curve yields
 * @author Aave
 */
contract CurveTreasury is VersionedInitializable {
  using SafeERC20 for IERC20;

  address immutable VOTING_ESCROW;
  address immutable CRV_TOKEN;
  address immutable FEE_DISTRIBUTOR;
  address private _owner;

  uint256 public constant TREASURY_REVISION = 0x1;

  mapping(address => mapping(address => bool)) internal _entityTokenWhitelist;
  mapping(address => mapping(address => address)) internal _entityTokenGauge;

  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

  constructor(
    address _votingEscrow,
    address _crvToken,
    address _curveFeeDistributor
  ) public {
    VOTING_ESCROW = _votingEscrow;
    CRV_TOKEN = _crvToken;
    FEE_DISTRIBUTOR = _curveFeeDistributor;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(_owner == msg.sender, 'Ownable: caller is not the owner');
    _;
  }

  modifier onlyWhitelistedEntity(address token) {
    require(_entityTokenWhitelist[msg.sender][token] == true, 'ENTITY_NOT_WHITELISTED');
    _;
  }

  function initialize(
    address[] calldata entities,
    address[] calldata tokens,
    address[] calldata gauges,
    address owner
  ) external virtual initializer {
    _owner = owner;
    bool[] memory whitelisted = new bool[](entities.length);
    _setWhitelist(entities, tokens, gauges, whitelisted);
  }

  function getRevision() internal pure virtual override returns (uint256) {
    return TREASURY_REVISION;
  }

  function deposit(
    address token,
    uint256 amount,
    bool useGauge
  ) external onlyWhitelistedEntity(token) {
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    if (useGauge && _entityTokenGauge[msg.sender][token] != address(0)) {
      stakeGauge(_entityTokenGauge[msg.sender][token], amount);
    }
  }

  function withdraw(
    address token,
    uint256 amount,
    bool useGauge
  ) external onlyWhitelistedEntity(token) {
    if (useGauge && _entityTokenGauge[msg.sender][token] != address(0)) {
      unstakeGauge(_entityTokenGauge[msg.sender][token], amount);
    }
    IERC20(token).safeTransfer(msg.sender, amount);
  }

  function stakeGauge(address gauge, uint256 amount) internal {
    ICurveGauge(gauge).deposit(amount);
  }

  function unstakeGauge(address gauge, uint256 amount) internal {
    ICurveGauge(gauge).withdraw(amount);
  }

  /**
   * @dev Returns the address of the current owner.
   */
  function owner() external view returns (address) {
    return _owner;
  }

  /** Owner methods */
  function approve(
    address token,
    address to,
    uint256 amount
  ) external onlyOwner {
    IERC20(token).safeApprove(to, amount);
  }

  function transferFrom(
    address token,
    address from,
    address to,
    uint256 amount
  ) external onlyOwner {
    IERC20(token).safeTransferFrom(from, to, amount);
  }

  function setWhitelist(
    address[] calldata entities,
    address[] calldata tokens,
    address[] calldata gauges,
    bool[] memory whitelisted
  ) external onlyOwner {
    _setWhitelist(entities, tokens, gauges, whitelisted);
  }

  function _setWhitelist(
    address[] calldata entities,
    address[] calldata tokens,
    address[] calldata gauges,
    bool[] memory whitelisted
  ) internal {
    for (uint256 e; e < entities.length; e++) {
      _entityTokenWhitelist[entities[e]][tokens[e]] = whitelisted[e];
      IERC20(tokens[e]).safeApprove(entities[e], type(uint256).max);
      if (gauges[e] != address(0)) {
        IERC20(tokens[e]).safeApprove(gauges[e], type(uint256).max);
        _entityTokenGauge[entities[e]][tokens[e]] = gauges[e];
      }
    }
  }

  function claimCurveFees() external onlyOwner {
    ICurveFeeDistributor(FEE_DISTRIBUTOR).claim();
  }

  /** Owner methods related with veCRV to interact with Voting Escrow Curve contract */
  function lockCrv(uint256 amount, uint256 unlockTime) external onlyOwner {
    IERC20(CRV_TOKEN).safeApprove(VOTING_ESCROW, amount);
    IVotingEscrow(VOTING_ESCROW).create_lock(amount, unlockTime);
  }

  function unlockCrv(uint256 amount, uint256 unlockTime) external onlyOwner {
    IVotingEscrow(VOTING_ESCROW).withdraw();
  }

  function increaseLockedCrv(uint256 amount) external onlyOwner {
    IERC20(CRV_TOKEN).safeApprove(VOTING_ESCROW, amount);
    IVotingEscrow(VOTING_ESCROW).increase_amount(amount);
  }

  function increaseUnlockTimeCrv(uint256 unlockTime) external onlyOwner {
    IVotingEscrow(VOTING_ESCROW).increase_unlock_time(unlockTime);
  }

  /**
   * @dev Transfers ownership of the contract to a new account (`newOwner`).
   * Can only be called by the current owner.
   */
  function transferOwnership(address newOwner) external onlyOwner {
    require(newOwner != address(0), 'Ownable: new owner is the zero address');
    emit OwnershipTransferred(_owner, newOwner);
    _owner = newOwner;
  }
}

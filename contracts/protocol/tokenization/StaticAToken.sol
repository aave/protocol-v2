// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {IStaticAToken} from '../../interfaces/IStaticAToken.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IAToken} from '../../interfaces/IAToken.sol';
import {ERC20} from '../../dependencies/openzeppelin/contracts/ERC20.sol';
import {ReentrancyGuard} from '../../dependencies/openzeppelin/contracts/ReentrancyGuard.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {WadRayMath} from '../../protocol/libraries/math/WadRayMath.sol';
import {ErrorsStaticAToken} from '../../protocol/libraries/helpers/ErrorsStaticAToken.sol';

/**
 * @title StaticAToken
 * @dev Implementation of wrapper token that allows to deposit tokens on the Aave protocol and receive
 * a token which balance doesn't increase automatically, but uses an ever-increasing exchange rate
 * - Only supporting deposits and withdrawals
 * - It supports entering/exit with both underlying tokens and aTokens
 * @author Aave
 **/
contract StaticAToken is IStaticAToken, ReentrancyGuard, ERC20 {
  using SafeERC20 for IERC20;
  using WadRayMath for uint256;

  bytes public constant override EIP712_REVISION = bytes('1');
  bytes32 public constant override EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 public constant override PERMIT_TYPEHASH =
    keccak256('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)');
  bytes32 public constant override METADEPOSIT_TYPEHASH =
    keccak256(
      'Deposit(address depositor,address recipient,uint256 value,uint16 referralCode,bool fromUnderlying,uint256 nonce,uint256 deadline)'
    );
  bytes32 public constant override METAWITHDRAWAL_TYPEHASH =
    keccak256(
      'Withdraw(address owner,address recipient,uint256 staticAmount,uint256 dynamicAmount,bool toUnderlying,uint256 nonce,uint256 deadline)'
    );

  ILendingPool public immutable override LENDING_POOL;
  IERC20 public immutable override ATOKEN;
  IERC20 public immutable override ASSET;

  /// @dev owner => next valid nonce to submit with permit(), metaDeposit() and metaWithdraw()
  /// We choose to have sequentiality on them for each user to avoid potentially dangerous/bad UX cases
  mapping(address => uint256) public _nonces;

  constructor(
    ILendingPool lendingPool,
    address aToken,
    string memory wrappedTokenName,
    string memory wrappedTokenSymbol
  ) public ERC20(wrappedTokenName, wrappedTokenSymbol) {
    LENDING_POOL = lendingPool;
    ATOKEN = IERC20(aToken);
    (ASSET = IERC20(IAToken(aToken).UNDERLYING_ASSET_ADDRESS())).safeApprove(
      address(lendingPool),
      type(uint256).max
    );
  }

  /// @inheritdoc IStaticAToken
  function maxApproveLendingPool() external override {
    ASSET.safeApprove(address(LENDING_POOL), 0);
    ASSET.safeApprove(address(LENDING_POOL), type(uint256).max);
  }

  /// @inheritdoc IStaticAToken
  function deposit(
    address recipient,
    uint256 amount,
    uint16 referralCode,
    bool fromUnderlying
  ) external override nonReentrant returns (uint256) {
    return _deposit(msg.sender, recipient, amount, referralCode, fromUnderlying);
  }

  /// @inheritdoc IStaticAToken
  function withdraw(
    address recipient,
    uint256 amount,
    bool toUnderlying
  ) external override nonReentrant returns (uint256, uint256) {
    return _withdraw(msg.sender, recipient, amount, 0, toUnderlying);
  }

  /// @inheritdoc IStaticAToken
  function withdrawInDynamicAmount(
    address recipient,
    uint256 amount,
    bool toUnderlying
  ) external override nonReentrant returns (uint256, uint256) {
    return _withdraw(msg.sender, recipient, 0, amount, toUnderlying);
  }

  /// @inheritdoc IStaticAToken
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s,
    uint256 chainId
  ) external override {
    require(owner != address(0), ErrorsStaticAToken.INVALID_OWNER_ON_PERMIT);
    //solium-disable-next-line
    require(block.timestamp <= deadline, ErrorsStaticAToken.INVALID_EXPIRATION_ON_PERMIT);
    uint256 currentValidNonce = _nonces[owner];
    bytes32 digest =
      keccak256(
        abi.encodePacked(
          '\x19\x01',
          getDomainSeparator(chainId),
          keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, currentValidNonce, deadline))
        )
      );
    require(owner == ecrecover(digest, v, r, s), ErrorsStaticAToken.INVALID_SIGNATURE_ON_PERMIT);
    _nonces[owner] = currentValidNonce.add(1);
    _approve(owner, spender, value);
  }

  /// @inheritdoc IStaticAToken
  function metaDeposit(
    address depositor,
    address recipient,
    uint256 value,
    uint16 referralCode,
    bool fromUnderlying,
    uint256 deadline,
    SignatureParams calldata sigParams,
    uint256 chainId
  ) external override nonReentrant returns (uint256) {
    require(depositor != address(0), ErrorsStaticAToken.INVALID_DEPOSITOR_ON_METADEPOSIT);
    //solium-disable-next-line
    require(block.timestamp <= deadline, ErrorsStaticAToken.INVALID_EXPIRATION_ON_METADEPOSIT);
    uint256 currentValidNonce = _nonces[depositor];
    bytes32 digest =
      keccak256(
        abi.encodePacked(
          '\x19\x01',
          getDomainSeparator(chainId),
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
      ErrorsStaticAToken.INVALID_SIGNATURE_ON_METADEPOSIT
    );
    _nonces[depositor] = currentValidNonce.add(1);
    return _deposit(depositor, recipient, value, referralCode, fromUnderlying);
  }

  /// @inheritdoc IStaticAToken
  function metaWithdraw(
    address owner,
    address recipient,
    uint256 staticAmount,
    uint256 dynamicAmount,
    bool toUnderlying,
    uint256 deadline,
    SignatureParams calldata sigParams,
    uint256 chainId
  ) external override nonReentrant returns (uint256, uint256) {
    require(owner != address(0), ErrorsStaticAToken.INVALID_OWNER_ON_METAWITHDRAW);
    //solium-disable-next-line
    require(block.timestamp <= deadline, ErrorsStaticAToken.INVALID_EXPIRATION_ON_METAWITHDRAW);
    uint256 currentValidNonce = _nonces[owner];
    bytes32 digest =
      keccak256(
        abi.encodePacked(
          '\x19\x01',
          getDomainSeparator(chainId),
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
      ErrorsStaticAToken.INVALID_SIGNATURE_ON_METAWITHDRAW
    );
    _nonces[owner] = currentValidNonce.add(1);
    return _withdraw(owner, recipient, staticAmount, dynamicAmount, toUnderlying);
  }

  /// @inheritdoc IStaticAToken
  function dynamicBalanceOf(address account) external view override returns (uint256) {
    return staticToDynamicAmount(balanceOf(account));
  }

  /// @inheritdoc IStaticAToken
  function staticToDynamicAmount(uint256 amount) public view override returns (uint256) {
    return amount.rayMul(rate());
  }

  /// @inheritdoc IStaticAToken
  function dynamicToStaticAmount(uint256 amount) public view override returns (uint256) {
    return amount.rayDiv(rate());
  }

  /// @inheritdoc IStaticAToken
  function rate() public view override returns (uint256) {
    return LENDING_POOL.getReserveNormalizedIncome(address(ASSET));
  }

  /// @inheritdoc IStaticAToken
  function getDomainSeparator(uint256 chainId) public view override returns (bytes32) {
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

  function _deposit(
    address depositor,
    address recipient,
    uint256 amount,
    uint16 referralCode,
    bool fromUnderlying
  ) internal returns (uint256) {
    require(recipient != address(0), ErrorsStaticAToken.INVALID_ZERO_RECIPIENT);

    if (fromUnderlying) {
      ASSET.safeTransferFrom(depositor, address(this), amount);
      LENDING_POOL.deposit(address(ASSET), amount, address(this), referralCode);
    } else {
      ATOKEN.safeTransferFrom(depositor, address(this), amount);
    }

    uint256 amountToMint = dynamicToStaticAmount(amount);
    _mint(recipient, amountToMint);
    return amountToMint;
  }

  /**
   * @dev only one of `staticAmount` or `dynamicAmount` can be > 0 at a time. For gas optimization that
   * is verified not at the beginning, but in the conditional blocks before the tokens' burning
   **/
  function _withdraw(
    address owner,
    address recipient,
    uint256 staticAmount,
    uint256 dynamicAmount,
    bool toUnderlying
  ) internal returns (uint256, uint256) {
    require(recipient != address(0), ErrorsStaticAToken.INVALID_ZERO_RECIPIENT);

    uint256 userBalance = balanceOf(owner);

    uint256 amountToWithdraw;
    uint256 amountToBurn;

    uint256 currentRate = rate();

    if (staticAmount > 0) {
      require(dynamicAmount == 0, ErrorsStaticAToken.ONLY_ONE_INPUT_AMOUNT_AT_A_TIME);

      if (staticAmount > userBalance) {
        amountToBurn = userBalance;
        amountToWithdraw = _staticToDynamicAmount(userBalance, currentRate);
      } else {
        amountToBurn = staticAmount;
        amountToWithdraw = _staticToDynamicAmount(staticAmount, currentRate);
      }
    } else {
      uint256 dynamicUserBalance = _staticToDynamicAmount(userBalance, currentRate);
      amountToWithdraw = (dynamicAmount > dynamicUserBalance) ? dynamicUserBalance : dynamicAmount;
      amountToBurn = _dynamicToStaticAmount(amountToWithdraw, currentRate);
    }

    _burn(owner, amountToBurn);

    if (toUnderlying) {
      require(
        LENDING_POOL.withdraw(address(ASSET), amountToWithdraw, recipient) == amountToWithdraw,
        ErrorsStaticAToken.INCONSISTENT_WITHDRAWN_AMOUNT
      );
    } else {
      ATOKEN.safeTransfer(recipient, amountToWithdraw);
    }

    return (amountToBurn, amountToWithdraw);
  }

  function _dynamicToStaticAmount(uint256 amount, uint256 cachedRate)
    internal
    pure
    returns (uint256)
  {
    return amount.rayDiv(cachedRate);
  }

  function _staticToDynamicAmount(uint256 amount, uint256 cachedRate)
    internal
    pure
    returns (uint256)
  {
    return amount.rayMul(cachedRate);
  }
}

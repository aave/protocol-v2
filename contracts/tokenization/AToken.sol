// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {IncentivizedERC20} from './IncentivizedERC20.sol';
import {LendingPool} from '../lendingpool/LendingPool.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {
  VersionedInitializable
} from '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {IAToken} from './interfaces/IAToken.sol';
import {IERC20} from '../interfaces/IERC20.sol';
import {SafeERC20} from '../misc/SafeERC20.sol';

/**
 * @title Aave ERC20 AToken
 *
 * @dev Implementation of the interest bearing token for the DLP protocol.
 * @author Aave
 */
contract AToken is VersionedInitializable, IncentivizedERC20, IAToken {
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  bytes public constant EIP712_REVISION = bytes('1');
  bytes32 internal constant EIP712_DOMAIN = keccak256(
    'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
  );
  bytes32 public constant PERMIT_TYPEHASH = keccak256(
    'Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)'
  );

  uint256 public constant UINT_MAX_VALUE = uint256(-1);
  uint256 public constant ATOKEN_REVISION = 0x1;
  address public immutable UNDERLYING_ASSET_ADDRESS;
  address public immutable RESERVE_TREASURY_ADDRESS;
  LendingPool public immutable POOL;

  /// @dev owner => next valid nonce to submit with permit()
  mapping(address => uint256) public _nonces;

  bytes32 public DOMAIN_SEPARATOR;

  modifier onlyLendingPool {
    require(msg.sender == address(POOL), Errors.CALLER_MUST_BE_LENDING_POOL);
    _;
  }

  constructor(
    LendingPool pool,
    address underlyingAssetAddress,
    address reserveTreasuryAddress,
    string memory tokenName,
    string memory tokenSymbol,
    address incentivesController
  ) public IncentivizedERC20(tokenName, tokenSymbol, 18, incentivesController) {
    POOL = pool;
    UNDERLYING_ASSET_ADDRESS = underlyingAssetAddress;
    RESERVE_TREASURY_ADDRESS = reserveTreasuryAddress;
  }

  function getRevision() internal virtual override pure returns (uint256) {
    return ATOKEN_REVISION;
  }

  function initialize(
    uint8 underlyingAssetDecimals,
    string calldata tokenName,
    string calldata tokenSymbol
  ) external virtual initializer {
    uint256 chainId;

    //solium-disable-next-line
    assembly {
      chainId := chainid()
    }

    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        EIP712_DOMAIN,
        keccak256(bytes(tokenName)),
        keccak256(EIP712_REVISION),
        chainId,
        address(this)
      )
    );

    _setName(tokenName);
    _setSymbol(tokenSymbol);
    _setDecimals(underlyingAssetDecimals);
  }

  /**
   * @dev burns the aTokens and sends the equivalent amount of underlying to the target.
   * only lending pools can call this function
   * @param amount the amount being burned
   **/
  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    _burn(user, amount.rayDiv(index));

    //transfers the underlying to the target
    IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(receiverOfUnderlying, amount);

    //transfer event to track balances
    emit Transfer(user, address(0), amount);
    emit Burn(msg.sender, receiverOfUnderlying, amount, index);
  }

  /**
   * @dev mints aTokens to user
   * only lending pools can call this function
   * @param user the address receiving the minted tokens
   * @param amount the amount of tokens to mint
   */
  function mint(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    //mint an equivalent amount of tokens to cover the new deposit
    _mint(user, amount.rayDiv(index));

    //transfer event to track balances
    emit Transfer(address(0), user, amount);
    emit Mint(user, amount, index);
  }

  function mintToTreasury(uint256 amount, uint256 index) external override onlyLendingPool {
    _mint(RESERVE_TREASURY_ADDRESS, amount.div(index));

    //transfer event to track balances
    emit Transfer(address(0), RESERVE_TREASURY_ADDRESS, amount);
    emit Mint(RESERVE_TREASURY_ADDRESS, amount, index);
  }

  /**
   * @dev transfers tokens in the event of a borrow being liquidated, in case the liquidators reclaims the aToken
   *      only lending pools can call this function
   * @param from the address from which transfer the aTokens
   * @param to the destination address
   * @param value the amount to transfer
   **/
  function transferOnLiquidation(
    address from,
    address to,
    uint256 value
  ) external override onlyLendingPool {
    //being a normal transfer, the Transfer() and BalanceTransfer() are emitted
    //so no need to emit a specific event here
    _transfer(from, to, value, false);
  }

  /**
   * @dev calculates the balance of the user, which is the
   * principal balance + interest generated by the principal balance
   * @param user the user for which the balance is being calculated
   * @return the total balance of the user
   **/
  function balanceOf(address user)
    public
    override(IncentivizedERC20, IERC20)
    view
    returns (uint256)
  {
    return super.balanceOf(user).rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
  }

  /**
   * @dev returns the scaled balance of the user. The scaled balance is the sum of all the
   * updated stored balance divided the reserve index at the moment of the update
   * @param user the address of the user
   * @return the scaled balance of the user
   **/
  function scaledBalanceOf(address user) external override view returns (uint256) {
    return super.balanceOf(user);
  }

  /**
   * @dev returns the principal balance of the user and principal total supply.
   * @param user the address of the user
   * @return the principal balance of the user
   * @return the principal total supply
   **/
  function getScaledUserBalanceAndSupply(address user)
    external
    override
    view
    returns (uint256, uint256)
  {
    return (super.balanceOf(user), super.totalSupply());
  }

  /**
   * @dev calculates the total supply of the specific aToken
   * since the balance of every single user increases over time, the total supply
   * does that too.
   * @return the current total supply
   **/
  function totalSupply() public override(IncentivizedERC20, IERC20) view returns (uint256) {
    uint256 currentSupplyScaled = super.totalSupply();

    if (currentSupplyScaled == 0) {
      return 0;
    }

    return currentSupplyScaled.rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
  }

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(borrows/index)
   * @return the scaled total supply
   **/
  function scaledTotalSupply() public virtual override view returns (uint256) {
    return super.totalSupply();
  }

  /**
   * @dev Used to validate transfers before actually executing them.
   * @param user address of the user to check
   * @param amount the amount to check
   * @return true if the user can transfer amount, false otherwise
   **/
  function isTransferAllowed(address user, uint256 amount) public override view returns (bool) {
    return POOL.balanceDecreaseAllowed(UNDERLYING_ASSET_ADDRESS, user, amount);
  }

  /**
   * @dev transfers the underlying asset to the target. Used by the lendingpool to transfer
   * assets in borrow(), redeem() and flashLoan()
   * @param target the target of the transfer
   * @param amount the amount to transfer
   * @return the amount transferred
   **/
  function transferUnderlyingTo(address target, uint256 amount)
    external
    override
    onlyLendingPool
    returns (uint256)
  {
    IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(target, amount);
    return amount;
  }

  /**
   * @dev implements the permit function as for https://github.com/ethereum/EIPs/blob/8a34d644aacf0f9f8f00815307fd7dd5da07655f/EIPS/eip-2612.md
   * @param owner the owner of the funds
   * @param spender the spender
   * @param value the amount
   * @param deadline the deadline timestamp, type(uint256).max for max deadline
   * @param v signature param
   * @param s signature param
   * @param r signature param
   */
  function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external {
    require(owner != address(0), 'INVALID_OWNER');
    //solium-disable-next-line
    require(block.timestamp <= deadline, 'INVALID_EXPIRATION');
    uint256 currentValidNonce = _nonces[owner];
    bytes32 digest = keccak256(
      abi.encodePacked(
        '\x19\x01',
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, currentValidNonce, deadline))
      )
    );
    require(owner == ecrecover(digest, v, r, s), 'INVALID_SIGNATURE');
    _nonces[owner] = currentValidNonce.add(1);
    _approve(owner, spender, value);
  }

  /**
   * @dev transfers the aTokens between two users. Validates the transfer
   * (ie checks for valid HF after the transfer) if required
   * @param from the source address
   * @param to the destination address
   * @param amount the amount to transfer
   * @param validate true if the transfer needs to be validated
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount,
    bool validate
  ) internal {
    if (validate) {
      require(isTransferAllowed(from, amount), Errors.TRANSFER_NOT_ALLOWED);
    }

    uint256 index = POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS);

    super._transfer(from, to, amount.rayDiv(index));

    emit BalanceTransfer(from, to, amount, index);
  }

  /**
   * @dev overrides the parent _transfer to force validated transfer() and transferFrom()
   * @param from the source address
   * @param to the destination address
   * @param amount the amount to transfer
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    _transfer(from, to, amount, true);
  }

  /**
   * @dev aTokens should not receive ETH
   **/
  receive() external payable {
    revert();
  }
}

// SPDX - License - Identifier: agpl - 3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {IAToken} from '../../../interfaces/IAToken.sol';
import {WadRayMath} from '../../libraries/math/WadRayMath.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {
  VersionedInitializable
} from '../../libraries/aave-upgradeability/VersionedInitializable.sol';
import {IncentivizedERC20} from '../IncentivizedERC20.sol';
import {IAaveIncentivesController} from '../../../interfaces/IAaveIncentivesController.sol';
import {DataTypes} from '../../libraries/types/DataTypes.sol';
import {ISTETH} from '../../../interfaces/ISTETH.sol';
import {SignedSafeMath} from '../../../dependencies/openzeppelin/contracts/SignedSafeMath.sol';
import {UInt256Lib} from '../../../dependencies/uFragments/UInt256Lib.sol';

interface IBookKeptBorrowing {
  /**
   * @dev get (total supply of borrowing, current amount of borrowed shares)
   **/
  function getBorrowData() external view returns (uint256, int256);
}

/**
 * @title Aave ERC20 AToken
 * @dev Implementation of the interest bearing token for the Aave protocol
 * @author Aave
 */
contract AStETH is VersionedInitializable, IncentivizedERC20, IAToken {
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;
  using UInt256Lib for uint256;
  using SignedSafeMath for int256;

  bytes public constant EIP712_REVISION = bytes('1');
  bytes32 internal constant EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)');

  uint256 public constant UINT_MAX_VALUE = uint256(-1);
  uint256 public constant ATOKEN_REVISION = 0x1;
  address public immutable UNDERLYING_ASSET_ADDRESS;
  address public immutable RESERVE_TREASURY_ADDRESS;
  ILendingPool public immutable POOL;

  /// @dev owner => next valid nonce to submit with permit()
  mapping(address => uint256) public _nonces;

  bytes32 public DOMAIN_SEPARATOR;

  // =============================================
  // StETH specific data
  IBookKeptBorrowing internal _variableDebtStETH;
  int256 internal _totalShares;

  struct ExtData {
    uint256 totalStETHSupply;
    uint256 totalPrincipalBorrowed;
    int256 totalSharesBorrowed;
  }
  // ============================================

  modifier onlyLendingPool() {
    require(_msgSender() == address(POOL), Errors.CT_CALLER_MUST_BE_LENDING_POOL);
    _;
  }

  constructor(
    ILendingPool pool,
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

  function getRevision() internal pure virtual override returns (uint256) {
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

  function initializeDebtToken() external {
    DataTypes.ReserveData memory reserveData = POOL.getReserveData(UNDERLYING_ASSET_ADDRESS);
    _variableDebtStETH = IBookKeptBorrowing(reserveData.variableDebtTokenAddress);
  }

  /**
   * @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
   * - Only callable by the LendingPool, as extra state updates there need to be managed
   * @param user The owner of the aTokens, getting them burned
   * @param receiverOfUnderlying The address that will receive the underlying
   * @param amount The amount being burned
   * @param index The new liquidity index of the reserve
   **/
  function burn(
    address user,
    address receiverOfUnderlying,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool {
    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_BURN_AMOUNT);

    _burnScaled(user, amountScaled, _fetchExtData());
    _totalShares = _totalShares.sub(
      ISTETH(UNDERLYING_ASSET_ADDRESS).getSharesByPooledEth(amountScaled).toInt256Safe()
    );

    IERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(receiverOfUnderlying, amount);

    emit Transfer(user, address(0), amount);
    emit Burn(user, receiverOfUnderlying, amount, index);
  }

  /**
   * @dev Mints `amount` aTokens to `user`
   * - Only callable by the LendingPool, as extra state updates there need to be managed
   * @param user The address receiving the minted tokens
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   * @return `true` if the the previous balance of the user was 0
   */
  function mint(
    address user,
    uint256 amount,
    uint256 index
  ) external override onlyLendingPool returns (bool) {
    uint256 previousBalance = super.balanceOf(user);

    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    _mintScaled(user, amountScaled, _fetchExtData());
    _totalShares = _totalShares.add(
      ISTETH(UNDERLYING_ASSET_ADDRESS).getSharesByPooledEth(amountScaled).toInt256Safe()
    );

    emit Transfer(address(0), user, amount);
    emit Mint(user, amount, index);

    return previousBalance == 0;
  }

  /**
   * @dev Mints aTokens to the reserve treasury
   * - Only callable by the LendingPool
   * @param amount The amount of tokens getting minted
   * @param index The new liquidity index of the reserve
   */
  function mintToTreasury(uint256 amount, uint256 index) external override onlyLendingPool {
    if (amount == 0) {
      return;
    }

    address treasury = RESERVE_TREASURY_ADDRESS;

    // Compared to the normal mint, we don't check for rounding errors.
    // The amount to mint can easily be very small since it is a fraction of the interest ccrued.
    // In that case, the treasury will experience a (very small) loss, but it
    // wont cause potentially valid transactions to fail.
    uint256 amountScaled = amount.rayDiv(index);
    _mintScaled(treasury, amountScaled, _fetchExtData());
    _totalShares = _totalShares.add(
      ISTETH(UNDERLYING_ASSET_ADDRESS).getSharesByPooledEth(amountScaled).toInt256Safe()
    );

    emit Transfer(address(0), treasury, amount);
    emit Mint(treasury, amount, index);
  }

  /**
   * @dev Transfers aTokens in the event of a borrow being liquidated, in case the liquidators reclaims the aToken
   * - Only callable by the LendingPool
   * @param from The address getting liquidated, current owner of the aTokens
   * @param to The recipient
   * @param value The amount of tokens getting transferred
   **/
  function transferOnLiquidation(
    address from,
    address to,
    uint256 value
  ) external override onlyLendingPool {
    // Being a normal transfer, the Transfer() and BalanceTransfer() are emitted
    // so no need to emit a specific event here
    _transfer(from, to, value, false);

    emit Transfer(from, to, value);
  }

  /**
   * @dev Calculates the balance of the user: principal balance + interest generated by the principal
   * @param user The user whose balance is calculated
   * @return The balance of the user
   **/
  function balanceOf(address user)
    public
    view
    override(IncentivizedERC20, IERC20)
    returns (uint256)
  {
    uint256 userBalanceScaled =
      _scaledBalanceOf(
        super.balanceOf(user),
        super.totalSupply(),
        _scaledTotalSupply(_fetchExtData())
      );

    if (userBalanceScaled == 0) {
      return 0;
    }

    return userBalanceScaled.rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
  }

  /**
   * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
   * updated stored balance divided by the reserve's liquidity index at the moment of the update
   * @param user The user whose balance is calculated
   * @return The scaled balance of the user
   **/
  function scaledBalanceOf(address user) external view override returns (uint256) {
    return
      _scaledBalanceOf(
        super.balanceOf(user),
        super.totalSupply(),
        _scaledTotalSupply(_fetchExtData())
      );
  }

  /**
   * @dev Returns the scaled balance of the user and the scaled total supply.
   * @param user The address of the user
   * @return The scaled balance of the user
   * @return The scaled balance and the scaled total supply
   **/
  function getScaledUserBalanceAndSupply(address user)
    external
    view
    override
    returns (uint256, uint256)
  {
    uint256 scaledTotalSupply = _scaledTotalSupply(_fetchExtData());
    return (
      _scaledBalanceOf(super.balanceOf(user), super.totalSupply(), scaledTotalSupply),
      scaledTotalSupply
    );
  }

  /**
   * @dev calculates the total supply of the specific aToken
   * since the balance of every single user increases over time, the total supply
   * does that too.
   * @return the current total supply
   **/
  function totalSupply() public view override(IncentivizedERC20, IERC20) returns (uint256) {
    uint256 currentSupplyScaled = _scaledTotalSupply(_fetchExtData());

    if (currentSupplyScaled == 0) {
      return 0;
    }

    return currentSupplyScaled.rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
  }

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
   * @return the scaled total supply
   **/
  function scaledTotalSupply() public view virtual override returns (uint256) {
    return _scaledTotalSupply(_fetchExtData());
  }

  /**
   * @dev Transfers the underlying asset to `target`. Used by the LendingPool to transfer
   * assets in borrow(), withdraw() and flashLoan()
   * @param target The recipient of the aTokens
   * @param amount The amount getting transferred
   * @return The amount transferred
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
   * @dev implements the permit function as for
   * https://github.com/ethereum/EIPs/blob/8a34d644aacf0f9f8f00815307fd7dd5da07655f/EIPS/eip-2612.md
   * @param owner The owner of the funds
   * @param spender The spender
   * @param value The amount
   * @param deadline The deadline timestamp, type(uint256).max for max deadline
   * @param v Signature param
   * @param s Signature param
   * @param r Signature param
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
    bytes32 digest =
      keccak256(
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
   * @dev Transfers the aTokens between two users. Validates the transfer
   * (ie checks for valid HF after the transfer) if required
   * @param from The source address
   * @param to The destination address
   * @param amount The amount getting transferred
   * @param validate `true` if the transfer needs to be validated
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount,
    bool validate
  ) internal {
    uint256 index = POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS);
    uint256 amountScaled = amount.rayDiv(index);

    ExtData memory e = _fetchExtData();
    uint256 totalSupplyInternal = super.totalSupply();

    uint256 scaledTotalSupply = _scaledTotalSupply(e);
    uint256 fromBalanceScaled =
      _scaledBalanceOf(super.balanceOf(from), totalSupplyInternal, scaledTotalSupply);
    uint256 toBalanceScaled =
      _scaledBalanceOf(super.balanceOf(to), totalSupplyInternal, scaledTotalSupply);

    _transferScaled(from, to, amountScaled, e);

    if (validate) {
      POOL.finalizeTransfer(
        UNDERLYING_ASSET_ADDRESS,
        from,
        to,
        amount,
        fromBalanceScaled.rayMul(index),
        toBalanceScaled.rayMul(index)
      );
    }

    emit BalanceTransfer(from, to, amount, index);
  }

  /**
   * @dev Overrides the parent _transfer to force validated transfer() and transferFrom()
   * @param from The source address
   * @param to The destination address
   * @param amount The amount getting transferred
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    _transfer(from, to, amount, true);
  }

  // =============================================
  // StETH specific functions

  /**
   * @dev mintAmountInternal is mint such that the following holds true
   *
   * (userBalanceInternalBefore+mintAmountInternal)/(totalSupplyInternalBefore+mintAmountInternal)
   *    = (userBalanceScaledBefore+mintAmountScaled)/(scaledTotalSupplyBefore+mintAmountScaled)
   *
   * scaledTotalSupplyAfter = scaledTotalSupplyBefore+mintAmountScaled
   * userBalanceScaledAfter = userBalanceScaledBefore+mintAmountScaled
   * otherBalanceScaledBefore = scaledTotalSupplyBefore-userBalanceScaledBefore
   *
   * a = totalSupplyInternalBefore * userBalanceScaledAfter
   * b = scaledTotalSupplyAfter * userBalanceInternalBefore
   * mintAmountInternal = (a - b) / otherBalanceScaledBefore
   **/
  function _mintScaled(
    address user,
    uint256 mintAmountScaled,
    ExtData memory e
  ) internal {
    uint256 totalSupplyInternalBefore = super.totalSupply();
    uint256 userBalanceInternalBefore = super.balanceOf(user);

    // First mint
    if (totalSupplyInternalBefore == 0) {
      _mint(user, ISTETH(UNDERLYING_ASSET_ADDRESS).getSharesByPooledEth(mintAmountScaled));
      return;
    }

    uint256 scaledTotalSupplyBefore = _scaledTotalSupply(e);

    uint256 userBalanceScaledBefore =
      _scaledBalanceOf(
        userBalanceInternalBefore,
        totalSupplyInternalBefore,
        scaledTotalSupplyBefore
      );
    uint256 otherBalanceScaledBefore = scaledTotalSupplyBefore.sub(userBalanceScaledBefore);

    uint256 scaledTotalSupplyAfter = scaledTotalSupplyBefore.add(mintAmountScaled);
    uint256 userBalanceScaledAfter = userBalanceScaledBefore.add(mintAmountScaled);
    uint256 mintAmountInternal = 0;

    // Lone user
    if (otherBalanceScaledBefore == 0) {
      uint256 mintAmountInternal =
        mintAmountScaled.mul(totalSupplyInternalBefore).div(scaledTotalSupplyBefore);
      _mint(user, mintAmountInternal);
      return;
    }

    mintAmountInternal = totalSupplyInternalBefore
      .mul(userBalanceScaledAfter)
      .sub(scaledTotalSupplyAfter.mul(userBalanceInternalBefore))
      .div(otherBalanceScaledBefore);

    _mint(user, mintAmountInternal);
  }

  /**
   * @dev burnAmountInternal is burnt such that the following holds true
   *
   * (userBalanceInternalBefore-burnAmountInternal)/(totalSupplyInternalBefore-burnAmountInternal)
   *    = (userBalanceScaledBefore-burnAmountScaled)/(scaledTotalSupplyBefore-burnAmountScaled)
   *
   * scaledTotalSupplyAfter = scaledTotalSupplyBefore-burnAmountScaled
   * userBalanceScaledAfter = userBalanceScaledBefore-burnAmountScaled
   * otherBalanceScaledBefore = scaledTotalSupplyBefore-userBalanceScaledBefore
   *
   * a = scaledTotalSupplyAfter * userBalanceInternalBefore
   * b = totalSupplyInternalBefore * userBalanceScaledAfter
   * burnAmountInternal = (a - b) / otherBalanceScaledBefore
   **/
  function _burnScaled(
    address user,
    uint256 burnAmountScaled,
    ExtData memory e
  ) internal {
    uint256 totalSupplyInternalBefore = super.totalSupply();
    uint256 userBalanceInternalBefore = super.balanceOf(user);

    uint256 scaledTotalSupplyBefore = _scaledTotalSupply(e);
    uint256 userBalanceScaledBefore =
      _scaledBalanceOf(
        userBalanceInternalBefore,
        totalSupplyInternalBefore,
        scaledTotalSupplyBefore
      );
    uint256 otherBalanceScaledBefore = scaledTotalSupplyBefore.sub(userBalanceScaledBefore);

    uint256 scaledTotalSupplyAfter = 0;
    if (burnAmountScaled <= scaledTotalSupplyBefore) {
      scaledTotalSupplyAfter = scaledTotalSupplyBefore.sub(burnAmountScaled);
    }

    uint256 userBalanceScaledAfter = 0;
    if (burnAmountScaled <= userBalanceScaledBefore) {
      userBalanceScaledAfter = userBalanceScaledBefore.sub(burnAmountScaled);
    }

    uint256 burnAmountInternal = 0;

    // Lone user
    if (otherBalanceScaledBefore == 0) {
      _burn(user, burnAmountScaled.mul(totalSupplyInternalBefore).div(scaledTotalSupplyBefore));
      return;
    }

    burnAmountInternal = scaledTotalSupplyAfter
      .mul(userBalanceInternalBefore)
      .sub(totalSupplyInternalBefore.mul(userBalanceScaledAfter))
      .div(otherBalanceScaledBefore);

    _burn(user, burnAmountInternal);
  }

  /**
   * @dev Queries external contracts and fetches data used for aTokenMath
   *      - total supply of stETH
   *      - principal borrowed and borrowed shares from the variable debt contract
   **/
  function _fetchExtData() internal view returns (ExtData memory) {
    ExtData memory extData;

    extData.totalStETHSupply = ISTETH(UNDERLYING_ASSET_ADDRESS).totalSupply();
    (extData.totalPrincipalBorrowed, extData.totalSharesBorrowed) = _variableDebtStETH
      .getBorrowData();

    return extData;
  }

  /**
   * @dev balance of user with according to the amount of tokens
   **/
  function _scaledBalanceOf(
    uint256 _intBalanceOf,
    uint256 _intTotalSupply,
    uint256 _scaledTotalSupply
  ) private pure returns (uint256) {
    if (_intBalanceOf == 0 || _intTotalSupply == 0) {
      return 0;
    }
    return _intBalanceOf.wadMul(_scaledTotalSupply).wadDiv(_intTotalSupply);
  }

  /**
   * @dev heldShares = _totalShares - _borrowedShares
   *      heldStETH = stETH.getPooledEthByShares(heldShares)
   *      _scaledTotalSupply = heldStETH + _borrowedStETH
   **/
  function _scaledTotalSupply(ExtData memory e) private view returns (uint256) {
    return
      ISTETH(UNDERLYING_ASSET_ADDRESS).getPooledEthByShares(
        uint256(_totalShares - e.totalSharesBorrowed)
      ) + e.totalPrincipalBorrowed;
  }

  /**
   * @dev transferAmountInternal = (transferAmountScaled * totalSupplyInternal) / scaledTotalSupply
   **/
  function _transferScaled(
    address from,
    address to,
    uint256 transferAmountScaled,
    ExtData memory e
  ) private {
    uint256 totalSupplyInternal = super.totalSupply();
    uint256 scaledTotalSupply = _scaledTotalSupply(e);
    uint256 transferAmountInternal =
      transferAmountScaled.mul(totalSupplyInternal).div(scaledTotalSupply);
    super._transfer(from, to, transferAmountInternal);
  }

  function VARIABLE_DEBT_TOKEN_ADDRESS() external view returns (address) {
    return address(_variableDebtStETH);
  }
}

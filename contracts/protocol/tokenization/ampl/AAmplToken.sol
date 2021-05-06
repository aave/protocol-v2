// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {ILendingPool} from '../../../interfaces/ILendingPool.sol';
import {IAToken} from '../../../interfaces/IAToken.sol';
import {WadRayMath} from '../../libraries/math/WadRayMath.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {VersionedInitializable} from '../../libraries/aave-upgradeability/VersionedInitializable.sol';
import {IncentivizedERC20} from '../IncentivizedERC20.sol';
import {DataTypes} from '../../libraries/types/DataTypes.sol';
import {SignedSafeMath} from '../../../dependencies/openzeppelin/contracts/SignedSafeMath.sol';
import {UInt256Lib} from '../../../dependencies/uFragments/UInt256Lib.sol';
import {DataTypes} from '../../libraries/types/DataTypes.sol';

interface IAMPLDebtToken {
  function getAMPLBorrowData() external view returns (uint256, int256);
}

/**

  @title Aave-AMPL ERC20 AToken
  @dev Implementation of the interest bearing AMPL token for the Aave protocol
  @author AmpleforthOrg

  The AMPL AToken externally behaves similar to every other aTOKEN. It always maintains a 1:1 peg with
  the underlying AMPL. The following should always be true.

  1) At any time, user can deposit x AMPLs to mint x aAMPLs.
     Total aAMPL supply increases by exactly x.
  2) At any time, user can burn x aAMPLs for x AMPLs.
     Total aAMPL supply decreases by exactly x.
  3) At any time, userA can transfer x aAMPLs to userB.
     userA's aAMPL balance reduces by X.
     userB's aAMPL balance increases by X.
     Total aAMPL supply exactly remains same.
  4) When AMPL's supply rebases, only the 'unborrowed' aAMPL should rebase.
      * Say there are 1000 aAMPL, and 200 AMPL is lent out. AMPL expands by 10%.
        Thew new aAMPL supply should be 1080 aAMPL.
      * Say there are 1000 aAMPL, and 200 AMPL is lent out. AMPL contracts by 10%.
        Thew new aAMPL supply should be 920 aAMPL.
  5) When AMPL's supply rebases, only the part of the balance of a user proportional to  the available liquidity ('unborrowed') should rebase.
      * Say a user has deposited 1000 AMPL and receives 1000 aAMPL, and
        20% of the total underlying AMPL is lent out. AMPL expands by 10%.
        The new aAMPL user balance should be 1080 aAMPL.
      * Say a user has deposited 1000 AMPL and receives 1000 aAMPL, and
        20% of the total underlying AMPL is lent out. AMPL contracts by 10%.
        The new aAMPL supply should be 920 aAMPL.
  6) The totalSupply of aAMPL should always be equal to (total AMPL held in the system) + (total principal borrowed denominated in AMPL) + (interest)


  Generic aToken:

  ATokens have a private balance and public balance.

  ```
    # _balances[u] and _totalSupply from contract storage.
    Balance(u) = _balances[u] . I
    TotalSupply(supply) = _totalSupply . I
  ```

  The internal (fixed-supply) balance and totalSupply are referred to as balanceScaled and scaledTotalSupply
  and correspond to the principal deposited.

  The external (elastic-supply) balance and totalSupply correspond to the principal + interest.


  AAMPL:

  AAMPL tokens have an additional scaling factor (multiplier) on top of the existing AToken structure.
  Thus they have 2 private balances and 1 public balance.

    * The internal (fixed-supply) balance and totalSupply are referred to as balanceInternal and
      totalSupplyInternal, used for book-keeping.

    * The internal (elastic-supply) balance and totalSupply are referred to as balanceScaled and
      scaledTotalSupply and correspond to the principal deposited.

    * The external (elastic-supply) balance and totalSupply correspond to the principal + interest.

  ```
    # _balances[u] and _totalSupply from contract storage.

    Balance(u) = ( _balances[u] . λ ) . I

    where,

    * _balances[u] is called userBalanceInternal, raw value in contract's storage

    * (_balances[u] . λ) is called userBalanceScaled, aka principal deposited

    * (_balances[u] . λ) . I  is the public userBalance, aka user's principal + interest

    * I is AAVE's interest rate factor

    * λ is the AAMPL scaling factor


    AND

    TotalSupply(u) = ( _totalSupply[u] . λ ) . I

    * _totalSupply[u] is called totalSupplyInternal, raw value in contract's storage

    * (_totalSupply[u] . λ) is called scaledTotalSupply, aka principal deposited

    * (_totalSupply[u] . λ) . I  is the public totalSupply, aka principal + interest

    * I is AAVE's interest rate factor

    * λ is the AAMPL scaling factor

  ```

  The AAMPL scaling factor λ is calculated as follows:

  ```
    * Λ - Ampleforth co-efficient of expansion (retrieved from the AMPL contract)

    scaledTotalSupply = (totalGonsDeposited - totalGonsBorrowed) / Λ + totalPrincipalBorrowed

    λ = scaledTotalSupply / totalSupplyInternal
  ```

  Additions:
    * The AAMPLToken stores references to the STABLE_DEBT_TOKEN,
      and the VARIABLE_DEBT_TOKEN contracts to calculate the total
      Principal borrowed (getAMPLBorrowData()), at any time.
    * On mint and burn a private variable `_totalGonsDeposited`
      keeps track of the scaled AMPL principal deposited.
 */
contract AAmplToken is VersionedInitializable, IncentivizedERC20, IAToken {
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;
  using UInt256Lib for uint256;
  using SignedSafeMath for int256;

  bytes public constant EIP712_REVISION = bytes('1');
  bytes32 internal constant EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)');

  uint256 public constant ATOKEN_REVISION = 0x1;
  address public immutable UNDERLYING_ASSET_ADDRESS;
  address public immutable RESERVE_TREASURY_ADDRESS;
  ILendingPool public immutable POOL;

  /// @dev owner => next valid nonce to submit with permit()
  mapping(address => uint256) public _nonces;

  bytes32 public DOMAIN_SEPARATOR;

  // ---------------------------------------------------------------------------
  // aAMPL additions
  address public STABLE_DEBT_TOKEN_ADDRESS;
  address public VARIABLE_DEBT_TOKEN_ADDRESS;

  // This is a constant on the AMPL contract, which is used to calculate the scalar
  // which controls the AMPL expansion/contraction.
  // TOTAL_GONS/ampl.scaledTotalSupply, saving an external call to the AMPL contract
  // and setting it as a local contract constant.
  // NOTE: This should line up EXACTLY with the value on the AMPL contract
  uint256 private constant GONS_TOTAL_SUPPLY = uint256(type(int128).max);

  // Keeps track of the 'gons' deposited into the aave system
  int256 private _totalGonsDeposited;

  struct ExtData {
    uint256 totalAMPLSupply;
    uint256 totalPrincipalBorrowed;
    int256 totalGonsBorrowed;
  }
  // ---------------------------------------------------------------------------

  modifier onlyLendingPool {
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

  function initializeDebtTokens () external {
    require(STABLE_DEBT_TOKEN_ADDRESS == address(0) && VARIABLE_DEBT_TOKEN_ADDRESS == address(0));

    DataTypes.ReserveData memory reserveData = ILendingPool(POOL).getReserveData(UNDERLYING_ASSET_ADDRESS);
    STABLE_DEBT_TOKEN_ADDRESS = reserveData.stableDebtTokenAddress;
    VARIABLE_DEBT_TOKEN_ADDRESS = reserveData.variableDebtTokenAddress;
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

    ExtData memory e = _fetchExtData();
    _burnScaled(user, amountScaled, e);
    _totalGonsDeposited = _totalGonsDeposited.sub(
      _amplToGons(e.totalAMPLSupply, amountScaled).toInt256Safe()
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
    uint256 previousBalanceInternal = super.balanceOf(user);

    uint256 amountScaled = amount.rayDiv(index);
    require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    ExtData memory e = _fetchExtData();
    _mintScaled(user, amountScaled, e);
    _totalGonsDeposited = _totalGonsDeposited.add(
      _amplToGons(e.totalAMPLSupply, amountScaled).toInt256Safe()
    );

    emit Transfer(address(0), user, amount);
    emit Mint(user, amount, index);

    return previousBalanceInternal == 0;
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

    // Compared to the normal mint, we don't check for rounding errors.
    // The amount to mint can easily be very small since it is a fraction of the interest accrued.
    // In that case, the treasury will experience a (very small) loss, but it
    // wont cause potentially valid transactions to fail.
    uint256 amountScaled = amount.rayDiv(index);
    // require(amountScaled != 0, Errors.CT_INVALID_MINT_AMOUNT);

    ExtData memory e = _fetchExtData();
    _mintScaled(RESERVE_TREASURY_ADDRESS, amountScaled, e);
    _totalGonsDeposited = _totalGonsDeposited.add(
      _amplToGons(e.totalAMPLSupply, amountScaled).toInt256Safe()
    );

    emit Transfer(address(0), RESERVE_TREASURY_ADDRESS, amount);
    emit Mint(RESERVE_TREASURY_ADDRESS, amount, index);
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

    uint256 scaledTotalSupply = _scaledTotalSupply(e, _totalGonsDeposited);
    uint256 fromBalanceScaled = _scaledBalanceOf(super.balanceOf(from), totalSupplyInternal, scaledTotalSupply);
    uint256 toBalanceScaled = _scaledBalanceOf(super.balanceOf(to), totalSupplyInternal, scaledTotalSupply);

    uint256 fromBalanceBefore = fromBalanceScaled.rayMul(index);
    uint256 toBalanceBefore = toBalanceScaled.rayMul(index);

    _transferScaled(from, to, amountScaled, e);

    if (validate) {
      POOL.finalizeTransfer(
        UNDERLYING_ASSET_ADDRESS,
        from,
        to,
        amount,
        fromBalanceBefore,
        toBalanceBefore
      );
    }

    emit BalanceTransfer(from, to, amount, index);
  }

  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    _transfer(from, to, amount, true);
  }

  // ---------------------------------------------------------------------------
  // View methods

  /**
   * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
   *      aka, scaledTotalSupply = (totalGonsDeposited - totalGonsBorrowed) / Λ + totalPrincipalBorrowed
   * @return the scaled total supply
   **/
  function scaledTotalSupply() public view virtual override returns (uint256) {
    return _scaledTotalSupply(_fetchExtData(), _totalGonsDeposited);
  }

  /**
   * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
   *      updated stored balance divided by the reserve's liquidity index at the moment of the update.
   *      aka, userBalanceScaled = userBalanceInternal/totalSupplyInternal * scaledTotalSupply
   * @param user The user whose balance is calculated
   * @return The scaled balance of the user
   **/
  function scaledBalanceOf(address user) external view override returns (uint256) {
    return _scaledBalanceOf(
      super.balanceOf(user), super.totalSupply(),
      _scaledTotalSupply(_fetchExtData(), _totalGonsDeposited)
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
    uint256 scaledTotalSupply = _scaledTotalSupply(_fetchExtData(), _totalGonsDeposited);
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
    uint256 currentSupplyScaled = _scaledTotalSupply(_fetchExtData(), _totalGonsDeposited);

    if (currentSupplyScaled == 0) {
      // currentSupplyInternal should also be zero in this case (super.totalSupply())
      return 0;
    }

    return currentSupplyScaled.rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
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
    uint256 userBalanceScaled = _scaledBalanceOf(
      super.balanceOf(user), super.totalSupply(),
      _scaledTotalSupply(_fetchExtData(), _totalGonsDeposited)
    );
    return userBalanceScaled.rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
  }


  // ---------------------------------------------------------------------------
  // AAMPL custom methods

  /**
   * @dev transferAmountInternal = (transferAmountScaled * totalSupplyInternal) / scaledTotalSupply
   **/
  function _transferScaled(address from, address to, uint256 transferAmountScaled, ExtData memory e) private returns (uint256) {
    uint256 totalSupplyInternal = super.totalSupply();
    uint256 scaledTotalSupply = _scaledTotalSupply(e, _totalGonsDeposited);
    uint256 transferAmountInternal = transferAmountScaled.mul(totalSupplyInternal).div(scaledTotalSupply);
    super._transfer(from, to, transferAmountInternal);
  }

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
   * mintAmountInternal = (totalSupplyInternalBefore*userBalanceScaledAfter - scaledTotalSupplyAfter*userBalanceInternalBefore)/otherBalanceScaledBefore
   **/
  function _mintScaled(address user, uint256 mintAmountScaled, ExtData memory e) private {
    uint256 totalSupplyInternalBefore = super.totalSupply();
    uint256 userBalanceInternalBefore = super.balanceOf(user);

    // First mint
    if(totalSupplyInternalBefore == 0) {
      uint256 mintAmountInternal = _amplToGons(e.totalAMPLSupply, mintAmountScaled);
      _mint(user, mintAmountInternal);
      return;
    }

    uint256 scaledTotalSupplyBefore = _scaledTotalSupply(e, _totalGonsDeposited);

    uint256 userBalanceScaledBefore = _scaledBalanceOf(userBalanceInternalBefore, totalSupplyInternalBefore, scaledTotalSupplyBefore);
    uint256 otherBalanceScaledBefore = scaledTotalSupplyBefore.sub(userBalanceScaledBefore);

    uint256 scaledTotalSupplyAfter = scaledTotalSupplyBefore.add(mintAmountScaled);
    uint256 userBalanceScaledAfter = userBalanceScaledBefore.add(mintAmountScaled);
    uint256 mintAmountInternal = 0;

    // Lone user
    if(otherBalanceScaledBefore == 0) {
      uint256 mintAmountInternal = mintAmountScaled.mul(totalSupplyInternalBefore).div(scaledTotalSupplyBefore);
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
   * burnAmountInternal = (scaledTotalSupplyAfter*userBalanceInternalBefore - totalSupplyInternalBefore*userBalanceScaledAfter)/otherBalanceScaledBefore
   **/
  function _burnScaled(address user, uint256 burnAmountScaled, ExtData memory e) private {
    uint256 totalSupplyInternalBefore = super.totalSupply();
    uint256 userBalanceInternalBefore = super.balanceOf(user);

    uint256 scaledTotalSupplyBefore = _scaledTotalSupply(e, _totalGonsDeposited);
    uint256 userBalanceScaledBefore = _scaledBalanceOf(userBalanceInternalBefore, totalSupplyInternalBefore, scaledTotalSupplyBefore);
    uint256 otherBalanceScaledBefore = scaledTotalSupplyBefore.sub(userBalanceScaledBefore);

    uint256 scaledTotalSupplyAfter = scaledTotalSupplyBefore.sub(burnAmountScaled);
    uint256 userBalanceScaledAfter = userBalanceScaledBefore.sub(burnAmountScaled);
    uint256 burnAmountInternal = 0;

    // Lone user
    if(otherBalanceScaledBefore == 0) {
      uint256 burnAmountInternal = burnAmountScaled.mul(totalSupplyInternalBefore).div(scaledTotalSupplyBefore);
      _burn(user, burnAmountInternal);
      return;
    }

    burnAmountInternal = scaledTotalSupplyAfter
      .mul(userBalanceInternalBefore)
      .sub(totalSupplyInternalBefore.mul(userBalanceScaledAfter))
      .div(otherBalanceScaledBefore);
    _burn(user, burnAmountInternal);
  }

  /**
   * @dev balanceOfScaled = balanceInternal / totalSupplyInternal * scaledTotalSupply
   *                      = λ . balanceInternal
   **/
  function _scaledBalanceOf(uint256 balanceInternal, uint256 totalSupplyInternal, uint256 scaledTotalSupply) private pure returns (uint256) {
    if (balanceInternal == 0 || scaledTotalSupply == 0) {
      return 0;
    }
    return balanceInternal.wayMul(scaledTotalSupply).wayDiv(totalSupplyInternal);
  }

  /**
   * @dev scaledTotalSupply = (totalGonsDeposited - totalGonsBorrowed) / Λ + totalPrincipalBorrowed
   *                        = λ . totalSupplyInternal
   **/
  function _scaledTotalSupply(ExtData memory e, int256 totalGonsDeposited) private pure returns (uint256) {
    // require(totalGonsDeposited>=e.totalGonsBorrowed);
    return _gonsToAMPL(e.totalAMPLSupply, uint256(totalGonsDeposited.sub(e.totalGonsBorrowed)))
      .add(e.totalPrincipalBorrowed);
  }

  /**
   * @dev Helper method to convert gons to AMPL
   **/
  function _gonsToAMPL(uint256 totalAMPLSupply, uint256 gonValue) private pure returns (uint256) {
    return gonValue.wayMul(totalAMPLSupply).wayDiv(GONS_TOTAL_SUPPLY);
  }

  /**
   * @dev Helper method to convert AMPL to gons
   **/
  function _amplToGons(uint256 totalAMPLSupply, uint256 amplValue) private pure returns (uint256) {
    return amplValue.mul(GONS_TOTAL_SUPPLY).div(totalAMPLSupply);
  }

  /**
   * @dev Queries external contracts and fetches data used for aTokenMath
   *      - AMPL scalar form Ampleforth ERC-20 (Λ)
   *      - principal borrowed and Gons borrowed from the debt contracts
   **/
  function _fetchExtData() internal view returns (ExtData memory) {
    ExtData memory _extContractData;
    _extContractData.totalAMPLSupply = IERC20(UNDERLYING_ASSET_ADDRESS).totalSupply();

    uint256 stablePrincipal;
    int256 stablePrincipalScaled;
    (stablePrincipal, stablePrincipalScaled) = IAMPLDebtToken(STABLE_DEBT_TOKEN_ADDRESS).getAMPLBorrowData();

    uint256 variablePrincipal;
    int256 variablePrincipalScaled;
    (variablePrincipal, variablePrincipalScaled) = IAMPLDebtToken(VARIABLE_DEBT_TOKEN_ADDRESS).getAMPLBorrowData();

    _extContractData.totalPrincipalBorrowed = stablePrincipal.add(variablePrincipal);
    _extContractData.totalGonsBorrowed = stablePrincipalScaled.add(variablePrincipalScaled);

    return _extContractData;
  }
}

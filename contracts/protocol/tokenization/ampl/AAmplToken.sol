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
import {IncentivizedAAmplERC20} from './IncentivizedAAmplERC20.sol';
import {DataTypes} from '../../libraries/types/DataTypes.sol';

interface IAMPLDebtToken {
  function getAMPLBorrowData() external view returns (uint256, uint256);
}

/*
  AMPL specific AToken implementation.

  The AAmplToken inherits from `IncentivizedAAmplERC20` rather than the `IncentivizedERC20`
  which the generic token inherits from. The AAmplToken also stores references to the STABLE_DEBT_TOKEN,
  and the VARIABLE_DEBT_TOKEN contracts to calculate the total Principal borrowed (getAMPLBorrowData()),
  at any time.

  The AMPL AToken externally behaves similar to every other aTOKEN. It always maintains a 1:1 peg with
  the underlying AMPL.

  The following should always be true.

  1) At any time, user can deposit x AMPLs to mint x aAMPLs.
     Total aAMPL suppxly increases by exactly x.

  2) At any time, user can burn x aAMPLs for x AMPLs.
     Total aAMPL supply decreases by exactly x.

  3) At any time, userA can transfer x aAMPLs to userB.
     userA's aAMPL balance reduces by X.
     userB's aAMPL balance increases by X.
     Total aAMPL supply exactly remains same.

  4) When AMPL's supply rebases, only the 'unborrowed' aAMPL should rebase.
     => Say there are 1000 aAMPL, and 200 AMPL is lent out. AMPL expands by 10%.
        Thew new aAMPL supply should be 1080 aAMPL.
     => Say there are 1000 aAMPL, and 200 AMPL is lent out. AMPL contracts by 10%.
        Thew new aAMPL supply should be 920 aAMPL.

  5) When AMPL's supply rebases, only the part of the balance of a user proportional to  the available liquidity ('unborrowed') should rebase.
    => Say a user has deposited 1000 AMPL and receives 1000 aAMPL, and
       20% of the total underlying AMPL is lent out. AMPL expands by 10%.
       The new aAMPL user balance should be 1080 aAMPL.
    => Say a user has deposited 1000 AMPL and receives 1000 aAMPL, and
       20% of the total underlying AMPL is lent out. AMPL contracts by 10%.
       The new aAMPL supply should be 920 aAMPL.

  On mint and burn a private variable `_totalScaledAMPLSupply` keeps track of
    the scaled AMPL principal deposited.
*/
contract AAmplToken is VersionedInitializable, IncentivizedAAmplERC20, IAToken {
  using WadRayMath for uint256;
  using SafeERC20 for IERC20;

  bytes public constant EIP712_REVISION = bytes('1');
  bytes32 internal constant EIP712_DOMAIN =
    keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
  bytes32 public constant PERMIT_TYPEHASH =
    keccak256('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)');

  uint256 public constant UINT_MAX_VALUE = uint256(-1);
  uint256 public constant ATOKEN_REVISION = 0x1;
  address public immutable UNDERLYING_ASSET_ADDRESS;
  address public immutable RESERVE_TREASURY_ADDRESS;
  address public immutable STABLE_DEBT_TOKEN_ADDRESS;
  address public immutable VARIABLE_DEBT_TOKEN_ADDRESS;
  ILendingPool public immutable POOL;

  // AMPL constants
  uint256 private constant MAX_UINT256 = ~uint256(0); // (2^256) - 1
  uint256 private constant AMPL_DECIMALS = 9;
  uint256 private constant INITIAL_AMPL_SUPPLY = 50 * 10**6 * 10**AMPL_DECIMALS;
  uint256 private constant TOTAL_GONS = MAX_UINT256 - (MAX_UINT256 % INITIAL_AMPL_SUPPLY);

  // ampl scaled supply
  uint256 private _totalScaledAMPLSupply;

  /// @dev owner => next valid nonce to submit with permit()
  mapping(address => uint256) public _nonces;

  bytes32 public DOMAIN_SEPARATOR;

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
  ) public IncentivizedAAmplERC20(tokenName, tokenSymbol, 18, incentivesController, underlyingAssetAddress) {
    POOL = pool;
    UNDERLYING_ASSET_ADDRESS = underlyingAssetAddress;
    RESERVE_TREASURY_ADDRESS = reserveTreasuryAddress;

    DataTypes.ReserveData memory reserveData = pool.getReserveData(underlyingAssetAddress);
    STABLE_DEBT_TOKEN_ADDRESS = reserveData.stableDebtTokenAddress;
    VARIABLE_DEBT_TOKEN_ADDRESS = reserveData.variableDebtTokenAddress;
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
    _burn(user, amountScaled);

    // NOTE: this additional book keeping to keep track of 'deposited' AMPLs
    _totalScaledAMPLSupply = _totalScaledAMPLSupply.sub(amount.mul(getAMPLScalar()));

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
    _mint(user, amountScaled);

    // NOTE: this additional book keeping to keep track of 'deposited' AMPLs
    _totalScaledAMPLSupply = _totalScaledAMPLSupply.add(amount.mul(getAMPLScalar()));

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

    // Compared to the normal mint, we don't check for rounding errors.
    // The amount to mint can easily be very small since it is a fraction of the interest ccrued.
    // In that case, the treasury will experience a (very small) loss, but it
    // wont cause potentially valid transactions to fail.
    _mint(RESERVE_TREASURY_ADDRESS, amount.rayDiv(index));

    // NOTE: this additional book keeping to keep track of 'deposited' AMPLs
    _totalScaledAMPLSupply = _totalScaledAMPLSupply.add(amount.mul(getAMPLScalar()));

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
   * @dev Calculates the balance of the user: principal balance + interest generated by the principal
   * @param user The user whose balance is calculated
   * @return The balance of the user
   **/
  function balanceOf(address user)
    public
    view
    override(IncentivizedAAmplERC20, IERC20)
    returns (uint256)
  {
    return super.balanceOf(user).rayMul(POOL.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS));
  }

  /**
   * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
   * updated stored balance divided by the reserve's liquidity index at the moment of the update
   * @param user The user whose balance is calculated
   * @return The scaled balance of the user
   **/
  function scaledBalanceOf(address user) external view override returns (uint256) {
    return super.balanceOf(user);
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
    return (super.balanceOf(user), super.totalSupply());
  }

  /**
   * @dev calculates the total supply of the specific aToken
   * since the balance of every single user increases over time, the total supply
   * does that too.
   * @return the current total supply
   **/
  function totalSupply() public view override(IncentivizedAAmplERC20, IERC20) returns (uint256) {
    uint256 currentSupplyScaled = super.totalSupply();

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
    return super.totalSupply();
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

    uint256 fromBalanceBefore = super.balanceOf(from).rayMul(index);
    uint256 toBalanceBefore = super.balanceOf(to).rayMul(index);

    super._transfer(from, to, amount.rayDiv(index));

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


  // returns the totalAMPLDeposited and the totalScaledAMPLDeposited
  function getAMPLDepositData() internal override view returns (uint256, uint256) {
    return (super.totalSupply(), _totalScaledAMPLSupply);
  }

  // returns the totalAMPLBorrowed and the totalScaledAMPLBorrowed
  function getAMPLBorrowData() internal override view returns (uint256, uint256) {
    uint256 stablePrincipal;
    uint256 stablePrincipalScaled;
    uint256 variablePrincipal;
    uint256 variablePrincipalScaled;

    (stablePrincipal, stablePrincipalScaled) = IAMPLDebtToken(STABLE_DEBT_TOKEN_ADDRESS).getAMPLBorrowData();
    (variablePrincipal, variablePrincipalScaled) = IAMPLDebtToken(VARIABLE_DEBT_TOKEN_ADDRESS).getAMPLBorrowData();

    return (
      stablePrincipal.add(variablePrincipal),
      stablePrincipalScaled.add(variablePrincipalScaled)
    );
  }

  function getAMPLScalar() internal override view returns (uint256) {
    return TOTAL_GONS.div(IERC20(UNDERLYING_ASSET_ADDRESS).totalSupply());
  }
}

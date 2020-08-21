// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {ERC20} from './ERC20.sol';
import {LendingPool} from '../lendingpool/LendingPool.sol';
import {WadRayMath} from '../libraries/math/WadRayMath.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import {
  VersionedInitializable
} from '../libraries/openzeppelin-upgradeability/VersionedInitializable.sol';
import {IAToken, IERC20} from './interfaces/IAToken.sol';

/**
 * @title Aave ERC20 AToken
 *
 * @dev Implementation of the interest bearing token for the DLP protocol.
 * @author Aave
 */
contract AToken is VersionedInitializable, ERC20, IAToken {
  using WadRayMath for uint256;
  using SafeERC20 for ERC20;

  uint256 public constant UINT_MAX_VALUE = uint256(-1);

  /**
   * @dev emitted after aTokens are burned
   * @param from the address performing the redeem
   * @param value the amount to be redeemed
   * @param fromBalanceIncrease the cumulated balance since the last update of the user
   * @param fromIndex the last index of the user
   **/
  event Burn(
    address indexed from,
    address indexed target,
    uint256 value,
    uint256 fromBalanceIncrease,
    uint256 fromIndex
  );

  /**
   * @dev emitted after the mint action
   * @param from the address performing the mint
   * @param value the amount to be minted
   * @param fromBalanceIncrease the cumulated balance since the last update of the user
   * @param fromIndex the last index of the user
   **/
  event Mint(address indexed from, uint256 value, uint256 fromBalanceIncrease, uint256 fromIndex);

  /**
   * @dev emitted during the transfer action
   * @param from the address from which the tokens are being transferred
   * @param to the adress of the destination
   * @param value the amount to be minted
   * @param fromBalanceIncrease the cumulated balance since the last update of the user
   * @param toBalanceIncrease the cumulated balance since the last update of the destination
   * @param fromIndex the last index of the user
   * @param toIndex the last index of the liquidator
   **/
  event BalanceTransfer(
    address indexed from,
    address indexed to,
    uint256 value,
    uint256 fromBalanceIncrease,
    uint256 toBalanceIncrease,
    uint256 fromIndex,
    uint256 toIndex
  );

  /**
   * @dev emitted when the accumulation of the interest
   * by an user is redirected to another user
   * @param from the address from which the interest is being redirected
   * @param to the adress of the destination
   * @param fromBalanceIncrease the cumulated balance since the last update of the user
   * @param fromIndex the last index of the user
   **/
  event InterestStreamRedirected(
    address indexed from,
    address indexed to,
    uint256 redirectedBalance,
    uint256 fromBalanceIncrease,
    uint256 fromIndex
  );

  /**
   * @dev emitted when the redirected balance of an user is being updated
   * @param targetAddress the address of which the balance is being updated
   * @param targetBalanceIncrease the cumulated balance since the last update of the target
   * @param targetIndex the last index of the user
   * @param redirectedBalanceAdded the redirected balance being added
   * @param redirectedBalanceRemoved the redirected balance being removed
   **/
  event RedirectedBalanceUpdated(
    address indexed targetAddress,
    uint256 targetBalanceIncrease,
    uint256 targetIndex,
    uint256 redirectedBalanceAdded,
    uint256 redirectedBalanceRemoved
  );

  event InterestRedirectionAllowanceChanged(address indexed from, address indexed to);

  address public immutable UNDERLYING_ASSET_ADDRESS;

  mapping(address => uint256) private _userIndexes;
  mapping(address => address) private _interestRedirectionAddresses;
  mapping(address => uint256) private _redirectedBalances;
  mapping(address => address) private _interestRedirectionAllowances;

  LendingPool private immutable _pool;

  uint256 public constant ATOKEN_REVISION = 0x1;

  modifier onlyLendingPool {
    require(msg.sender == address(_pool), 'The caller of this function must be a lending pool');
    _;
  }

  modifier whenTransferAllowed(address from, uint256 amount) {
    require(isTransferAllowed(from, amount), 'Transfer cannot be allowed.');
    _;
  }

  constructor(
    LendingPool pool,
    address underlyingAssetAddress,
    string memory tokenName,
    string memory tokenSymbol
  ) public ERC20(tokenName, tokenSymbol) {
    _pool = pool;
    UNDERLYING_ASSET_ADDRESS = underlyingAssetAddress;
  }

  function getRevision() internal virtual override pure returns (uint256) {
    return ATOKEN_REVISION;
  }

  function initialize(
    uint8 underlyingAssetDecimals,
    string calldata tokenName,
    string calldata tokenSymbol
  ) external virtual initializer {
    _name = tokenName;
    _symbol = tokenSymbol;
    _setupDecimals(underlyingAssetDecimals);
  }

  /**
   * @notice ERC20 implementation internal function backing transfer() and transferFrom()
   * @dev validates the transfer before allowing it. NOTE: This is not standard ERC20 behavior
   **/
  function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal override whenTransferAllowed(from, amount) {
    _executeTransfer(from, to, amount);
  }

  /**
   * @dev redirects the interest generated to a target address.
   * when the interest is redirected, the user balance is added to
   * the recepient redirected balance.
   * @param to the address to which the interest will be redirected
   **/
  function redirectInterestStream(address to) external override {
    _redirectInterestStream(msg.sender, to);
  }

  /**
   * @dev redirects the interest generated by from to a target address.
   * when the interest is redirected, the user balance is added to
   * the recepient redirected balance. The caller needs to have allowance on
   * the interest redirection to be able to execute the function.
   * @param from the address of the user whom interest is being redirected
   * @param to the address to which the interest will be redirected
   **/
  function redirectInterestStreamOf(address from, address to) external override {
    require(
      msg.sender == _interestRedirectionAllowances[from],
      'Caller is not allowed to redirect the interest of the user'
    );
    _redirectInterestStream(from, to);
  }

  /**
   * @dev gives allowance to an address to execute the interest redirection
   * on behalf of the caller.
   * @param to the address to which the interest will be redirected. Pass address(0) to reset
   * the allowance.
   **/
  function allowInterestRedirectionTo(address to) external override {
    require(to != msg.sender, 'User cannot give allowance to himself');
    _interestRedirectionAllowances[msg.sender] = to;
    emit InterestRedirectionAllowanceChanged(msg.sender, to);
  }

  /**
   * @dev burns the aTokens and sends the equivalent amount of underlying to the target.
   * only lending pools can call this function
   * @param amount the amount being burned
   **/
  function burn(
    address user,
    address underlyingTarget,
    uint256 amount
  ) external override onlyLendingPool {
    //cumulates the balance of the user
    (, uint256 currentBalance, uint256 balanceIncrease) = _calculateBalanceIncrease(user);

    //if the user is redirecting his interest towards someone else,
    //we update the redirected balance of the redirection address by adding the accrued interest,
    //and removing the amount to redeem
    _updateRedirectedBalanceOfRedirectionAddress(user, balanceIncrease, amount);

    if (balanceIncrease > amount) {
      _mint(user, balanceIncrease.sub(amount));
    } else {
      _burn(user, amount.sub(balanceIncrease));
    }

    uint256 userIndex = 0;

    //reset the user data if the remaining balance is 0
    if (currentBalance.sub(amount) == 0) {
      _resetDataOnZeroBalance(user);
    } else {
      //updates the user index
      userIndex = _userIndexes[user] = _pool.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS);
    }

    //transfers the underlying to the target
    ERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(underlyingTarget, amount);

    emit Burn(msg.sender, underlyingTarget, amount, balanceIncrease, userIndex);
  }

  /**
   * @dev mints aTokens to user
   * only lending pools can call this function
   * @param user the address receiving the minted tokens
   * @param amount the amount of tokens to mint
   */
  function mint(address user, uint256 amount) external override onlyLendingPool {
    //cumulates the balance of the user
    (, , uint256 balanceIncrease) = _calculateBalanceIncrease(user);

    //updates the user index
    uint256 index = _userIndexes[user] = _pool.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS);

    //if the user is redirecting his interest towards someone else,
    //we update the redirected balance of the redirection address by adding the accrued interest
    //and the amount deposited
    _updateRedirectedBalanceOfRedirectionAddress(user, balanceIncrease.add(amount), 0);

    //mint an equivalent amount of tokens to cover the new deposit
    _mint(user, amount.add(balanceIncrease));

    emit Mint(user, amount, balanceIncrease, index);
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
    _executeTransfer(from, to, value);
  }

  /**
   * @dev calculates the balance of the user, which is the
   * principal balance + interest generated by the principal balance + interest generated by the redirected balance
   * @param user the user for which the balance is being calculated
   * @return the total balance of the user
   **/
  function balanceOf(address user) public override(ERC20, IERC20) view returns (uint256) {
    //current principal balance of the user
    uint256 currentPrincipalBalance = super.balanceOf(user);
    //balance redirected by other users to user for interest rate accrual
    uint256 redirectedBalance = _redirectedBalances[user];

    if (currentPrincipalBalance == 0 && redirectedBalance == 0) {
      return 0;
    }
    //if the user is not redirecting the interest to anybody, accrues
    //the interest for himself

    if (_interestRedirectionAddresses[user] == address(0)) {
      //accruing for himself means that both the principal balance and
      //the redirected balance partecipate in the interest
      return
        _calculateCumulatedBalance(user, currentPrincipalBalance.add(redirectedBalance)).sub(
          redirectedBalance
        );
    } else {
      //if the user redirected the interest, then only the redirected
      //balance generates interest. In that case, the interest generated
      //by the redirected balance is added to the current principal balance.
      return
        currentPrincipalBalance.add(
          _calculateCumulatedBalance(user, redirectedBalance).sub(redirectedBalance)
        );
    }
  }

  /**
   * @dev returns the principal balance of the user. The principal balance is the last
   * updated stored balance, which does not consider the perpetually accruing interest.
   * @param user the address of the user
   * @return the principal balance of the user
   **/
  function principalBalanceOf(address user) external override view returns (uint256) {
    return super.balanceOf(user);
  }

  /**
   * @dev calculates the total supply of the specific aToken
   * since the balance of every single user increases over time, the total supply
   * does that too.
   * @return the current total supply
   **/
  function totalSupply() public override(ERC20, IERC20) view returns (uint256) {
    uint256 currentSupplyPrincipal = super.totalSupply();

    if (currentSupplyPrincipal == 0) {
      return 0;
    }

    return
      currentSupplyPrincipal
        .wadToRay()
        .rayMul(_pool.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS))
        .rayToWad();
  }

  /**
   * @dev Used to validate transfers before actually executing them.
   * @param user address of the user to check
   * @param amount the amount to check
   * @return true if the user can transfer amount, false otherwise
   **/
  function isTransferAllowed(address user, uint256 amount) public override view returns (bool) {
    return _pool.balanceDecreaseAllowed(UNDERLYING_ASSET_ADDRESS, user, amount);
  }

  /**
   * @dev returns the last index of the user, used to calculate the balance of the user
   * @param user address of the user
   * @return the last user index
   **/
  function getUserIndex(address user) external override view returns (uint256) {
    return _userIndexes[user];
  }

  /**
   * @dev returns the address to which the interest is redirected
   * @param user address of the user
   * @return 0 if there is no redirection, an address otherwise
   **/
  function getInterestRedirectionAddress(address user) external override view returns (address) {
    return _interestRedirectionAddresses[user];
  }

  /**
   * @dev returns the redirected balance of the user. The redirected balance is the balance
   * redirected by other accounts to the user, that is accrueing interest for him.
   * @param user address of the user
   * @return the total redirected balance
   **/
  function getRedirectedBalance(address user) external override view returns (uint256) {
    return _redirectedBalances[user];
  }

  /**
   * @dev calculates the increase in balance since the last user action
   * @param user the address of the user
   * @return the last user principal balance, the current balance and the balance increase
   **/
  function _calculateBalanceIncrease(address user)
    internal
    view
    returns (
      uint256,
      uint256,
      uint256
    )
  {
    uint256 currentBalance = balanceOf(user);
    uint256 balanceIncrease = 0;
    uint256 previousBalance = 0;

    if (currentBalance != 0) {
      previousBalance = super.balanceOf(user);
      //calculate the accrued interest since the last accumulation
      balanceIncrease = currentBalance.sub(previousBalance);
    }

    return (previousBalance, currentBalance, balanceIncrease);
  }

  /**
   * @dev accumulates the accrued interest of the user to the principal balance
   * @param user the address of the user for which the interest is being accumulated
   * @return the previous principal balance, the new principal balance, the balance increase
   * and the new user index
   **/
  function _cumulateBalance(address user)
    internal
    returns (
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    (
      uint256 previousBalance,
      uint256 currentBalance,
      uint256 balanceIncrease
    ) = _calculateBalanceIncrease(user);

    _mint(user, balanceIncrease);

    //updates the user index
    uint256 index = _userIndexes[user] = _pool.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS);

    return (previousBalance, currentBalance, balanceIncrease, index);
  }

  /**
   * @dev updates the redirected balance of the user. If the user is not redirecting his
   * interest, nothing is executed.
   * @param user the address of the user for which the interest is being accumulated
   * @param balanceToAdd the amount to add to the redirected balance
   * @param balanceToRemove the amount to remove from the redirected balance
   **/
  function _updateRedirectedBalanceOfRedirectionAddress(
    address user,
    uint256 balanceToAdd,
    uint256 balanceToRemove
  ) internal {
    address redirectionAddress = _interestRedirectionAddresses[user];
    //if there isn't any redirection, nothing to be done
    if (redirectionAddress == address(0)) {
      return;
    }

    //compound balances of the redirected address
    (, , uint256 balanceIncrease, uint256 index) = _cumulateBalance(redirectionAddress);

    //updating the redirected balance
    _redirectedBalances[redirectionAddress] = _redirectedBalances[redirectionAddress]
      .add(balanceToAdd)
      .sub(balanceToRemove);

    //if the interest of redirectionAddress is also being redirected, we need to update
    //the redirected balance of the redirection target by adding the balance increase
    address targetOfRedirectionAddress = _interestRedirectionAddresses[redirectionAddress];

    // if the redirection address is also redirecting the interest, we accumulate his balance
    // and update his chain of redirection
    if (targetOfRedirectionAddress != address(0)) {
      _updateRedirectedBalanceOfRedirectionAddress(redirectionAddress, balanceIncrease, 0);
    }

    emit RedirectedBalanceUpdated(
      redirectionAddress,
      balanceIncrease,
      index,
      balanceToAdd,
      balanceToRemove
    );
  }

  /**
   * @dev calculate the interest accrued by user on a specific balance
   * @param user the address of the user for which the interest is being accumulated
   * @param balance the balance on which the interest is calculated
   * @return the interest rate accrued
   **/
  function _calculateCumulatedBalance(address user, uint256 balance)
    internal
    view
    returns (uint256)
  {
    return
      balance
        .wadToRay()
        .rayMul(_pool.getReserveNormalizedIncome(UNDERLYING_ASSET_ADDRESS))
        .rayDiv(_userIndexes[user])
        .rayToWad();
  }

  /**
   * @dev executes the transfer of aTokens, invoked by both _transfer() and
   *      transferOnLiquidation()
   * @param from the address from which transfer the aTokens
   * @param to the destination address
   * @param value the amount to transfer
   **/
  function _executeTransfer(
    address from,
    address to,
    uint256 value
  ) internal {
    require(value > 0, 'Transferred amount needs to be greater than zero');

    //cumulate the balance of the sender
    (
      ,
      uint256 fromBalance,
      uint256 fromBalanceIncrease,
      uint256 fromIndex
    ) = _cumulateBalance(from);

    //cumulate the balance of the receiver
    (, , uint256 toBalanceIncrease, uint256 toIndex) = _cumulateBalance(to);

    //if the sender is redirecting his interest towards someone else,
    //adds to the redirected balance the accrued interest and removes the amount
    //being transferred
    _updateRedirectedBalanceOfRedirectionAddress(from, fromBalanceIncrease, value);

    //if the receiver is redirecting his interest towards someone else,
    //adds to the redirected balance the accrued interest and the amount
    //being transferred
    _updateRedirectedBalanceOfRedirectionAddress(to, toBalanceIncrease.add(value), 0);

    //performs the transfer
    super._transfer(from, to, value);

    bool fromIndexReset = false;
    //reset the user data if the remaining balance is 0
    if (fromBalance.sub(value) == 0 && from != to) {
      fromIndexReset = _resetDataOnZeroBalance(from);
    }

    emit BalanceTransfer(
      from,
      to,
      value,
      fromBalanceIncrease,
      toBalanceIncrease,
      fromIndexReset ? 0 : fromIndex,
      toIndex
    );
  }

  /**
   * @dev executes the redirection of the interest from one address to another.
   * immediately after redirection, the destination address will start to accrue interest.
   * @param from the address from which transfer the aTokens
   * @param to the destination address
   **/
  function _redirectInterestStream(address from, address to) internal {
    address currentRedirectionAddress = _interestRedirectionAddresses[from];

    require(to != currentRedirectionAddress, 'Interest is already redirected to the user');

    //accumulates the accrued interest to the principal
    (
      uint256 previousPrincipalBalance,
      uint256 fromBalance,
      uint256 balanceIncrease,
      uint256 fromIndex
    ) = _cumulateBalance(from);

    require(fromBalance > 0, 'Interest stream can only be redirected if there is a valid balance');

    //if the user is already redirecting the interest to someone, before changing
    //the redirection address we substract the redirected balance of the previous
    //recipient
    if (currentRedirectionAddress != address(0)) {
      _updateRedirectedBalanceOfRedirectionAddress(from, 0, previousPrincipalBalance);
    }

    //if the user is redirecting the interest back to himself,
    //we simply set to 0 the interest redirection address
    if (to == from) {
      _interestRedirectionAddresses[from] = address(0);
      emit InterestStreamRedirected(from, address(0), fromBalance, balanceIncrease, fromIndex);
      return;
    }

    //first set the redirection address to the new recipient
    _interestRedirectionAddresses[from] = to;

    //adds the user balance to the redirected balance of the destination
    _updateRedirectedBalanceOfRedirectionAddress(from, fromBalance, 0);

    emit InterestStreamRedirected(from, to, fromBalance, balanceIncrease, fromIndex);
  }

  /**
   * @dev function to reset the interest stream redirection and the user index, if the
   * user has no balance left.
   * @param user the address of the user
   * @return true if the user index has also been reset, false otherwise. useful to emit the proper user index value
   **/
  function _resetDataOnZeroBalance(address user) internal returns (bool) {
    //if the user has 0 principal balance, the interest stream redirection gets reset
    _interestRedirectionAddresses[user] = address(0);

    //emits a InterestStreamRedirected event to notify that the redirection has been reset
    emit InterestStreamRedirected(user, address(0), 0, 0, 0);

    //if the redirected balance is also 0, we clear up the user index
    if (_redirectedBalances[user] == 0) {
      _userIndexes[user] = 0;
      return true;
    } else {
      return false;
    }
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
    ERC20(UNDERLYING_ASSET_ADDRESS).safeTransfer(target, amount);
    return amount;
  }

  /**
   * @dev aTokens should not receive ETH
   **/
  receive() external payable {
    revert();
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import {LendingPool} from './LendingPool.sol';
import {IPermissionManager} from '../../interfaces/IPermissionManager.sol';
import {IPermissionedLendingPool} from '../../interfaces/IPermissionedLendingPool.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {Errors} from '../libraries/helpers/Errors.sol';
import {DataTypes} from '../libraries/types/DataTypes.sol';

/**
 * @title PermissionedLendingPool
 * @notice This smart contracts adds a permission layer to the LendingPool contract to enable whitelisting of users interacting with it
 * @author Aave
 **/
contract PermissionedLendingPool is IPermissionedLendingPool, LendingPool {
  //identifier for the permission manager contract in the addresses provider
  bytes32 public constant PERMISSION_MANAGER = keccak256('PERMISSION_MANAGER');

  modifier onlyDepositors(address user) {
    _onlyDepositors(user);
    _;
  }

  modifier onlyUserPermissionAdmin(address user) {
    require(_isPermissionAdminOf(user, msg.sender), Errors.PLP_INVALID_PERMISSION_ADMIN);
    _;
  }

  modifier onlyValidPermissionAdmin(address user) {
    _onlyValidPermissionAdmin(user);
    _;
  }

  modifier onlyBorrowers(address user) {
    _onlyBorrowers(user);
    _;
  }

  modifier onlyLiquidators {
    require(_isInRole(msg.sender, DataTypes.Roles.LIQUIDATOR), Errors.PLP_LIQUIDATOR_UNAUTHORIZED);
    _;
  }

  modifier onlyStableRateManagers {
    require(
      _isInRole(msg.sender, DataTypes.Roles.STABLE_RATE_MANAGER),
      Errors.PLP_CALLER_NOT_STABLE_RATE_MANAGER
    );
    _;
  }

  /**
   * @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
   * - E.g. User deposits 100 USDC and gets in return 100 aUSDC
   * @param asset The address of the underlying asset to deposit
   * @param amount The amount to be deposited
   * @param onBehalfOf The address that will receive the aTokens, same as msg.sender if the user
   *   wants to receive them on his own wallet, or a different address if the beneficiary of aTokens
   *   is a different wallet
   * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
   *   0 if the action is executed directly by the user, without any middle-man
   **/
  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  )
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyDepositors(onBehalfOf)
    onlyValidPermissionAdmin(onBehalfOf)
  {
    super.deposit(asset, amount, onBehalfOf, referralCode);
  }

  /**
   * @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
   * E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
   * @param asset The address of the underlying asset to withdraw
   * @param amount The underlying amount to be withdrawn
   *   - Send the value type(uint256).max in order to withdraw the whole aToken balance
   * @param to Address that will receive the underlying, same as msg.sender if the user
   *   wants to receive it on his own wallet, or a different address if the beneficiary is a
   *   different wallet
   * @return The final amount withdrawn
   **/
  function withdraw(
    address asset,
    uint256 amount,
    address to
  )
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyDepositors(msg.sender)
    returns (uint256)
  {
    return super.withdraw(asset, amount, to);
  }

  /**
   * @dev Allows users to borrow a specific `amount` of the reserve underlying asset, provided that the borrower
   * already deposited enough collateral, or he was given enough allowance by a credit delegator on the
   * corresponding debt token (StableDebtToken or VariableDebtToken)
   * - E.g. User borrows 100 USDC passing as `onBehalfOf` his own address, receiving the 100 USDC in his wallet
   *   and 100 stable/variable debt tokens, depending on the `interestRateMode`
   * @param asset The address of the underlying asset to borrow
   * @param amount The amount to be borrowed
   * @param interestRateMode The interest rate mode at which the user wants to borrow: 1 for Stable, 2 for Variable
   * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
   *   0 if the action is executed directly by the user, without any middle-man
   * @param onBehalfOf Address of the user who will receive the debt. Should be the address of the borrower itself
   * calling the function if he wants to borrow against his own collateral, or the address of the credit delegator
   * if he has been given credit delegation allowance
   **/
  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode,
    address onBehalfOf
  )
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyBorrowers(onBehalfOf)
    onlyValidPermissionAdmin(onBehalfOf)
  {
    super.borrow(asset, amount, interestRateMode, referralCode, onBehalfOf);
  }

  /**
   * @notice Repays a borrowed `amount` on a specific reserve, burning the equivalent debt tokens owned
   * - E.g. User repays 100 USDC, burning 100 variable/stable debt tokens of the `onBehalfOf` address
   * @param asset The address of the borrowed underlying asset previously borrowed
   * @param amount The amount to repay
   * - Send the value type(uint256).max in order to repay the whole debt for `asset` on the specific `debtMode`
   * @param rateMode The interest rate mode at of the debt the user wants to repay: 1 for Stable, 2 for Variable
   * @param onBehalfOf Address of the user who will get his debt reduced/removed. Should be the address of the
   * user calling the function if he wants to reduce/remove his own debt, or the address of any other
   * other borrower whose debt should be removed
   * @return The final amount repaid
   **/
  function repay(
    address asset,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  )
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyBorrowers(onBehalfOf)
    onlyValidPermissionAdmin(onBehalfOf)
    returns (uint256)
  {
    return super.repay(asset, amount, rateMode, onBehalfOf);
  }

  /**
   * @dev Allows a borrower to swap his debt between stable and variable mode, or viceversa
   * @param asset The address of the underlying asset borrowed
   * @param rateMode The rate mode that the user wants to swap to
   **/
  function swapBorrowRateMode(address asset, uint256 rateMode)
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyBorrowers(msg.sender)
    onlyValidPermissionAdmin(msg.sender)
  {
    super.swapBorrowRateMode(asset, rateMode);
  }

  /**
   * @dev Rebalances the stable interest rate of a user to the current stable rate defined on the reserve.
   * - Users can be rebalanced if the following conditions are satisfied:
   *     1. Usage ratio is above 95%
   *     2. the current deposit APY is below REBALANCE_UP_THRESHOLD * maxVariableBorrowRate, which means that too much has been
   *        borrowed at a stable rate and depositors are not earning enough
   * @param asset The address of the underlying asset borrowed
   * @param user The address of the user to be rebalanced
   **/
  function rebalanceStableBorrowRate(address asset, address user)
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyStableRateManagers
  {
    super.rebalanceStableBorrowRate(asset, user);
  }

  /**
   * @dev Allows depositors to enable/disable a specific deposited asset as collateral
   * @param asset The address of the underlying asset deposited
   * @param useAsCollateral `true` if the user wants to use the deposit as collateral, `false` otherwise
   **/
  function setUserUseReserveAsCollateral(address asset, bool useAsCollateral)
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyDepositors(msg.sender)
    onlyValidPermissionAdmin(msg.sender)
  {
    super.setUserUseReserveAsCollateral(asset, useAsCollateral);
  }

  /**
   * @dev Function to liquidate a non-healthy position collateral-wise, with Health Factor below 1
   * - The caller (liquidator) covers `debtToCover` amount of debt of the user getting liquidated, and receives
   *   a proportionally amount of the `collateralAsset` plus a bonus to cover market risk
   * @param collateralAsset The address of the underlying asset used as collateral, to receive as result of the liquidation
   * @param debtAsset The address of the underlying borrowed asset to be repaid with the liquidation
   * @param user The address of the borrower getting liquidated
   * @param debtToCover The debt amount of borrowed `asset` the liquidator wants to cover
   * @param receiveAToken `true` if the liquidators wants to receive the collateral aTokens, `false` if he wants
   * to receive the underlying collateral asset directly
   **/
  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  )
    public
    virtual
    override(ILendingPool, LendingPool)
    onlyLiquidators
    onlyValidPermissionAdmin(msg.sender)
  {
    super.liquidationCall(collateralAsset, debtAsset, user, debtToCover, receiveAToken);
  }

  /**
   * @dev Function to seize the collateral of a user. Only whitelisters of the user can call this function
   * @param assets The addresses of the underlying assets to seize
   * @param to The address that will receive the funds
   **/
  function seize(
    address user,
    address[] calldata assets,
    address to
  ) public virtual override(IPermissionedLendingPool) onlyUserPermissionAdmin(user) whenNotPaused {
    address collateralManager = _addressesProvider.getLendingPoolCollateralManager();

    //solium-disable-next-line
    (bool success, bytes memory result) =
      collateralManager.delegatecall(
        abi.encodeWithSignature('seize(address,address[],address)', user, assets, to)
      );

    require(success, Errors.LP_LIQUIDATION_CALL_FAILED);

    (uint256 returnCode, string memory returnMessage) = abi.decode(result, (uint256, string));

    require(returnCode == 0, string(abi.encodePacked(returnMessage)));
  }

  /**
   * @dev Allows smartcontracts to access the liquidity of the pool within one transaction,
   * as long as the amount taken plus a fee is returned.
   * IMPORTANT There are security concerns for developers of flashloan receiver contracts that must be kept into consideration.
   * For further details please visit https://developers.aave.com
   * @param receiverAddress The address of the contract receiving the funds, implementing the IFlashLoanReceiver interface
   * @param assets The addresses of the assets being flash-borrowed
   * @param amounts The amounts amounts being flash-borrowed
   * @param modes Types of the debt to open if the flash loan is not returned:
   *   0 -> Don't open any debt, just revert if funds can't be transferred from the receiver
   *   1 -> Open debt at stable rate for the value of the amount flash-borrowed to the `onBehalfOf` address
   *   2 -> Open debt at variable rate for the value of the amount flash-borrowed to the `onBehalfOf` address
   * @param onBehalfOf The address  that will receive the debt in the case of using on `modes` 1 or 2
   * @param params Variadic packed params to pass to the receiver as extra information
   * @param referralCode Code used to register the integrator originating the operation, for potential rewards.
   *   0 if the action is executed directly by the user, without any middle-man
   **/
  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referralCode
  ) public virtual override(ILendingPool, LendingPool) {
    //validating modes
    for (uint256 i = 0; i < modes.length; i++) {
      if (modes[i] == uint256(DataTypes.InterestRateMode.NONE)) {
        require(_isInRole(msg.sender, DataTypes.Roles.BORROWER), Errors.PLP_BORROWER_UNAUTHORIZED);
        require(_permissionAdminValid(msg.sender), Errors.PLP_INVALID_PERMISSION_ADMIN);
      } else {
        require(_isInRole(onBehalfOf, DataTypes.Roles.BORROWER), Errors.PLP_BORROWER_UNAUTHORIZED);
        require(_permissionAdminValid(onBehalfOf), Errors.PLP_INVALID_PERMISSION_ADMIN);
      }
    }
    super.flashLoan(receiverAddress, assets, amounts, modes, onBehalfOf, params, referralCode);
  }

  /**
   * @dev Validates and finalizes an aToken transfer
   * - Only callable by the overlying aToken of the `asset`
   * @param asset The address of the underlying asset of the aToken
   * @param from The user from which the aTokens are transferred
   * @param to The user receiving the aTokens
   * @param amount The amount being transferred/withdrawn
   * @param balanceFromBefore The aToken balance of the `from` user before the transfer
   * @param balanceToBefore The aToken balance of the `to` user before the transfer
   */
  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromBefore,
    uint256 balanceToBefore
  ) public override(ILendingPool, LendingPool) {
    require(_isInRole(from, DataTypes.Roles.DEPOSITOR), Errors.VL_TRANSFER_NOT_ALLOWED);
    require(_isInRole(to, DataTypes.Roles.DEPOSITOR), Errors.VL_TRANSFER_NOT_ALLOWED);

    super.finalizeTransfer(asset, from, to, amount, balanceFromBefore, balanceToBefore);
  }

  function _isPermissionAdminOf(address user, address caller) internal view returns (bool) {
    IPermissionManager permissionManager =
      IPermissionManager(_addressesProvider.getAddress(PERMISSION_MANAGER));
    return
      permissionManager.getUserPermissionAdmin(user) == caller &&
      permissionManager.isUserPermissionAdminValid(user);
  }

  function _isInRole(address user, DataTypes.Roles role) internal view returns (bool) {
    return
      IPermissionManager(_addressesProvider.getAddress(PERMISSION_MANAGER)).isInRole(
        user,
        uint256(role)
      );
  }

  function _permissionAdminValid(address user) internal view returns (bool) {
    return
      IPermissionManager(_addressesProvider.getAddress(PERMISSION_MANAGER))
        .isUserPermissionAdminValid(user);
  }

  function _onlyDepositors(address user) internal view {
    require(
      _isInRole(user, DataTypes.Roles.DEPOSITOR) &&
        ((user == msg.sender) || _isInRole(msg.sender, DataTypes.Roles.DEPOSITOR)),
      Errors.PLP_DEPOSITOR_UNAUTHORIZED
    );
  }

  function _onlyBorrowers(address user) internal view {
    require(
      _isInRole(user, DataTypes.Roles.BORROWER) &&
        ((user == msg.sender) || _isInRole(msg.sender, DataTypes.Roles.BORROWER)),
      Errors.PLP_BORROWER_UNAUTHORIZED
    );
  }

  function _onlyValidPermissionAdmin(address user) internal view {
    require(_permissionAdminValid(user), Errors.PLP_INVALID_PERMISSION_ADMIN);
  }
}

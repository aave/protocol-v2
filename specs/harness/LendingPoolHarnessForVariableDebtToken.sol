pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {ReserveConfiguration} from '../../contracts/libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../../contracts/libraries/configuration/UserConfiguration.sol';
import {ReserveLogic} from '../../contracts/libraries/logic/ReserveLogic.sol';
import {ILendingPool} from '../../contracts/interfaces/ILendingPool.sol';
import {LendingPool} from '../../contracts/lendingpool/LendingPool.sol';

/*
Certora: Harness that delegates calls to the original LendingPool.
Used for the verification of the VariableDebtToken contract.
*/
contract LendingPoolHarnessForVariableDebtToken is ILendingPool {

  LendingPool private originalPool;

  function deposit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    originalPool.deposit(asset, amount, onBehalfOf, referralCode);
  }

  function withdraw(address asset, uint256 amount) external override {
    originalPool.withdraw(asset, amount);
  }

  function getBorrowAllowance(
    address fromUser,
    address toUser,
    address asset,
    uint256 interestRateMode
  ) external override view returns (uint256) {
    return originalPool.getBorrowAllowance(fromUser, toUser, asset, interestRateMode);
  }

  function delegateBorrowAllowance(
    address asset,
    address user,
    uint256 interestRateMode,
    uint256 amount
  ) external override {
    originalPool.delegateBorrowAllowance(asset, user, interestRateMode, amount);
  }

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode,
    address onBehalfOf
  ) external override {
    originalPool.borrow(asset, amount, interestRateMode, referralCode, onBehalfOf);
  }

  function repay(
    address asset,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external override {
    originalPool.repay(asset, amount, rateMode, onBehalfOf);
  }

  function swapBorrowRateMode(address asset, uint256 rateMode) external override {
    originalPool.swapBorrowRateMode(asset, rateMode);
  }

  function rebalanceStableBorrowRate(address asset, address user) external override {
    originalPool.rebalanceStableBorrowRate(asset, user);
  }

  function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external override {
    originalPool.setUserUseReserveAsCollateral(asset, useAsCollateral);
  }

  function liquidationCall(
    address collateral,
    address asset,
    address user,
    uint256 purchaseAmount,
    bool receiveAToken
  ) external override {
    originalPool.liquidationCall(collateral, asset, user, purchaseAmount, receiveAToken);
  }

  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256 mode,
    bytes calldata params,
    uint16 referralCode
  ) external override {
    originalPool.flashLoan(receiver, assets, amounts, mode, params, referralCode);
  }

  function getReservesList() external override view returns (address[] memory) {
    return originalPool.getReservesList();
  }

  function getReserveData(address asset) external override view returns (ReserveLogic.ReserveData memory) {
    return originalPool.getReserveData(asset);
  }

  function getUserConfiguration(address user) external override view returns (UserConfiguration.Map memory) {
    return originalPool.getUserConfiguration(user);
  }

  function getUserAccountData(address user)
  external
  override
  view
  returns (
    uint256 totalCollateralETH,
    uint256 totalBorrowsETH,
    uint256 availableBorrowsETH,
    uint256 currentLiquidationThreshold,
    uint256 ltv,
    uint256 healthFactor
  )
  {
    return originalPool.getUserAccountData(user);
  }

  function initReserve(
    address asset,
    address aTokenAddress,
    address stableDebtAddress,
    address variableDebtAddress,
    address interestRateStrategyAddress
  ) external override {
    originalPool.initReserve(asset, aTokenAddress, stableDebtAddress, variableDebtAddress, interestRateStrategyAddress);
  }

  function setReserveInterestRateStrategyAddress(address asset, address rateStrategyAddress)
  external
  override
  {
    originalPool.setReserveInterestRateStrategyAddress(asset, rateStrategyAddress);
  }

  function setConfiguration(address asset, uint256 configuration) external override {
    originalPool.setConfiguration(asset, configuration);
  }

  function getConfiguration(address asset)
  external
  override
  view
  returns (ReserveConfiguration.Map memory)
  {
    return originalPool.getConfiguration(asset);
  }

  mapping(uint256 => uint256) private reserveNormalizedIncome;

  function getReserveNormalizedIncome(address asset) external override view returns (uint256) {
    require(reserveNormalizedIncome[block.timestamp] == 1e27);
    return reserveNormalizedIncome[block.timestamp];
  }

  mapping(uint256 => uint256) private reserveNormalizedVariableDebt;

  function getReserveNormalizedVariableDebt(address asset)
  external
  override
  view
  returns (uint256)
  {
    require(reserveNormalizedVariableDebt[block.timestamp] == 1e27);
    return reserveNormalizedVariableDebt[block.timestamp];
  }

  function balanceDecreaseAllowed(
    address asset,
    address user,
    uint256 amount
  ) external override view returns (bool) {
    return originalPool.balanceDecreaseAllowed(asset, user, amount);
  }

  function setPause(bool val) external override {
    originalPool.setPause(val);
  }

  function paused() external override view returns (bool) {
    return originalPool.paused();
  }
}

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {
ReserveConfiguration
} from '../../contracts/libraries/configuration/ReserveConfiguration.sol';
import {UserConfiguration} from '../../contracts/libraries/configuration/UserConfiguration.sol';
import {ReserveLogic} from '../../contracts/libraries/logic/ReserveLogic.sol';
import {ILendingPool} from '../../contracts/interfaces/ILendingPool.sol';
import {LendingPool} from '../../contracts/lendingpool/LendingPool.sol';
import {
ILendingPoolAddressesProvider
} from '../../contracts/interfaces/ILendingPoolAddressesProvider.sol';

/*
Certora: Harness that delegates calls to the original LendingPool.
Used for the verification of the VariableDebtToken contract.
*/
contract LendingPoolHarnessForVariableDebtToken is ILendingPool {
  LendingPool private originalPool;

  function deposit(
    address reserve,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external override {
    originalPool.deposit(reserve, amount, onBehalfOf, referralCode);
  }

  function withdraw(
    address reserve,
    uint256 amount,
    address to
  ) external override {
    originalPool.withdraw(reserve, amount, to);
  }

  function borrow(
    address reserve,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode,
    address onBehalfOf
  ) external override {
    originalPool.borrow(reserve, amount, interestRateMode, referralCode, onBehalfOf);
  }

  function repay(
    address reserve,
    uint256 amount,
    uint256 rateMode,
    address onBehalfOf
  ) external override {
    originalPool.repay(reserve, amount, rateMode, onBehalfOf);
  }

  function swapBorrowRateMode(address reserve, uint256 rateMode) external override {
    originalPool.swapBorrowRateMode(reserve, rateMode);
  }

  function rebalanceStableBorrowRate(address reserve, address user) external override {
    originalPool.rebalanceStableBorrowRate(reserve, user);
  }

  function setUserUseReserveAsCollateral(address reserve, bool useAsCollateral) external override {
    originalPool.setUserUseReserveAsCollateral(reserve, useAsCollateral);
  }

  function liquidationCall(
    address collateral,
    address reserve,
    address user,
    uint256 purchaseAmount,
    bool receiveAToken
  ) external override {
    originalPool.liquidationCall(collateral, reserve, user, purchaseAmount, receiveAToken);
  }

  function getReservesList() external override view returns (address[] memory) {
    return originalPool.getReservesList();
  }

  function getReserveData(address asset)
  external
  override
  view
  returns (ReserveLogic.ReserveData memory)
  {
    return originalPool.getReserveData(asset);
  }

  function getUserConfiguration(address user)
  external
  override
  view
  returns (UserConfiguration.Map memory)
  {
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
    address reserve,
    address aTokenAddress,
    address stableDebtAddress,
    address variableDebtAddress,
    address interestRateStrategyAddress
  ) external override {
    originalPool.initReserve(
      reserve,
      aTokenAddress,
      stableDebtAddress,
      variableDebtAddress,
      interestRateStrategyAddress
    );
  }

  function setReserveInterestRateStrategyAddress(address reserve, address rateStrategyAddress)
  external
  override
  {
    originalPool.setReserveInterestRateStrategyAddress(reserve, rateStrategyAddress);
  }

  function setConfiguration(address reserve, uint256 configuration) external override {
    originalPool.setConfiguration(reserve, configuration);
  }

  function getConfiguration(address reserve)
  external
  override
  view
  returns (ReserveConfiguration.Map memory)
  {
    return originalPool.getConfiguration(reserve);
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

  function setPause(bool val) external override {
    originalPool.setPause(val);
  }

  function paused() external override view returns (bool) {
    return originalPool.paused();
  }

  function flashLoan(
    address receiver,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata modes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referralCode
  ) external override {
    originalPool.flashLoan(receiver, assets, amounts, modes, onBehalfOf, params, referralCode);
  }

  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromAfter,
    uint256 balanceToBefore
  ) external override {
    originalPool.finalizeTransfer(asset, from, to, amount, balanceFromAfter, balanceToBefore);
  }

  function getAddressesProvider() external override view returns (ILendingPoolAddressesProvider) {
    return originalPool.getAddressesProvider();
  }
}

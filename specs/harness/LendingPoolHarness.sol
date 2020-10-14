pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import {ReserveConfiguration} from '../../contracts/libraries/configuration/ReserveConfiguration.sol';
import {ILendingPool} from '../../contracts/interfaces/ILendingPool.sol';
import {LendingPool} from '../../contracts/lendingpool/LendingPool.sol';

/*
Certora: Harness that delegates calls to the original LendingPool.
*/
contract LendingPoolHarness is ILendingPool {

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

    function repayWithCollateral(
        address collateral,
        address principal,
        address user,
        uint256 principalAmount,
        address receiver,
        bytes calldata params
    ) external override {
        originalPool.repayWithCollateral(collateral, principal, user, principalAmount, receiver, params);
    }

    function flashLoan(
        address receiverAddress,
        address asset,
        uint256 amount,
        uint256 mode,
        bytes calldata params,
        uint16 referralCode
    ) external override {
        originalPool.flashLoan(receiverAddress, asset, amount, mode, params, referralCode);
    }

    function swapLiquidity(
        address receiverAddress,
        address fromAsset,
        address toAsset,
        uint256 amountToSwap,
        bytes calldata params
    ) external override {
        originalPool.swapLiquidity(receiverAddress, fromAsset, toAsset, amountToSwap, params);
    }

    function getReserveConfigurationData(address asset)
    external
    override
    view
    returns (
        uint256 decimals,
        uint256 ltv,
        uint256 liquidationThreshold,
        uint256 liquidationBonus,
        uint256 reserveFactor,
        address interestRateStrategyAddress,
        bool usageAsCollateralEnabled,
        bool borrowingEnabled,
        bool stableBorrowRateEnabled,
        bool isActive,
        bool isFreezed
    )
    {
        return originalPool.getReserveConfigurationData(asset);
    }

    function getReserveTokensAddresses(address asset)
    external
    override
    view
    returns (
        address aTokenAddress,
        address stableDebtTokenAddress,
        address variableDebtTokenAddress
    )
    {
        return originalPool.getReserveTokensAddresses(asset);
    }

    function getReserveData(address asset)
    external
    override
    view
    returns (
        uint256 availableLiquidity,
        uint256 totalStableDebt,
        uint256 totalVariableDebt,
        uint256 liquidityRate,
        uint256 variableBorrowRate,
        uint256 stableBorrowRate,
        uint256 averageStableBorrowRate,
        uint256 liquidityIndex,
        uint256 variableBorrowIndex,
        uint40 lastUpdateTimestamp
    )
    {
        return originalPool.getReserveData(asset);
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

    function getUserReserveData(address asset, address user)
    external
    override
    view
    returns (
        uint256 currentATokenBalance,
        uint256 currentStableDebt,
        uint256 currentVariableDebt,
        uint256 principalStableDebt,
        uint256 scaledVariableDebt,
        uint256 stableBorrowRate,
        uint256 liquidityRate,
        uint40 stableRateLastUpdated,
        bool usageAsCollateralEnabled
    )
    {
        return originalPool.getUserReserveData(asset, user);
    }

    function getReserves() external override view returns (address[] memory) {
        return originalPool.getReserves();
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

  function getReserveNormalizedIncome(address asset) external override view returns (uint256) {
    return originalPool.getReserveNormalizedIncome(asset);
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
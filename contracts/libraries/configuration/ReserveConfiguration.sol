// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

/**
 * @title ReserveConfiguration library
 * @author Aave
 * @notice Implements the bitmap logic to handle the reserve configuration
 */
library ReserveConfiguration {
  uint256 constant LTV_MASK = 0xFFFFFFFFFFFFFFFF0000;
  uint256 constant LIQUIDATION_THRESHOLD_MASK = 0xFFFFFFFFFFFF0000FFFF;
  uint256 constant LIQUIDATION_BONUS_MASK = 0xFFFFFFFF0000FFFFFFFF;
  uint256 constant DECIMALS_MASK = 0xFFFFFF00FFFFFFFFFFFF;
  uint256 constant ACTIVE_MASK = 0xFFFFFEFFFFFFFFFFFFFF;
  uint256 constant FROZEN_MASK = 0xFFFFFDFFFFFFFFFFFFFF;
  uint256 constant BORROWING_MASK = 0xFFFFFBFFFFFFFFFFFFFF;
  uint256 constant STABLE_BORROWING_MASK = 0xFFFFF7FFFFFFFFFFFFFF;
  uint256 constant RESERVE_FACTOR_MASK = 0xFFFFFFFFFFFFFFFF;

  /// @dev For the LTV, the start bit is 0 (up to 15), but we don't declare it as for 0 no bit movement is needed
  uint256 constant LIQUIDATION_THRESHOLD_START_BIT_POSITION = 16;
  uint256 constant LIQUIDATION_BONUS_START_BIT_POSITION = 32;
  uint256 constant RESERVE_DECIMALS_START_BIT_POSITION = 48;
  uint256 constant IS_ACTIVE_START_BIT_POSITION = 56;
  uint256 constant IS_FROZEN_START_BIT_POSITION = 57;
  uint256 constant BORROWING_ENABLED_START_BIT_POSITION = 58;
  uint256 constant STABLE_BORROWING_ENABLED_START_BIT_POSITION = 59;
  uint256 constant RESERVE_FACTOR_START_BIT_POSITION = 64;

  struct Map {
    //bit 0-15: LTV
    //bit 16-31: Liq. threshold
    //bit 32-47: Liq. bonus
    //bit 48-55: Decimals
    //bit 56: Reserve is active
    //bit 57: reserve is frozen
    //bit 58: borrowing is enabled
    //bit 59: stable rate borrowing enabled
    //bit 60-63: reserved
    //bit 64-79: reserve factor
    uint256 data;
  }

  /**
   * @dev sets the Loan to Value of the reserve
   * @param self the reserve configuration
   * @param ltv the new ltv
   **/
  function setLtv(ReserveConfiguration.Map memory self, uint256 ltv) internal pure {
    self.data = (self.data & LTV_MASK) | ltv;
  }

  /**
   * @dev gets the Loan to Value of the reserve
   * @param self the reserve configuration
   * @return the loan to value
   **/
  function getLtv(ReserveConfiguration.Map storage self) internal view returns (uint256) {
    return self.data & ~LTV_MASK;
  }

  /**
   * @dev sets the liquidation threshold of the reserve
   * @param self the reserve configuration
   * @param threshold the new liquidation threshold
   **/
  function setLiquidationThreshold(ReserveConfiguration.Map memory self, uint256 threshold)
    internal
    pure
  {
    self.data =
      (self.data & LIQUIDATION_THRESHOLD_MASK) |
      (threshold << LIQUIDATION_THRESHOLD_START_BIT_POSITION);
  }

  /**
   * @dev gets the Loan to Value of the reserve
   * @param self the reserve configuration
   * @return the liquidation threshold
   **/
  function getLiquidationThreshold(ReserveConfiguration.Map storage self)
    internal
    view
    returns (uint256)
  {
    return (self.data & ~LIQUIDATION_THRESHOLD_MASK) >> LIQUIDATION_THRESHOLD_START_BIT_POSITION;
  }

  /**
   * @dev sets the liquidation bonus of the reserve
   * @param self the reserve configuration
   * @param bonus the new liquidation bonus
   **/
  function setLiquidationBonus(ReserveConfiguration.Map memory self, uint256 bonus) internal pure {
    self.data =
      (self.data & LIQUIDATION_BONUS_MASK) |
      (bonus << LIQUIDATION_BONUS_START_BIT_POSITION);
  }

  /**
   * @dev gets the liquidation bonus of the reserve
   * @param self the reserve configuration
   * @return the liquidation bonus
   **/
  function getLiquidationBonus(ReserveConfiguration.Map storage self)
    internal
    view
    returns (uint256)
  {
    return (self.data & ~LIQUIDATION_BONUS_MASK) >> LIQUIDATION_BONUS_START_BIT_POSITION;
  }

  /**
   * @dev sets the decimals of the underlying asset of the reserve
   * @param self the reserve configuration
   * @param decimals the decimals
   **/
  function setDecimals(ReserveConfiguration.Map memory self, uint256 decimals) internal pure {
    self.data = (self.data & DECIMALS_MASK) | (decimals << RESERVE_DECIMALS_START_BIT_POSITION);
  }

  /**
   * @dev gets the decimals of the underlying asset of the reserve
   * @param self the reserve configuration
   * @return the decimals of the asset
   **/
  function getDecimals(ReserveConfiguration.Map storage self) internal view returns (uint256) {
    return (self.data & ~DECIMALS_MASK) >> RESERVE_DECIMALS_START_BIT_POSITION;
  }

  /**
   * @dev sets the active state of the reserve
   * @param self the reserve configuration
   * @param active the active state
   **/
  function setActive(ReserveConfiguration.Map memory self, bool active) internal pure {
    self.data =
      (self.data & ACTIVE_MASK) |
      (uint256(active ? 1 : 0) << IS_ACTIVE_START_BIT_POSITION);
  }

  /**
   * @dev gets the active state of the reserve
   * @param self the reserve configuration
   * @return the active state
   **/
  function getActive(ReserveConfiguration.Map storage self) internal view returns (bool) {
    return ((self.data & ~ACTIVE_MASK) >> IS_ACTIVE_START_BIT_POSITION) != 0;
  }

  /**
   * @dev sets the frozen state of the reserve
   * @param self the reserve configuration
   * @param frozen the frozen state
   **/
  function setFrozen(ReserveConfiguration.Map memory self, bool frozen) internal pure {
    self.data =
      (self.data & FROZEN_MASK) |
      (uint256(frozen ? 1 : 0) << IS_FROZEN_START_BIT_POSITION);
  }

  /**
   * @dev gets the frozen state of the reserve
   * @param self the reserve configuration
   * @return the frozen state
   **/
  function getFrozen(ReserveConfiguration.Map storage self) internal view returns (bool) {
    return ((self.data & ~FROZEN_MASK) >> IS_FROZEN_START_BIT_POSITION) != 0;
  }

  /**
   * @dev enables or disables borrowing on the reserve
   * @param self the reserve configuration
   * @param enabled true if the borrowing needs to be enabled, false otherwise
   **/
  function setBorrowingEnabled(ReserveConfiguration.Map memory self, bool enabled) internal pure {
    self.data =
      (self.data & BORROWING_MASK) |
      (uint256(enabled ? 1 : 0) << BORROWING_ENABLED_START_BIT_POSITION);
  }

  /**
   * @dev gets the borrowing state of the reserve
   * @param self the reserve configuration
   * @return the borrowing state
   **/
  function getBorrowingEnabled(ReserveConfiguration.Map storage self) internal view returns (bool) {
    return ((self.data & ~BORROWING_MASK) >> BORROWING_ENABLED_START_BIT_POSITION) != 0;
  }

  /**
   * @dev enables or disables stable rate borrowing on the reserve
   * @param self the reserve configuration
   * @param enabled true if the stable rate borrowing needs to be enabled, false otherwise
   **/
  function setStableRateBorrowingEnabled(ReserveConfiguration.Map memory self, bool enabled)
    internal
    pure
  {
    self.data =
      (self.data & STABLE_BORROWING_MASK) |
      (uint256(enabled ? 1 : 0) << STABLE_BORROWING_ENABLED_START_BIT_POSITION);
  }

  /**
   * @dev gets the stable rate borrowing state of the reserve
   * @param self the reserve configuration
   * @return the stable rate borrowing state
   **/
  function getStableRateBorrowingEnabled(ReserveConfiguration.Map storage self)
    internal
    view
    returns (bool)
  {
    return
      ((self.data & ~STABLE_BORROWING_MASK) >> STABLE_BORROWING_ENABLED_START_BIT_POSITION) != 0;
  }

  /**
   * @dev sets the reserve factor of the reserve
   * @param self the reserve configuration
   * @param reserveFactor the reserve factor
   **/
  function setReserveFactor(ReserveConfiguration.Map memory self, uint256 reserveFactor)
    internal
    pure
  {
    self.data =
      (self.data & RESERVE_FACTOR_MASK) |
      (reserveFactor << RESERVE_FACTOR_START_BIT_POSITION);
  }

  /**
   * @dev gets the reserve factor of the reserve
   * @param self the reserve configuration
   * @return the reserve factor
   **/
  function getReserveFactor(ReserveConfiguration.Map storage self) internal view returns (uint256) {
    return (self.data & ~RESERVE_FACTOR_MASK) >> RESERVE_FACTOR_START_BIT_POSITION;
  }

  /**
   * @dev gets the configuration flags of the reserve
   * @param self the reserve configuration
   * @return the state flags representing active, freezed, borrowing enabled, stableRateBorrowing enabled
   **/
  function getFlags(ReserveConfiguration.Map storage self)
    internal
    view
    returns (
      bool,
      bool,
      bool,
      bool
    )
  {
    uint256 dataLocal = self.data;

    return (
      (dataLocal & ~ACTIVE_MASK) >> IS_ACTIVE_START_BIT_POSITION != 0,
      (dataLocal & ~FROZEN_MASK) >> IS_FROZEN_START_BIT_POSITION != 0,
      (dataLocal & ~BORROWING_MASK) >> BORROWING_ENABLED_START_BIT_POSITION != 0,
      (dataLocal & ~STABLE_BORROWING_MASK) >> STABLE_BORROWING_ENABLED_START_BIT_POSITION != 0
    );
  }

  /**
   * @dev gets the configuration paramters of the reserve
   * @param self the reserve configuration
   * @return the state params representing ltv, liquidation threshold, liquidation bonus, the reserve decimals
   **/
  function getParams(ReserveConfiguration.Map storage self)
    internal
    view
    returns (
      uint256,
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    uint256 dataLocal = self.data;

    return (
      dataLocal & ~LTV_MASK,
      (dataLocal & ~LIQUIDATION_THRESHOLD_MASK) >> LIQUIDATION_THRESHOLD_START_BIT_POSITION,
      (dataLocal & ~LIQUIDATION_BONUS_MASK) >> LIQUIDATION_BONUS_START_BIT_POSITION,
      (dataLocal & ~DECIMALS_MASK) >> RESERVE_DECIMALS_START_BIT_POSITION,
      (dataLocal & ~RESERVE_FACTOR_MASK) >> RESERVE_FACTOR_START_BIT_POSITION
    );
  }

  /**
   * @dev gets the configuration paramters of the reserve from a memory object
   * @param self the reserve configuration
   * @return the state params representing ltv, liquidation threshold, liquidation bonus, the reserve decimals
   **/
  function getParamsMemory(ReserveConfiguration.Map memory self)
    internal
    pure
    returns (
      uint256,
      uint256,
      uint256,
      uint256,
      uint256
    )
  {
    return (
      self.data & ~LTV_MASK,
      (self.data & ~LIQUIDATION_THRESHOLD_MASK) >> LIQUIDATION_THRESHOLD_START_BIT_POSITION,
      (self.data & ~LIQUIDATION_BONUS_MASK) >> LIQUIDATION_BONUS_START_BIT_POSITION,
      (self.data & ~DECIMALS_MASK) >> RESERVE_DECIMALS_START_BIT_POSITION,
      (self.data & ~RESERVE_FACTOR_MASK) >> RESERVE_FACTOR_START_BIT_POSITION
    );
  }


   /**
   * @dev gets the configuration flags of the reserve from a memory object
   * @param self the reserve configuration
   * @return the state flags representing active, freezed, borrowing enabled, stableRateBorrowing enabled
   **/
  function getFlagsMemory(ReserveConfiguration.Map memory self)
    internal
    pure
    returns (
      bool,
      bool,
      bool,
      bool
    )
  {
    return (
      (self.data & ~ACTIVE_MASK) >> IS_ACTIVE_START_BIT_POSITION != 0,
      (self.data & ~FROZEN_MASK) >> IS_FROZEN_START_BIT_POSITION != 0,
      (self.data & ~BORROWING_MASK) >> BORROWING_ENABLED_START_BIT_POSITION != 0,
      (self.data & ~STABLE_BORROWING_MASK) >> STABLE_BORROWING_ENABLED_START_BIT_POSITION != 0
    );
  }
}

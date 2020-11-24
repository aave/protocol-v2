pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {UserConfiguration} from '../../contracts/libraries/configuration/UserConfiguration.sol';

/*
A wrapper contract for calling functions from the library UserConfiguration.
*/
contract UserConfigurationHarness {
  DataTypes.UserConfigurationMap internal usersConfig;

  function setBorrowing(
    address user,
    uint256 reserveIndex,
    bool borrowing
  ) public {
    UserConfiguration.setBorrowing(usersConfig, reserveIndex, borrowing);
  }

  function setUsingAsCollateral(
    address user,
    uint256 reserveIndex,
    bool _usingAsCollateral
  ) public {
    UserConfiguration.setUsingAsCollateral(usersConfig, reserveIndex, _usingAsCollateral);
  }

  function isUsingAsCollateralOrBorrowing(address user, uint256 reserveIndex)
    public
    view
    returns (bool)
  {
    return UserConfiguration.isUsingAsCollateralOrBorrowing(usersConfig, reserveIndex);
  }

  function isBorrowing(address user, uint256 reserveIndex) public view returns (bool) {
    return UserConfiguration.isBorrowing(usersConfig, reserveIndex);
  }

  function isUsingAsCollateral(address user, uint256 reserveIndex) public view returns (bool) {
    return UserConfiguration.isUsingAsCollateral(usersConfig, reserveIndex);
  }

  function isBorrowingAny(address user) public view returns (bool) {
    return UserConfiguration.isBorrowingAny(usersConfig);
  }

  function isEmpty(address user) public view returns (bool) {
    return UserConfiguration.isEmpty(usersConfig);
  }

  /*
		Mimics the original constructor of the contract.
	*/
  function init_state() public {}
}

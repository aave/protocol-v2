// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import {Ownable} from '../dependencies/openzeppelin/contracts/Ownable.sol';
import {ILendingPoolConfigurator} from '../interfaces/ILendingPoolConfigurator.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IGeneralVault} from '../interfaces/IGeneralVault.sol';
import {IATokensAndRatesHelper} from '../interfaces/IATokensAndRatesHelper.sol';
import {ICollateralAdapter} from '../interfaces/ICollateralAdapter.sol';
import {Errors} from '../protocol/libraries/helpers/Errors.sol';

/**
 * @title DeployVaultHelper contract
 * @author Sturdy
 * @notice Implements a logic of deploying new vault
 * @dev NOTE: THIS CONTRACT IS USED ONLY INTERNALLY WITHIN TEAM.
 **/
contract DeployVaultHelper is Ownable {
  ILendingPoolAddressesProvider private _addressProvider;

  constructor(address addressProvider) {
    _addressProvider = ILendingPoolAddressesProvider(addressProvider);
  }

  /**
   * @dev Deploy new vault function
   * @param _ids list of id of addressProvider
                 ids[0]: new vault id
                 ids[1]: new vault internal collateral asset id
                 ids[2]: new vault external collateral asset id
                 ...
   * @param _addresses list of addresses of addressProvider which is related with ids param
                 addresses[0]: new vault implementation contract address
                 addresses[1]: new vault internal collateral asset address
                 addresses[2]: new vault external collateral asset address
                 ...
   * @param _treasuryAddress treasury address
   * @param _treasuryFee treasury fee  10_00 = 10%
   * @param _aTokenHelper ATokensAndRatesHelper contract address
   * @param _inputParams param list which is used in ATokensAndRatesHelper contract
   * @param _input param list which is used for initReserve in LendingPoolConfigurator contract
   **/
  function deployVault(
    bytes32[] calldata _ids,
    address[] calldata _addresses,
    address _treasuryAddress,
    uint256 _treasuryFee,
    address _aTokenHelper,
    IATokensAndRatesHelper.ConfigureReserveInput[] calldata _inputParams,
    ILendingPoolConfigurator.InitReserveInput[] memory _input
  ) external payable onlyOwner {
    require(_ids.length == _addresses.length, Errors.VT_DEPLOY_FAILED);
    require(_ids.length >= 3, Errors.VT_DEPLOY_FAILED);
    require(_input.length == 1, Errors.VT_DEPLOY_FAILED);
    require(_inputParams.length == 1, Errors.VT_DEPLOY_FAILED);

    ILendingPoolAddressesProvider provider = _addressProvider;
    // change poolAdmin
    address orgPoolAdmin = provider.getPoolAdmin();
    provider.setPoolAdmin(address(this));

    // deploy vault, _ids[0] and addresses[0] are the id and impl address of new vault
    provider.setAddressAsProxy(_ids[0], _addresses[0]);

    // set addresses
    for (uint256 i = 1; i < _ids.length; ++i) {
      provider.setAddress(_ids[i], _addresses[i]);
    }

    //register vault
    address configurator = provider.getLendingPoolConfigurator();
    address newVault = provider.getAddress(_ids[0]);
    ILendingPoolConfigurator(configurator).registerVault(newVault);

    //set vault fee
    IGeneralVault(newVault).setTreasuryInfo(_treasuryAddress, _treasuryFee);

    //collateralAdapter.addCollateralAsset
    address collateralAdapter = provider.getAddress('COLLATERAL_ADAPTER');
    ICollateralAdapter(collateralAdapter).addCollateralAsset(
      _addresses[2],
      _addresses[1],
      newVault
    );

    //batchInitReserve
    _input[0].yieldAddress = newVault;
    ILendingPoolConfigurator(configurator).batchInitReserve(_input);

    //atokenAndRatesHelper.configureReserves
    provider.setPoolAdmin(_aTokenHelper);
    IATokensAndRatesHelper(_aTokenHelper).configureReserves(_inputParams);

    // rollback poolAdmin
    provider.setPoolAdmin(orgPoolAdmin);

    // rollback owner of addressProvider and atokenAndRatesHelper msg.sender
    Ownable(address(provider)).transferOwnership(msg.sender);
    Ownable(_aTokenHelper).transferOwnership(msg.sender);
  }

  function removeHelperAsOwner(address _aTokenHelper) external payable onlyOwner {
    Ownable(address(_addressProvider)).transferOwnership(msg.sender);
    Ownable(_aTokenHelper).transferOwnership(msg.sender);
  }
}

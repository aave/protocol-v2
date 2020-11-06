// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import {AToken} from './AToken.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {Errors} from '../libraries/helpers/Errors.sol';

/**
 * @title IDelegationToken
 * @dev implements an interface for tokens that have a delegation function
 **/
interface IDelegationToken {
  function delegate(address delegatee) external;
}

/**
 * @title Aave AToken with delegation capabilities
 *
 * @dev Implementation of the interest bearing token for the Aave protocol. This version of the aToken
 * adds a function which gives the Aave protocol the ability to delegate voting power of the underlying asset.
 * The underlying asset needs to be compatible with the COMP delegation interface
 * @author Aave
 */
contract DelegationAwareAToken is AToken {
  /**
   * @dev only the aave admin can call this function
   **/
  modifier onlyPoolAdmin {
    require(
      _msgSender() == ILendingPool(POOL).getAddressesProvider().getPoolAdmin(),
      Errors.CALLER_NOT_POOL_ADMIN
    );
    _;
  }

  constructor(
    ILendingPool pool,
    address underlyingAssetAddress,
    address reserveTreasury,
    string memory tokenName,
    string memory tokenSymbol,
    address incentivesController
  )
    public
    AToken(
      pool,
      underlyingAssetAddress,
      reserveTreasury,
      tokenName,
      tokenSymbol,
      incentivesController
    )
  {}

  function initialize(
    uint8 _underlyingAssetDecimals,
    string calldata _tokenName,
    string calldata _tokenSymbol
  ) external virtual override initializer {
    _setName(_tokenName);
    _setSymbol(_tokenSymbol);
    _setDecimals(_underlyingAssetDecimals);
  }

  /**
   * @dev delegates voting power of the underlying asset to a specific address
   * @param delegatee the address that will receive the delegation
   **/
  function delegateUnderlyingTo(address delegatee) external onlyPoolAdmin {
    IDelegationToken(UNDERLYING_ASSET_ADDRESS).delegate(delegatee);
  }
}

// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IAToken} from '../../interfaces/IAToken.sol';
import {IERC20WithPermit} from '../../interfaces/IERC20WithPermit.sol';
import {IStaticAToken} from '../../interfaces/IStaticAToken.sol';

contract StaticATokenMetaTransactionMock {
  function permitAndDeposit(
    IStaticAToken staticToken,
    address recipient,
    uint256 value,
    uint16 referralCode,
    bool fromUnderlying,
    uint256 deadline,
    IStaticAToken.SignatureParams calldata sigParamsPermit,
    IStaticAToken.SignatureParams calldata sigParamsDeposit,
    uint256 chainId
  ) external returns (uint256) {
    // will throw if not permit underlying token
    try
      IERC20WithPermit(
        fromUnderlying ? address(staticToken.ASSET()) : address(staticToken.ATOKEN())
      )
        .permit(
        msg.sender,
        address(staticToken),
        value,
        deadline,
        sigParamsPermit.v,
        sigParamsPermit.r,
        sigParamsPermit.s
      )
    {} catch {
      require(false, 'UNDERLYING_TOKEN_NO_PERMIT');
    }
    staticToken.metaDeposit(
      msg.sender,
      recipient,
      value,
      referralCode,
      fromUnderlying,
      deadline,
      sigParamsDeposit,
      chainId
    );
  }
}

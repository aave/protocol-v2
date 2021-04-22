// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

/**
 * @title ErrorsStaticAToken library
 * @author Aave
 * @notice Defines the errors emitted by the StaticAToken helper contract
 */
library ErrorsStaticAToken {
  string public constant INVALID_OWNER_ON_PERMIT = '1';
  string public constant INVALID_EXPIRATION_ON_PERMIT = '2';
  string public constant INVALID_SIGNATURE_ON_PERMIT = '3';
  string public constant INVALID_DEPOSITOR_ON_METADEPOSIT = '4';
  string public constant INVALID_EXPIRATION_ON_METADEPOSIT = '5';
  string public constant INVALID_SIGNATURE_ON_METADEPOSIT = '6';
  string public constant INVALID_OWNER_ON_METAWITHDRAW = '7';
  string public constant INVALID_EXPIRATION_ON_METAWITHDRAW = '8';
  string public constant INVALID_SIGNATURE_ON_METAWITHDRAW = '9';
  string public constant INVALID_ZERO_RECIPIENT = '10';
  string public constant ONLY_ONE_INPUT_AMOUNT_AT_A_TIME = '11';
  string public constant INCONSISTENT_WITHDRAWN_AMOUNT = '12';
}

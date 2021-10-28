// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

library StaticATokenErrors {
  string public constant INVALID_OWNER = '1';
  string public constant INVALID_EXPIRATION = '2';
  string public constant INVALID_SIGNATURE = '3';
  string public constant INVALID_DEPOSITOR = '4';
  string public constant INVALID_RECIPIENT = '5';
  string public constant INVALID_CLAIMER = '6';
  string public constant ONLY_ONE_AMOUNT_FORMAT_ALLOWED = '7';
  string public constant ONLY_PROXY_MAY_CALL = '8';
}

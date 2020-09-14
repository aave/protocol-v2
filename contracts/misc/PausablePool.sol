pragma solidity ^0.6.8;

// Comments made with // are due current max code size at LendingPool

// import {Errors} from '../libraries/helpers/Errors.sol';

/**
 * @dev Contract module which allows children to implement an emergency stop
 * mechanism that can be triggered by an authorized account.
 *
 * This module is used through inheritance. It will make available the
 * modifiers `whenNotPaused` and `whenPaused`, which can be applied to
 * the functions of your contract. Note that they will not be pausable by
 * simply including this module, only once the modifiers are put in place.
 */
contract PausablePool {
  /**
   * @dev Emitted when the pause is triggered by `account`.
   */
  event Paused();

  /**
   * @dev Emitted when the pause is lifted by `account`.
   */
  event Unpaused();

  bool private _paused;

  /**
   * @dev Initializes the contract in unpaused state.
   */
  constructor() internal {
    _paused = false;
  }

  /**
   * @dev Returns true if the contract is paused, and false otherwise.
   */
  function paused() public virtual view returns (bool) {
    return _paused;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   *
   * Requirements:
   *
   * - The contract must not be paused.
   */
  modifier whenNotPaused() {
    // require(!_paused, Errors.IS_PAUSED);
    require(!_paused, '54');
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   *
   * Requirements:
   *
   * - The contract must be paused.
   */
  modifier whenPaused() {
    // require(_paused, Errors.NOT_PAUSED);
    require(_paused, '55');
    _;
  }

  /**
   * @dev Triggers stopped state.
   *
   * Requirements:
   *
   * - The contract must not be paused.
   */
  function _pause() internal virtual whenNotPaused {
    _paused = true;
    emit Paused();
  }

  /**
   * @dev Returns to normal state.
   *
   * Requirements:
   *
   * - The contract must be paused.
   */
  function _unpause() internal virtual whenPaused {
    _paused = false;
    emit Unpaused();
  }
}

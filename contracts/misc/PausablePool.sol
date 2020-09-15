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
   * @dev Returns to normal state.
   *
   * Requirements:
   *
   * - The contract must be paused.
   */
  function _setPause(bool val) internal virtual {
    _paused = val;
    if (_paused) {
      emit Paused();
      return;
    }
    emit Unpaused();
  }
}

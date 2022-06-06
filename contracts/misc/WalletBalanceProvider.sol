// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

pragma experimental ABIEncoderV2;

import {Address} from '../dependencies/openzeppelin/contracts/Address.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {ReserveConfiguration} from '../protocol/libraries/configuration/ReserveConfiguration.sol';
import {DataTypes} from '../protocol/libraries/types/DataTypes.sol';

/**
 * @title WalletBalanceProvider contract
 * @author Aave, influenced by https://github.com/wbobeirne/eth-balance-checker/blob/master/contracts/BalanceChecker.sol
 * @notice Implements a logic of getting multiple tokens balance for one user address
 * @dev NOTE: THIS CONTRACT IS NOT USED WITHIN THE AAVE PROTOCOL. It's an accessory contract used to reduce the number of calls
 * towards the blockchain from the Aave backend.
 **/
contract WalletBalanceProvider {
  using Address for address payable;
  using Address for address;
  using SafeERC20 for IERC20;
  using ReserveConfiguration for DataTypes.ReserveConfigurationMap;

  address constant MOCK_ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  /**
    @dev Fallback function, don't accept any ETH
    **/
  receive() external payable {
    //only contracts can send ETH to the core
    require(msg.sender.isContract(), '22');
  }

  /**
    @dev Check the token balance of a wallet in a token contract

    Returns the balance of the token for user. Avoids possible errors:
      - return 0 on non-contract address
    **/
  function balanceOf(address user, address token) public view returns (uint256) {
    if (token == MOCK_ETH_ADDRESS) {
      return user.balance; // ETH balance
      // check if token is actually a contract
    } else if (token.isContract()) {
      return IERC20(token).balanceOf(user);
    }
    revert('INVALID_TOKEN');
  }

  /**
   * @notice Fetches, for a list of _users and _tokens (ETH included with mock address), the balances
   * @param users The list of users
   * @param tokens The list of tokens
   * @return And array with the concatenation of, for each user, his/her balances
   **/
  function batchBalanceOf(address[] calldata users, address[] calldata tokens)
    external
    view
    returns (uint256[] memory)
  {
    uint256 userLength = users.length;
    uint256 tokenLength = tokens.length;

    uint256[] memory balances = new uint256[](userLength * tokenLength);

    for (uint256 i; i < userLength; ++i) {
      for (uint256 j; j < tokenLength; ++j) {
        balances[i * tokens.length + j] = balanceOf(users[i], tokens[j]);
      }
    }

    return balances;
  }

  /**
    @dev provides balances of user wallet for all reserves available on the pool
    */
  function getUserWalletBalances(address provider, address user)
    external
    view
    returns (address[] memory, uint256[] memory)
  {
    ILendingPool pool = ILendingPool(ILendingPoolAddressesProvider(provider).getLendingPool());
    address[] memory reserves = pool.getReservesList();
    uint256 length = reserves.length;
    address[] memory reservesWithEth = new address[](length + 1);
    for (uint256 i; i < length; ++i) {
      reservesWithEth[i] = reserves[i];
    }
    reservesWithEth[length] = MOCK_ETH_ADDRESS;

    uint256[] memory balances = new uint256[](reservesWithEth.length);

    for (uint256 j; j < length; ++j) {
      DataTypes.ReserveConfigurationMap memory configuration = pool.getConfiguration(
        reservesWithEth[j]
      );

      (bool isActive, , , , ) = configuration.getFlagsMemory();

      if (!isActive) {
        continue;
      }
      balances[j] = balanceOf(user, reservesWithEth[j]);
    }
    balances[length] = balanceOf(user, MOCK_ETH_ADDRESS);

    return (reservesWithEth, balances);
  }
}

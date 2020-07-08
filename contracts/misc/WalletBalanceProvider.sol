// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.6.8;

import '@openzeppelin/contracts/utils/Address.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../configuration/LendingPoolAddressesProvider.sol';
import '../lendingpool/LendingPool.sol';
import '../libraries/EthAddressLib.sol';

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

  LendingPoolAddressesProvider provider;

  constructor(LendingPoolAddressesProvider _provider) public {
    provider = _provider;
  }

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
  function balanceOf(address _user, address _token) public view returns (uint256) {
    // check if token is actually a contract
    if (_token.isContract()) {
      return IERC20(_token).balanceOf(_user);
    } else {
      return 0;
    }
  }

  /// @notice Fetches, for a list of _users and _tokens (ETH included with mock address), the balances
  /// @param _users The list of users
  /// @param _tokens The list of tokens
  /// @return And array with the concatenation of, for each user, his/her balances
  function batchBalanceOf(address[] memory _users, address[] memory _tokens)
    public
    view
    returns (uint256[] memory)
  {
    uint256[] memory balances = new uint256[](_users.length * _tokens.length);

    for (uint256 i = 0; i < _users.length; i++) {
      for (uint256 j = 0; j < _tokens.length; j++) {
        uint256 _offset = i * _tokens.length;
        if (_tokens[j] == EthAddressLib.ethAddress()) {
          balances[_offset + j] = _users[i].balance; // ETH balance
        } else {
          if (!_tokens[j].isContract()) {
            revert('INVALID_TOKEN');
          } else {
            balances[_offset + j] = balanceOf(_users[i], _tokens[j]);
          }
        }
      }
    }

    return balances;
  }

  /**
    @dev provides balances of user wallet for all reserves available on the pool
    */
  function getUserWalletBalances(address _user)
    public
    view
    returns (address[] memory, uint256[] memory)
  {
    LendingPool pool = LendingPool(payable(provider.getLendingPool()));

    address[] memory reserves = pool.getReserves();

    uint256[] memory balances = new uint256[](reserves.length);

    for (uint256 j = 0; j < reserves.length; j++) {
      (, , , , , , , , , bool isActive,) = pool.getReserveConfigurationData(reserves[j]);

      if (!isActive) {
        balances[j] = 0;
        continue;
      }
      if (reserves[j] != EthAddressLib.ethAddress()) {
        balances[j] = balanceOf(_user, reserves[j]);
      } else {
        balances[j] = _user.balance; // ETH balance
      }
    }

    return (reserves, balances);
  }
}

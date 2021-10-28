// SPDX-FileCopyrightText: 2020 Lido <info@lido.fi>
// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {SignedSafeMath} from '../../dependencies/openzeppelin/contracts/SignedSafeMath.sol';
import {UInt256Lib} from '../../dependencies/uFragments/UInt256Lib.sol';

contract StETHMocked {
  using SafeMath for uint256;
  using UInt256Lib for uint256;
  using SignedSafeMath for int256;

  string public symbol = 'stETH';
  uint256 public decimals = 18;

  uint256 private _totalSupply;
  uint256 private _totalShares;
  mapping(address => uint256) _shares;

  function _getPooledEthByShares(uint256 _sharesAmount) internal view returns (uint256) {
    return _sharesAmount.mul(_totalSupply).div(_totalShares);
  }

  function _getSharesByPooledEth(uint256 _pooledEthAmount) internal view returns (uint256) {
    return _pooledEthAmount.mul(_totalShares).div(_totalSupply);
  }

  function totalSupply() external view returns (uint256) {
    return _totalSupply;
  }

  /**
   * @notice Increases shares of a given address by the specified amount.
   *
   * @param _to Receiver of new shares
   * @param _sharesAmount Amount of shares to mint
   * @return The total amount of all holders' shares after new shares are minted
   */
  function _mintShares(address _to, uint256 _sharesAmount) internal returns (uint256) {
    _shares[_to] = _shares[_to].add(_sharesAmount);
    _totalShares = _totalShares.add(_sharesAmount);

    return _totalShares;
  }

  function mint(address _to, uint256 amount) external returns (uint256) {
    uint256 newTotalSupply = _totalSupply.add(amount);
    if (_totalSupply != 0) {
      amount = _getSharesByPooledEth(amount);
    }
    _totalSupply = newTotalSupply;

    return _mintShares(_to, amount);
  }

  function rebase(int256 addingAmount) external returns (uint256) {
    int256 currentTotalSupply = _totalSupply.toInt256Safe();

    if (currentTotalSupply != 0) {
      currentTotalSupply = currentTotalSupply.add(addingAmount);
      require(currentTotalSupply > 0);
      _totalSupply = uint256(currentTotalSupply);
    }

    return _totalSupply;
  }

  function getTotalShares() external view returns (uint256) {
    return _totalShares;
  }

  function balanceOf(address owner) external view returns (uint256) {
    uint256 _sharesOf = _shares[owner];
    if (_sharesOf == 0) {
      return 0;
    }
    return _getPooledEthByShares(_sharesOf);
  }

  function getPooledEthByShares(uint256 _sharesAmount) external view returns (uint256) {
    return _getPooledEthByShares(_sharesAmount);
  }

  function getSharesByPooledEth(uint256 _pooledEthAmount) external view returns (uint256) {
    return _getSharesByPooledEth(_pooledEthAmount);
  }

  function approve(address _to, uint256 amount) public returns (bool) {
    return true;
  }

  function allowance(address _owner, address _spender) public returns (uint256) {
    return _shares[_owner];
  }

  function _transfer(
    address _from,
    address _to,
    uint256 _value
  ) internal returns (bool) {
    if (_totalSupply == 0) {
      return false;
    }
    uint256 _valueShares = _getSharesByPooledEth(_value);
    require(_shares[_from] >= _valueShares);

    _shares[_from] = _shares[_from].sub(_valueShares);
    _shares[_to] = _shares[_to].add(_valueShares);

    return true;
  }

  function transfer(address _to, uint256 _value) public returns (bool) {
    return _transfer(msg.sender, _to, _value);
  }

  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  ) public returns (bool) {
    return _transfer(_from, _to, _value);
  }
}

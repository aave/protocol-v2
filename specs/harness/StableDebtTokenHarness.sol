pragma solidity 0.6.12;

import {StableDebtToken} from '../../contracts/tokenization/StableDebtToken.sol';
import {IncentivizedERC20} from '../../contracts/tokenization/IncentivizedERC20.sol';

contract StableDebtTokenHarness is StableDebtToken {
  constructor(
    address pool,
    address underlyingAsset,
    string memory name,
    string memory symbol,
    address incentivesController
  ) public StableDebtToken(pool, underlyingAsset, name, symbol, incentivesController) {}

  function balanceOf(address account) public override view returns (uint256) {
    return IncentivizedERC20.balanceOf(account);
  }

  function _calcTotalSupply(uint256 avgRate) internal override view returns (uint256) {
    return IncentivizedERC20.totalSupply();
  }

  function getIncentivesController() public view returns (address) {
    return address(_incentivesController);
  }
}

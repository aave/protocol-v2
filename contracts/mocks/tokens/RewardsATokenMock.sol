// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;

import {IAaveIncentivesController} from '../../interfaces/IAaveIncentivesController.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {RewardsAwareAToken} from '../../protocol/tokenization/RewardsAwareAToken.sol';
import {RewardsToken} from './RewardsToken.sol';
import {SafeERC20} from '../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';

/*
 * @dev A Simple mockup of RewardsAwareAToken that manages only one reward token. The token have a constant emission per second.
 * In this scenario, the rewards ERC20 token is also the Rewards Controller for simplicity.
 */
contract RewardsATokenMock is RewardsAwareAToken {
  RewardsToken public _rewardsController;

  /**
   * @dev Initializes the aToken
   * @param pool The address of the lending pool where this aToken will be used
   * @param treasury The address of the Aave treasury, receiving the fees on this aToken
   * @param underlyingAsset The address of the underlying asset of this aToken (E.g. WETH for aWETH)
   * @param incentivesController The smart contract managing potential incentives distribution
   * @param aTokenDecimals The decimals of the aToken, same as the underlying asset's
   * @param aTokenName The name of the aToken
   * @param aTokenSymbol The symbol of the aToken
   */
  function initialize(
    ILendingPool pool,
    address treasury,
    address underlyingAsset,
    IAaveIncentivesController incentivesController,
    uint8 aTokenDecimals,
    string calldata aTokenName,
    string calldata aTokenSymbol,
    bytes calldata params
  ) external virtual override initializer {
    uint256 chainId;

    //solium-disable-next-line
    assembly {
      chainId := chainid()
    }

    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        EIP712_DOMAIN,
        keccak256(bytes(aTokenName)),
        keccak256(EIP712_REVISION),
        chainId,
        address(this)
      )
    );

    _setName(aTokenName);
    _setSymbol(aTokenSymbol);
    _setDecimals(aTokenDecimals);

    _pool = pool;
    _treasury = treasury;
    _underlyingAsset = underlyingAsset;
    _incentivesController = incentivesController;

    // Specific RewardAToken initialization
    _rewardsController = RewardsToken(underlyingAsset);
    _rewardTokens[0] = underlyingAsset;

    emit Initialized(
      underlyingAsset,
      address(pool),
      treasury,
      address(incentivesController),
      aTokenDecimals,
      aTokenName,
      aTokenSymbol,
      params
    );
  }

  /**
   * @dev Due this aToken only holds one reward, is not needed to differentiate the input token
   */
  function _computeExternalLifetimeRewards(address token) internal override returns (uint256) {
    return _getExternalLifetimeRewards(token);
  }

  /**
   * @dev Due this aToken only holds one reward, is not needed to differentiate the input token
   */
  function _getExternalLifetimeRewards(address token) internal view override returns (uint256) {
    require(token == address(_rewardsController), 'Reward token mismatch');

    uint256 externalLifetime = _rewardsController.getLifetimeRewards(address(this));

    return (externalLifetime);
  }

  /**
   * @dev Due this aToken only holds one reward, is not needed to differentiate the input token
   */
  function _claimRewardsFromController() internal override {
    _rewardsController.claimRewards();
  }
}

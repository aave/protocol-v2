// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';

interface IBalancerVault {
  // Pools
  //
  // There are three specialization settings for Pools, which allow for cheaper swaps at the cost of reduced
  // functionality:
  //
  //  - General: no specialization, suited for all Pools. IGeneralPool is used for swap request callbacks, passing the
  // balance of all tokens in the Pool. These Pools have the largest swap costs (because of the extra storage reads),
  // which increase with the number of registered tokens.
  //
  //  - Minimal Swap Info: IMinimalSwapInfoPool is used instead of IGeneralPool, which saves gas by only passing the
  // balance of the two tokens involved in the swap. This is suitable for some pricing algorithms, like the weighted
  // constant product one popularized by Balancer V1. Swap costs are smaller compared to general Pools, and are
  // independent of the number of registered tokens.
  //
  //  - Two Token: only allows two tokens to be registered. This achieves the lowest possible swap gas cost. Like
  // minimal swap info Pools, these are called via IMinimalSwapInfoPool.

  enum PoolSpecialization {
    GENERAL,
    MINIMAL_SWAP_INFO,
    TWO_TOKEN
  }

  /**
   * @dev Returns a Pool's contract address and specialization setting.
   */
  function getPool(bytes32 poolId) external view returns (address, PoolSpecialization);

  // Swaps
  //
  // Users can swap tokens with Pools by calling the `swap` and `batchSwap` functions. To do this,
  // they need not trust Pool contracts in any way: all security checks are made by the Vault. They must however be
  // aware of the Pools' pricing algorithms in order to estimate the prices Pools will quote.
  //
  // The `swap` function executes a single swap, while `batchSwap` can perform multiple swaps in sequence.
  // In each individual swap, tokens of one kind are sent from the sender to the Pool (this is the 'token in'),
  // and tokens of another kind are sent from the Pool to the recipient in exchange (this is the 'token out').
  // More complex swaps, such as one token in to multiple tokens out can be achieved by batching together
  // individual swaps.
  //
  // There are two swap kinds:
  //  - 'given in' swaps, where the amount of tokens in (sent to the Pool) is known, and the Pool determines (via the
  // `onSwap` hook) the amount of tokens out (to send to the recipient).
  //  - 'given out' swaps, where the amount of tokens out (received from the Pool) is known, and the Pool determines
  // (via the `onSwap` hook) the amount of tokens in (to receive from the sender).
  //
  // Additionally, it is possible to chain swaps using a placeholder input amount, which the Vault replaces with
  // the calculated output of the previous swap. If the previous swap was 'given in', this will be the calculated
  // tokenOut amount. If the previous swap was 'given out', it will use the calculated tokenIn amount. These extended
  // swaps are known as 'multihop' swaps, since they 'hop' through a number of intermediate tokens before arriving at
  // the final intended token.
  //
  // In all cases, tokens are only transferred in and out of the Vault (or withdrawn from and deposited into Internal
  // Balance) after all individual swaps have been completed, and the net token balance change computed. This makes
  // certain swap patterns, such as multihops, or swaps that interact with the same token pair in multiple Pools, cost
  // much less gas than they would otherwise.
  //
  // It also means that under certain conditions it is possible to perform arbitrage by swapping with multiple
  // Pools in a way that results in net token movement out of the Vault (profit), with no tokens being sent in (only
  // updating the Pool's internal accounting).
  //
  // To protect users from front-running or the market changing rapidly, they supply a list of 'limits' for each token
  // involved in the swap, where either the maximum number of tokens to send (by passing a positive value) or the
  // minimum amount of tokens to receive (by passing a negative value) is specified.
  //
  // Additionally, a 'deadline' timestamp can also be provided, forcing the swap to fail if it occurs after
  // this point in time (e.g. if the transaction failed to be included in a block promptly).
  //
  // If interacting with Pools that hold WETH, it is possible to both send and receive ETH directly: the Vault will do
  // the wrapping and unwrapping. To enable this mechanism, the IAsset sentinel value (the zero address) must be
  // passed in the `assets` array instead of the WETH address. Note that it is possible to combine ETH and WETH in the
  // same swap. Any excess ETH will be sent back to the caller (not the sender, which is relevant for relayers).
  //
  // Finally, Internal Balance can be used when either sending or receiving tokens.

  enum SwapKind {
    GIVEN_IN,
    GIVEN_OUT
  }

  /**
   * @dev Performs a swap with a single Pool.
   *
   * If the swap is 'given in' (the number of tokens to send to the Pool is known), it returns the amount of tokens
   * taken from the Pool, which must be greater than or equal to `limit`.
   *
   * If the swap is 'given out' (the number of tokens to take from the Pool is known), it returns the amount of tokens
   * sent to the Pool, which must be less than or equal to `limit`.
   *
   * Internal Balance usage and the recipient are determined by the `funds` struct.
   *
   * Emits a `Swap` event.
   */
  function swap(
    SingleSwap memory singleSwap,
    FundManagement memory funds,
    uint256 limit,
    uint256 deadline
  ) external payable returns (uint256);

  /**
   * @dev Data for a single swap executed by `swap`. `amount` is either `amountIn` or `amountOut` depending on
   * the `kind` value.
   *
   * `assetIn` and `assetOut` are either token addresses, or the IAsset sentinel value for ETH (the zero address).
   * Note that Pools never interact with ETH directly: it will be wrapped to or unwrapped from WETH by the Vault.
   *
   * The `userData` field is ignored by the Vault, but forwarded to the Pool in the `onSwap` hook, and may be
   * used to extend swap behavior.
   */
  struct SingleSwap {
    bytes32 poolId;
    SwapKind kind;
    address assetIn;
    address assetOut;
    uint256 amount;
    bytes userData;
  }

  /**
   * @dev All tokens in a swap are either sent from the `sender` account to the Vault, or from the Vault to the
   * `recipient` account.
   *
   * If the caller is not `sender`, it must be an authorized relayer for them.
   *
   * If `fromInternalBalance` is true, the `sender`'s Internal Balance will be preferred, performing an ERC20
   * transfer for the difference between the requested amount and the User's Internal Balance (if any). The `sender`
   * must have allowed the Vault to use their tokens via `IERC20.approve()`. This matches the behavior of
   * `joinPool`.
   *
   * If `toInternalBalance` is true, tokens will be deposited to `recipient`'s internal balance instead of
   * transferred. This matches the behavior of `exitPool`.
   *
   * Note that ETH cannot be deposited to or withdrawn from Internal Balance: attempting to do so will trigger a
   * revert.
   */
  struct FundManagement {
    address sender;
    bool fromInternalBalance;
    address payable recipient;
    bool toInternalBalance;
  }

  /**
   * @dev Called by users to exit a Pool, which transfers tokens from the Pool's balance to `recipient`. This will
   * trigger custom Pool behavior, which will typically ask for something in return from `sender` - often tokenized
   * Pool shares. The amount of tokens that can be withdrawn is limited by the Pool's `cash` balance (see
   * `getPoolTokenInfo`).
   *
   * If the caller is not `sender`, it must be an authorized relayer for them.
   *
   * The `tokens` and `minAmountsOut` arrays must have the same length, and each entry in these indicates the minimum
   * token amount to receive for each token contract. The amounts to send are decided by the Pool and not the Vault:
   * it just enforces these minimums.
   *
   * If exiting a Pool that holds WETH, it is possible to receive ETH directly: the Vault will do the unwrapping. To
   * enable this mechanism, the IAsset sentinel value (the zero address) must be passed in the `assets` array instead
   * of the WETH address. Note that it is not possible to combine ETH and WETH in the same exit.
   *
   * `assets` must have the same length and order as the array returned by `getPoolTokens`. This prevents issues when
   * interacting with Pools that register and deregister tokens frequently. If receiving ETH however, the array must
   * be sorted *before* replacing the WETH address with the ETH sentinel value (the zero address), which means the
   * final `assets` array might not be sorted. Pools with no registered tokens cannot be exited.
   *
   * If `toInternalBalance` is true, the tokens will be deposited to `recipient`'s Internal Balance. Otherwise,
   * an ERC20 transfer will be performed. Note that ETH cannot be deposited to Internal Balance: attempting to
   * do so will trigger a revert.
   *
   * `minAmountsOut` is the minimum amount of tokens the user expects to get out of the Pool, for each token in the
   * `tokens` array. This array must match the Pool's registered tokens.
   *
   * This causes the Vault to call the `IBasePool.onExitPool` hook on the Pool's contract, where Pools implement
   * their own custom logic. This typically requires additional information from the user (such as the expected number
   * of Pool shares to return). This can be encoded in the `userData` argument, which is ignored by the Vault and
   * passed directly to the Pool's contract.
   *
   * Emits a `PoolBalanceChanged` event.
   */
  function exitPool(
    bytes32 poolId,
    address sender,
    address payable recipient,
    ExitPoolRequest memory request
  ) external;

  struct ExitPoolRequest {
    address[] assets;
    uint256[] minAmountsOut;
    bytes userData;
    bool toInternalBalance;
  }

  function getPoolTokenInfo(bytes32 poolId, IERC20 token)
    external
    view
    returns (
      uint256 cash,
      uint256 managed,
      uint256 lastChangeBlock,
      address assetManager
    );

  function getPoolTokens(bytes32 poolId)
    external
    view
    returns (
      address[] memory tokens,
      uint256[] memory balances,
      uint256 lastChangeBlock
    );
}

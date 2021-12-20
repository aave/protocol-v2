# stETH integration on AAVE

The main goal of integration is to provide the ability to deposit stETH into AAVE and allow to use it as collateral. Borrowing of the stETH (both stable and variable) is not supposed. The motivation behind this design is to encourage using stETH as collateral rather than borrowing it. stETH is pegged steadily to ETH, so using it as collateral involves low liquidation risks.

The stETH is implemented as a rebasing token. In normal conditions balances of users update one per day with Oracle report. Under the hood stETH stores balances of users as holder's shares in the total amount of Ether controlled by the Lido protocol. stETH has pair of methods to convert inner shares into the balances and vice versa:

```solidity
/// @return the amount of Ether that corresponds to `_sharesAmount` token shares.
function getPooledEthByShares(uint256 _sharesAmount) public view returns (uint256);

/// @return the amount of shares that corresponds to `_ethAmount` protocol-controlled Ether.
function getSharesByPooledEth(uint256 _ethAmount) public view returns (uint256);

```

The behavior of the current integration of stETH into the AAVE protocol keeps balances and the total supply of variable debt tokens the same after rebasing (borrower returns the same amount of tokens he loaned) when balances of astETH token exposed to rebasing. As variable debt tokens are not rebasing, holders of astETH take rebasing fees only from the amount of unborrowed stETH locked in the reserve.

The astETH, similarly to regular aTokens, is a yield-generating token that is minted and burned upon deposits and withdraws in the LendingPool. The astETH value is pegged to the value of the corresponding deposited asset at a 1:1 ratio and can be safely stored, transferred, or traded. All interest collected by the astETH reserve (from rebasing and AAVE income) is distributed to aTokens holders directly by continuously increasing their wallet balance (in case of negative rebases of stETH it might decrease).

The astETH implementation guarantees the following always ensured:

- **At any time, a user can deposit X stETH to mint X astETH ^\*^**
  Total astETH supply increases by X.

- **At any time, a user can burn x astETH for x stETH ^\*^**
  The total astETH supply decreases by x.

- **At any time, userA can transfer X astETH to userB ^\*^**
  userA’s astETH balance reduces by X.
  userB’s astETH balance increases by X.
  The total astETH supply exactly remains the same.

- **When stETH rebases, astETH rebases as well.**
  Say there are 1000 stETH locked in the reserve. Consider the below situations: 1. Common case: happens positive rebase, and stETH total supply increases by 1%: - totalSupply of astETH token becomes equal to 1010 astETH. - balance of each astETH holder increases by 1% also. 2. Rare case: happens negative rebase, and stETH total supply decreases by 1%: - totalSupply of astETH token becomes equal to 990 astETH. - balance of each astETH holder decreases by 1% also.

**^\*^Note**: Actual amount of asset will be less or equal to X because of integer operations rounding of underlying token rebase rate and AAVE interest rate. However, the actual rounding error will not exceed a couple of WEI at any time.

## AStETH Token

To implement the above logic `AStETH` contract modifies the implementation of default aToken but keeps it as close as possible to the original contract. Same as default `AToken` contract it inherits from `VersionedInitializable`, `IncentivizedERC20` contracts and implements `IAToken` interface.

Default aToken implements the ERC20 interface but has two specific methods:

- `scaledBalanceOf(user)` - Returns the **scaled balance** of user as a `uint256`. The scaled balance is the balance of the underlying asset of the user (amount deposited), divided by the current liquidity index at the moment of the update. $scaledBalance = amountDeposited/currentLiquidityIndex$
  This essentially 'marks' when a user has deposited in the reserve pool and can be used to calculate the user's current compounded aToken balance.
  Example: - User A deposits 1000 DAI at the liquidity index of 1.1 - User B deposits another amount into the same pool - The liquidity index is now 1.2 - Therefore to calculate User A's current compounded aToken balance, the reverse operation should be performed: $aTokenBalance = scaledBalance*currentLiquidityIndex$

- `scaledTotalSupply()` - Returns the scaled total supply of the aToken as `uint256`.

But above approach can't be used with the stETH token without modifications because it doesn't take into consideration rebases of stETH.

If apply above equations to stETH as is, the staking profit will not be distributed across the astETH holders but will be accumulated on the balance of the astETH token.

To make rebases profit accountable, `AStETH` introduces an additional index - **stETH rebasing index**. The stETH rebasing index - express the income from rebases of stETH token in time. StETH rebasing index might be calculated as follows:

```solidity=
function _stEthRebasingIndex() returns (uint256) {
  // Below expression returns how much Ether corresponds
  // to 10 ** 27 shares. 10 ** 27 was taken  to provide
  // same precision as AAVE's liquidity index, which
  // counted in RAY's (decimals with 27 digits).
  return stETH.getPooledEthByShares(10**27);
}

```

With stETH rebasing index, `AStETH` allows to make rebases profit accountable, applying additional scaling when minting or burning of token happens:

```solidity=
function mint(address user, uint256 amount, uint256 liquidityIndex) {
    ...
    uint256 stEthRebasingIndex = _stEthRebasingIndex();
    _mint(user, amount.rayDiv(stEthRebasingIndex).rayDiv(liquidityIndex));
    ...
}

function burn(address user, uint256 amount, uint256 liquidityIndex) {
    ...
    uint256 stEthRebasingIndex = _stEthRebasingIndex();
    _burn(user, amount.rayDiv(stEthRebasingIndex)).rayDiv(liquidityIndex);
    ...
}
```

Then, according to AAVE's definitions, `scaledTotalSupply()` and `scaledBalanceOf()` might be calculated as:

```solidity=
function scaledTotalSupply() returns (uint256) {
  return _totalSupply.rayMul(_stEthRebasingIndex());
}

function scaledBalanceOf(address user) returns (uint256) {
  return _balances[user].rayMul(_stEthRebasingIndex());
}

```

Additionally, `AStETH` contract introduces the following methods:

- `internalBalanceOf(user)` - returns **internal balance** of the user. The internal balance is the balance of the underlying asset of the user (sum of deposits of the user), divided by the current liquidity index at the moment of the update and by the current stETH rebasing index.
- `internalTotalSupply()` - Returns the internal total supply of the astETH.

```solidity=
function internalTotalSupply(address user) returns (uint256) {
  return _totalSupply;
}

function internalBalanceOf(address user) returns (uint256) {
  return _balances[user];
}

```

## StableDebtStETH & VariableDebtStETH Tokens

The current integration doesn't support borrowing, neither with variable nor with stable interest rates. Because of that, the StableDebtStETH and VariableDebtStETH contract extends default `StableDebtToken` and `VariableDebtToken` contracts accordingly, and override `mint()` method with the stub, which reverts with error `CONTRACT_NOT_ACTIVE`. This was done to make it impossible to use borrowing with astETH because default debt tokens are not compatible with the `AStETH` contract.

In the future, borrowing might be activated, by updating the implementation of debt tokens. But `StableDebtToken` and `VariableDebtToken` contracts **MUST NOT** be used with `AStETH` because they don't take into consideration rebases of stETH token and will break the math of the integration.

## Incentives Controller

At the launch of the stETH integration in the AAVE protocol, the incentives controller is not supposed to be used. If in the future Lido decides to add incentives to the integration, it might be done via updating the implementation of astETH token. The example of implementation of `IncentivesController` for `AStETH` contract might be found here: https://github.com/lidofinance/aave-asteth-incentives-controller

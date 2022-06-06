# Sturdy 
Sturdy is a new kind of DeFi lending protocol that enables users to earn high stablecoin yields or take out low interest loans (interest-freewhen utilization is undere 90%).

'Lenders' deposit assets they'd like to earn yield on while 'borrowers' provide collateral and take out the assets deposited by lenders as a loan. 
On existing lending protocols, the interest earned by lenders comes from borrowers. So in order for lenders to earn more, borrowers must pay more. Sturdy uses a different model, where yield instead comes from the borrowers' collateral.

When borrowers provide a token as collateral, Sturdy converts it into an interest-bearing token (ibToken) using protocols like Yearn or Lido. Over time, these ibTokens accrue yield; the yield from these tokens are then distributed to lenders in the same token they deposited. Here's an example:
- Alice deposits 100 USDC to the protocol
- Bob provides .05 ETH as collateral and takes out the 100 USDC Alice has deposited as a loan
- Over time, Bob’s debt remains constant and Alice’s balance grows

Here’s what happens under the hood:
- When Bob provides his ETH as collateral, Sturdy stakes it via Lido, converting it to .05 stETH (a yield-bearing version of ETH)
- Thanks to Lido’s mechanics, stETH rebases to a new balance of .06 over time
- Sturdy swaps the yield of .01 stETH to 40 USDC and increases Alice’s balance to 140 USDC

See the [docs](https://docs.sturdy.finance) for a more in-depth description of mechanics and the specific staking strategies employed for each collateral asset.

## Dev Environment
- EnvironmentFile (.env)
```
ALCHEMY_KEY="xxx"
```

- Compile
```
yarn compile
```

- Run the hardhat node on localhost.
```
FORK=main yarn hardhat node
```

- Next run the following task to deploy all smart contracts
```
yarn sturdy:evm:fork:mainnet:migration
```

- For test, run the following task to have a test of sample contract on the localhost.
```
yarn test
```

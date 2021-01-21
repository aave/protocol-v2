```
        .///.                .///.     //.            .//  `/////////////- 
       `++:++`              .++:++`    :++`          `++:  `++:......---.` 
      `/+: -+/`            `++- :+/`    /+/         `/+/   `++.            
      /+/   :+/            /+:   /+/    `/+/        /+/`   `++.            
  -::/++::`  /+:       -::/++::` `/+:    `++:      :++`    `++/:::::::::.  
  -:+++::-`  `/+:      --++/---`  `++-    .++-    -++.     `++/:::::::::.  
   -++.       .++-      -++`       .++.    .++.  .++-      `++.            
  .++-         -++.    .++.         -++.    -++``++-       `++.            
 `++:           :++`  .++-           :++`    :+//+:        `++:----------` 
 -/:             :/-  -/:             :/.     ://:         `/////////////- 
```

# Aave Protocol v2

This repository contains the smart contracts source code and markets configuration for Aave Protocol V2. The repository uses Docker Compose and Hardhat as development enviroment for compilation, testing and deployment tasks.

## What is Aave?

Aave is a decentralized non-custodial liquidity markets protocol where users can participate as depositors or borrowers. Depositors provide liquidity to the market to earn a passive income, while borrowers are able to borrow in an overcollateralized (perpetually) or undercollateralized (one-block liquidity) fashion.

## Documentation

The documentation of Aave V2 is in the following [Aave V2 documentation](https://docs.aave.com/v2/-MJXUluJ2u1DiL-VU6MM) link. At the documentation you can learn more about the protocol, see the contract interfaces, integration guides and audits.

For getting the latest contracts addresses, please check the [Deployed contracts](https://docs.aave.com/developers/deployed-contracts) page at the documentation to stay up to date.

## Connect with the community

You can join at the [Discord](https://discord.com/invite/CJm5Jt3) channel or at the [Governance Forum](https://governance.aave.com/) for asking questions about the protocol or talk about Aave with other peers.

## Setup

The repository uses Docker Compose to manage sensitive keys and load the configuration. Prior any action like test or deploy, you must run `docker-compose up` to start the `contracts-env` container, and then connect to the container console via `docker-compose exec contracts-env bash`.

Follow the next steps to setup the repository:

- Install `docker` and `docker-compose`
- Create an enviroment file named `.env` and fill the next enviroment variables

```
# Mnemonic, only first address will be used
MNEMONIC=""

# Add Alchemy or Infura provider keys, alchemy takes preference at the config level
ALCHEMY_KEY=""
INFURA_KEY=""


# Optional Etherscan key, for automatize the verification of the contracts at Etherscan
ETHERSCAN_KEY=""

# Optional, if you plan to use Tenderly scripts
TENDERLY_PROJECT=""
TENDERLY_USERNAME=""

```

## Markets configuration

The configurations related with the Aave Markets are located at `markets` directory. You can follow the `IAaveConfiguration` interface to create new Markets configuration or extend the current Aave configuration.

Each market should have his own Market configuration file, and their own set of deployment tasks, using the Aave market config and tasks as a reference.

## Test

You can run the full test suite with the following commands:

```
# In one terminal
docker-compose up

# Open another tab or terminal
docker-compose exec contracts-env bash

# A new Bash terminal is prompted, connected to the container
npm run test
```

## Deployments

For deploying Aave Protocol V2, you can use the available scripts located at `package.json`. For a complete list, run `npm run` to see all the tasks.

### Kovan deployment

```
# In one terminal
docker-compose up

# Open another tab or terminal
docker-compose exec contracts-env bash

# A new Bash terminal is prompted, connected to the container
npm run aave:kovan:full:migration
```

### Mainnet fork deployment

You can deploy Aave Protocol v2 in a forked Mainnet chain using Hardhat built-in feature:

```
# In one terminal, run a hardhat note with mainnet fork enabled
MAINNET_FORK=true npx hardhat node

# In another terminal, run docker-compose
docker-compose up

# Open another tab or terminal
docker-compose exec contracts-env bash

# A new Bash terminal is prompted, connected to the container
npm run aave:fork:main

# Contracts are now deployed at Hardhat node with Mainnet fork.

# You can interact with them via Hardhat console
MAINNET_FORK=true npx hardhat console
# Or your custom Hardhat task
MAINNET_FORK=true npx hardhat your-custom-task

```

### Mainnet fork - Run the check list

For testing the deployment scripts for Mainnet release, you can run the check-list tests in a Mainnet fork using Hardhat built-in feature:

```
# In another terminal, run docker-compose
docker-compose up

# Open another tab or terminal
docker-compose exec contracts-env bash

# A new Bash terminal is prompted, connected to the container
npm run test:main:check-list
```

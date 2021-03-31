import { task } from 'hardhat/config';

import { OracleAnchorFactory } from '../../types';
import { verifyContract } from '../../helpers/etherscan-verification';
import { EthereumNetwork } from '../../helpers/types';

task(`deploy-OracleAnchor`, `Deploys the OracleAnchor contract`)
  .addFlag('verify', 'Verify OracleAnchor contract via Etherscan API.')
  .setAction(async ({ verify }, localBRE) => {
    await localBRE.run('set-DRE');

    if (!localBRE.network.config.chainId) {
      throw new Error('INVALID_CHAIN_ID');
    }

    const aggregatorAssets = {
      [EthereumNetwork.main]: [
        // custom assets
        // '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', // GUSD
        // '0x8798249c2e607446efb7ad49ec89dd1865ff4272', // XSUSHI
        // Chainlink assets
        '0x0000000000085d4780b73119b644ae5ecd22b376', // TUSD
        '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e', // YFI
        '0x0d8775f648430679a709e98d2b0cb6250d2887ef', // BAT
        '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', // MANA
        '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', // UNI
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // WBTC
        '0x408e41876cccdc0f92210600ef50372656052a38', // REN
        '0x4fabb145d64652a948d72533023f6e7a623c7c53', // BUSD
        '0x514910771af9ca656af840dff83e8264ecf986ca', // LINK
        '0x57ab1ec28d129707052df4df418d58a2d46d5f51', // SUSD
        '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
        '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', // AAVE
        '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', // MKR
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
        '0xba100000625a3754423978a60c9317c58a424e3d', // BAL
        '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f', // SNX
        '0xd533a949740bb3306d119cc777fa900ba034cd52', // CRV
        '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT
        '0xdd974d5c2e2928dea5f71b9825b8b646686bd200', // KNC
        '0xe41d2489571d322189246dafa5ebde1f4699f498', // ZRX
        '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c', // ENJ
        '0x10f7fc1f91ba351f9c629c5947ad69bd03c05b96', // USD => USD_MOCK_ADDRESS
        '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2', // SUSHI
      ],
      [EthereumNetwork.kovan]: [
        '0x016750ac630f711882812f24dba6c95b9d35856d', // TUSD
        '0xb7c325266ec274feb1354021d27fa3e3379d840d', // YFI
        '0x2d12186fbb9f9a8c28b3ffdd4c42920f8539d738', // BAT
        '0x738dc6380157429e957d223e6333dc385c85fec7', // MANA
        '0x075a36ba8846c6b6f53644fdd3bf17e5151789dc', // UNI
        '0xd1b98b6607330172f1d991521145a22bce793277', // WBTC
        '0x5eebf65a6746eed38042353ba84c8e37ed58ac6f', // REN
        '0x4c6e1efc12fdfd568186b7baec0a43fffb4bcccf', // BUSD
        '0xad5ce863ae3e4e9394ab43d4ba0d80f419f61789', // LINK
        '0x99b267b9d96616f906d53c26decf3c5672401282', // SUSD
        '0xff795577d9ac8bd7d90ee22b6c1703490b6512fd', // DAI
        '0xb597cd8d3217ea6477232f9217fa70837ff667af', // AAVE
        '0x61e4cae3da7fd189e52a4879c7b8067d7c2cc0fa', // MKR
        '0xe22da380ee6b445bb8273c81944adeb6e8450422', // USDC
        '0x7fdb81b0b8a010dd4ffc57c3fecbf145ba8bd947', // SNX
        '0x13512979ade267ab5100878e2e0f485b568328a4', // USDT
        '0x3f80c39c0b96a0945f9f0e9f55d8a8891c5671a8', // KNC
        '0xd0d76886cf8d952ca26177eb7cfdf83bad08c00c', // ZRX
        '0xc64f90cd7b564d3ab580eb20a102a8238e218be2', // ENJ
        '0x10f7fc1f91ba351f9c629c5947ad69bd03c05b96', // USD => USD_MOCK_ADDRESS
      ],
    }; // assets directly related to chainlink
    const aggregatorSources = {
      [EthereumNetwork.main]: [
        // Custom sources
        // '0xec6f4cd64d28ef32507e2dc399948aae9bbedd7e', // GUSD
        // '0x9b26214bec078e68a394aaebfbfff406ce14893f', // XSUSHI
        // Chainlink sources
        '0x3886BA987236181D98F2401c507Fb8BeA7871dF2', //TUSD
        '0x7c5d4F8345e66f68099581Db340cd65B078C41f4', // YFI
        '0x0d16d4528239e9ee52fa531af613AcdB23D88c94', // BAT
        '0x82A44D92D6c329826dc557c5E1Be6ebeC5D5FeB9', // MANA
        '0xD6aA3D25116d8dA79Ea0246c4826EB951872e02e', // UNI
        '0xdeb288F737066589598e9214E782fa5A8eD689e8', // WBTC
        '0x3147D7203354Dc06D9fd350c7a2437bcA92387a4', // REN
        '0x614715d2Af89E6EC99A233818275142cE88d1Cfd', // BUSD
        '0xDC530D9457755926550b59e8ECcdaE7624181557', // LINK
        '0x8e0b7e6062272B5eF4524250bFFF8e5Bd3497757', // SUSD
        '0x773616E4d11A78F511299002da57A0a94577F1f4', // DAI
        '0x6Df09E975c830ECae5bd4eD9d90f3A95a4f88012', // AAVE
        '0x24551a8Fb2A7211A25a17B1481f043A8a8adC7f2', // MKR
        '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4', // USDC
        '0xC1438AA3823A6Ba0C159CfA8D98dF5A994bA120b', // BAL => different contract than others
        '0x79291A9d692Df95334B1a0B3B4AE6bC606782f8c', // SNX => same
        '0x8a12Be339B0cD1829b91Adc01977caa5E9ac121e', // CRV => same
        '0xEe9F2375b4bdF6387aa8265dD4FB8F16512A1d46', // USDT
        '0x656c0544eF4C98A6a98491833A89204Abb045d6b', // KNC
        '0x2Da4983a622a8498bb1a21FaE9D8F6C664939962', // ZRX
        '0x24D9aB51950F3d62E9144fdC2f3135DAA6Ce8D1B', // ENJ
        '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // USD
        '0xe572CeF69f43c2E488b33924AF04BDacE19079cf', // SUSHI
      ],
      [EthereumNetwork.kovan]: [
        '0x7aeCF1c19661d12E962b69eBC8f6b2E63a55C660', //TUSD
        '0xC5d1B1DEb2992738C0273408ac43e1e906086B6C', // YFI
        '0x0e4fcEC26c9f85c3D714370c98f43C4E02Fc35Ae', // BAT
        '0x1b93D8E109cfeDcBb3Cc74eD761DE286d5771511', // MANA
        '0x17756515f112429471F86f98D5052aCB6C47f6ee', // UNI
        '0xF7904a295A029a3aBDFFB6F12755974a958C7C25', // WBTC
        '0xF1939BECE7708382b5fb5e559f630CB8B39a10ee', // REN
        '0xbF7A18ea5DE0501f7559144e702b29c55b055CcB', // BUSD
        '0x3Af8C569ab77af5230596Acf0E8c2F9351d24C38', // LINK
        '0xb343e7a1aF578FA35632435243D814e7497622f7', // SUSD
        '0x22B58f1EbEDfCA50feF632bD73368b2FdA96D541', // DAI
        '0xd04647B7CB523bb9f26730E9B6dE1174db7591Ad', // AAVE
        '0x0B156192e04bAD92B6C1C13cf8739d14D78D5701', // MKR
        '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838', // USDC
        '0xF9A76ae7a1075Fe7d646b06fF05Bd48b9FA5582e', // SNX => same
        '0x0bF499444525a23E7Bb61997539725cA2e928138', // USDT
        '0xb8E8130d244CFd13a75D6B9Aee029B1C33c808A7', // KNC
        '0xBc3f28Ccc21E9b5856E81E6372aFf57307E2E883', // ZRX
        '0xfaDbe2ee798889F02d1d39eDaD98Eff4c7fe95D4', // ENJ
        '0x9326BFA02ADD2366b30bacB125260Af641031331', // USD
      ],
    }; // chainlink aggregator contract

    console.log(`\n- OracleAnchor deployment`);

    console.log(`\tDeploying OracleAnchor implementation ...`);
    const oracleAnchor = await new OracleAnchorFactory(
      await localBRE.ethers.provider.getSigner()
    ).deploy(aggregatorAssets[localBRE.network.name], aggregatorSources[localBRE.network.name]);
    await oracleAnchor.deployTransaction.wait();
    console.log('oracleAnchor.address', oracleAnchor.address);
    await verifyContract(oracleAnchor.address, []);

    console.log(`\tFinished OracleAnchor deployment`);
  });

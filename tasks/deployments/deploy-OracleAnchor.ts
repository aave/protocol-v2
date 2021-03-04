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

    const aaveOracleAssets = {
      [EthereumNetwork.main]: [
        '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', // GUSD
        '0x8798249c2e607446efb7ad49ec89dd1865ff4272', // XSUSHI
      ],
      [EthereumNetwork.kovan]: [],
    }; // token assets that are complex
    const aaveOracleSources = {
      [EthereumNetwork.main]: [
        '0xec6f4cd64d28ef32507e2dc399948aae9bbedd7e', // GUSD
        '0x9b26214bec078e68a394aaebfbfff406ce14893f', // XSUSHI
      ],
      [EthereumNetwork.kovan]: [],
    }; // custom oracles for complex tokens
    const aggregatorAssets = {
      [EthereumNetwork.main]: [
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
        '0x0c632ec5982e3a8dc116a02eba7a419efec170b1', //TUSD
        '0x4a03707a1bfefc2836a69b1a6a6bd752270041a9', // YFI
        '0x3146392934da3ae09447cd7fe4061d8aa96b50ae', // BAT
        '0x3162c2de0c254b97d869a070929b518b5b9b56b3', // MANA
        '0x5977d45ba0a1ffc3740506d07f5693bbc45df3c7', // UNI
        '0xbd72da70007e47aaf1bbd84918675392cf6885f7', // WBTC
        '0x1a53bf1bfffb7a2b33e1931d33423c7c94f675ee', // REN
        '0x661be809784e094ea70f980939cf3f09337a3178', // BUSD
        '0x7e6c635d6a53b5033d1b0cee84eccea9096859e4', // LINK
        '0x060f728deb96875f992c97414eff2b3ef6c58ec7', // SUSD
        '0xd866a07dea5ee3c093e21d33660b5579c21f140b', // DAI
        '0x42f3b59f72772eb5794b04d2d85afac0d30a5683', // AAVE
        '0x204a6fe11de66aa463879f47f3533dd87d47020d', // MKR
        '0x00d02526ca08488342ab634de3b2d0050ecc7f60', // USDC
        '0x4f5e9704b1d7cc032553f63471d96fcb63ff2bc3', // BAL => different contract than others
        '0xbafe3cb0e563e914806a99d547bdbf2cfcf5fdf6', // SNX => same
        '0x7f67ca2ce5299a67acd83d52a064c5b8e41ddb80', // CRV => same
        '0x1058a82c25f55ab8ab0ce717f3e6e164e80f1a0b', // USDT
        '0x075fe11b3dd9c605f7fd09ff9310e3e37baabc9e', // KNC
        '0xe03b49682965a1eb5230d41f96e10896dc563f0d', // ZRX
        '0x20aff4833e5d261bb34bc3980d88ad17a3fe90dc', // ENJ
        '0x00c7A37B03690fb9f41b5C5AF8131735C7275446', // USD
        '0x00377d6c82df8f63163ff828760b2a5d935734cf', // SUSHI
      ],
      [EthereumNetwork.kovan]: [
        '0x5d233bc41d345646f855502892eb11173f4b807b', //TUSD
        '0xe45f3ed2218e7e411bf8dfde66069e57f46b26ef', // YFI
        '0x7eeffd6a9d145f558b793f3aa65141bcd0c86312', // BAT
        '0x3e360e4db87a34738fa9d4ac819f208d8275a66b', // MANA
        '0x8d592e53fb1243657a51e531bfc30a3617a4173e', // UNI
        '0x222d3bd9bc8aef87afa9c8e4c7468da3f2c7130d', // WBTC
        '0x0fd41f0160c3567ae149b1564c080df208cba3b9', // REN
        '0x361e36e9d6f47f8312e9709312e088304b013d8b', // BUSD
        '0xb44aa3a6fc6419fac0a4fb9b9b8bfd69939503ff', // LINK
        '0x55dca5e95d271f2d074a5e6cf4bf95b7db80d67d', // SUSD
        '0x30fde1d82a4e58e579a64dbbcd8d4650805cf3c8', // DAI
        '0xde222c97adb2bb443c381edf4bb3f5bccd533808', // AAVE
        '0x0df8bbcd897fef6717d1cc44ac45cf2dd6e290bc', // MKR
        '0xdcfc14bc921e189497d4e63f4de1b418b521b1c4', // USDC
        '0x28a0fba7b73679d052c9b66bf4c83f6df7c349ce', // SNX => same
        '0xccc6f61b7ad1ea539705ed4237a85e23277eb341', // USDT
        '0x64e8b221bd554fe995c2fcf2490a3b979fe14776', // KNC
        '0xf8e4d2a782dbe31a7f8db2c2bc5b3645338321e9', // ZRX
        '0xf0e696e4b8b8d571c139e82a8a874022713fde52', // ENJ
        '0x10b3c106c4ed7D22B0e7Abe5Dc43BdFA970a153c', // USD
      ],
    }; // chainlink aggregator contract

    console.log(`\n- OracleAnchor deployment`);

    console.log(`\tDeploying OracleAnchor implementation ...`);
    const oracleAnchor = await new OracleAnchorFactory(
      await localBRE.ethers.provider.getSigner()
    ).deploy(
      aaveOracleAssets[localBRE.network.name],
      aaveOracleSources[localBRE.network.name],
      aggregatorAssets[localBRE.network.name],
      aggregatorSources[localBRE.network.name]
    );
    await oracleAnchor.deployTransaction.wait();
    console.log('oracleAnchor.address', oracleAnchor.address);
    await verifyContract(oracleAnchor.address, []);

    console.log(`\tFinished OracleAnchor deployment`);
  });

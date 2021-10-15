import { task } from 'hardhat/config';
import { deployStaticAToken, deployStaticATokenLM } from '../../helpers/contracts-deployments';
import { getFirstSigner } from '../../helpers/contracts-getters';
import { IERC20Detailed } from '../../types/IERC20Detailed';
import { IERC20DetailedFactory } from '../../types/IERC20DetailedFactory';

task(
  `deploy-atoken-wrapper`,
  `Deploy AToken Wrapper proxied with InitializableImmutableAdminUpgradeabilityProxy`
)
  .addParam('pool', 'Lending Pool address')
  .addParam('aTokenAddress', 'AToken proxy address')
  .addParam('proxyAdmin', 'Ethereum address of the proxy admin')
  .addFlag('verify', 'Verify UiPoolDataProvider contract via Etherscan API.')
  .setAction(
    async (
      {
        pool,
        aTokenAddress,
        proxyAdmin,
        verify,
      }: {
        pool: string;
        aTokenAddress: string;
        verify: boolean;
        proxyAdmin: string;
      },
      localBRE
    ) => {
      await localBRE.run('set-DRE');

      // Load symbol from AToken proxy contract
      const symbol = await IERC20DetailedFactory.connect(
        aTokenAddress,
        await getFirstSigner()
      ).symbol();

      console.log('- Deploying Static Wrapper for', symbol);
      const { proxy, implementation } = await deployStaticATokenLM(
        [pool, aTokenAddress, symbol, proxyAdmin],
        verify
      );

      console.log('- Deployed Static Wrapper for', symbol);
      console.log('  - Proxy: ', proxy);
      console.log('  - Impl : ', implementation);
    }
  );

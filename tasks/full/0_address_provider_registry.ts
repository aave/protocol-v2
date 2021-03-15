import { formatEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { deployLendingPoolAddressesProviderRegistry } from '../../helpers/contracts-deployments';
import { getFirstSigner } from '../../helpers/contracts-getters';

task('full:deploy-address-provider-registry', 'Deploy address provider registry')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    await DRE.run('set-DRE');
    const signer = await getFirstSigner();
    console.log('Signer', await signer.getAddress());
    console.log('Balance', formatEther(await signer.getBalance()));

    const contract = await deployLendingPoolAddressesProviderRegistry(verify);
    console.log('Registry Address:', contract.address);
  });

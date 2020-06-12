import {evmRevert, evmSnapshot} from "../../helpers/misc-utils";
import {TEST_SNAPSHOT_ID} from "../../helpers/constants";
import {Signer} from "ethers";
import {
  getEthersSigners,
  getLendingPool,
  getLendingPoolCore,
  getLendingPoolAddressesProvider,
  getAaveProtocolTestHelpers,
  getAToken,
  getMintableErc20,
  getLendingPoolConfiguratorProxy,
} from "../../helpers/contracts-helpers";
import {tEthereumAddress} from "../../helpers/types";
import {LendingPool} from "../../types/LendingPool";
import {LendingPoolCore} from "../../types/LendingPoolCore";
import {LendingPoolAddressesProvider} from "../../types/LendingPoolAddressesProvider";
import {AaveProtocolTestHelpers} from "../../types/AaveProtocolTestHelpers";
import {MintableErc20} from "../../types/MintableErc20";
import {AToken} from "../../types/AToken";
import {LendingPoolConfigurator} from "../../types/LendingPoolConfigurator";

import chai from "chai";
// @ts-ignore
import bignumberChai from "chai-bignumber";
chai.use(bignumberChai());

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  pool: LendingPool;
  core: LendingPoolCore;
  configurator: LendingPoolConfigurator;
  addressesProvider: LendingPoolAddressesProvider;
  helpersContract: AaveProtocolTestHelpers;
  dai: MintableErc20;
  aDai: AToken;
}

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    const testEnv: TestEnv = {
      deployer: {} as SignerWithAddress,
      users: [] as SignerWithAddress[],
      pool: {} as LendingPool,
      core: {} as LendingPoolCore,
      configurator: {} as LendingPoolConfigurator,
      addressesProvider: {} as LendingPoolAddressesProvider,
      helpersContract: {} as AaveProtocolTestHelpers,
      dai: {} as MintableErc20,
      aDai: {} as AToken,
    } as TestEnv;
    before(async () => {
      console.time("makeSuite");
      await evmSnapshot();
      const [_deployer, ...restSigners] = await getEthersSigners();
      const deployer: SignerWithAddress = {
        address: await _deployer.getAddress(),
        signer: _deployer,
      };

      for (const signer of restSigners) {
        testEnv.users.push({
          signer,
          address: await signer.getAddress(),
        });
      }
      testEnv.deployer = deployer;
      testEnv.pool = await getLendingPool();
      testEnv.core = await getLendingPoolCore();
      testEnv.configurator = await getLendingPoolConfiguratorProxy();
      testEnv.addressesProvider = await getLendingPoolAddressesProvider();
      testEnv.helpersContract = await getAaveProtocolTestHelpers();
      const aDaiAddress = (await testEnv.helpersContract.getAllATokens()).find(
        (aToken) => aToken.symbol === "aDAI"
      )?.tokenAddress;

      const daiAddress = (
        await await testEnv.helpersContract.getAllReservesTokens()
      ).find((token) => token.symbol === "DAI")?.tokenAddress;
      if (!aDaiAddress) {
        console.log(`atoken-modifiers.spec: aDAI not correctly initialized`);
        process.exit(1);
      }
      if (!daiAddress) {
        console.log(`atoken-modifiers.spec: DAI not correctly initialized`);
        process.exit(1);
      }

      testEnv.aDai = await getAToken(aDaiAddress);
      testEnv.dai = await getMintableErc20(daiAddress);
      console.timeEnd("makeSuite");
    });
    tests(testEnv);
    after(async () => {
      await evmRevert(TEST_SNAPSHOT_ID);
    });
  });
}

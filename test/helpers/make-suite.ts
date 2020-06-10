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
} from "../../helpers/contracts-helpers";
import {tEthereumAddress} from "../../helpers/types";
import {LendingPool} from "../../types/LendingPool";
import {LendingPoolCore} from "../../types/LendingPoolCore";
import {LendingPoolAddressesProvider} from "../../types/LendingPoolAddressesProvider";
import {AaveProtocolTestHelpers} from "../../types/AaveProtocolTestHelpers";
import {MintableErc20} from "../../types/MintableErc20";
import {AToken} from "../../types/AToken";

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export type TestEnv = {
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  pool: LendingPool;
  core: LendingPoolCore;
  addressesProvider: LendingPoolAddressesProvider;
  helpersContract: AaveProtocolTestHelpers;
  _dai: MintableErc20;
  _aDai: AToken;
};

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    const testEnv: TestEnv = {
      deployer: {} as SignerWithAddress,
      users: [] as SignerWithAddress[],
      pool: {} as LendingPool,
      core: {} as LendingPoolCore,
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

      testEnv._aDai = await getAToken(aDaiAddress);
      testEnv._dai = await getMintableErc20(daiAddress);
      console.timeEnd("makeSuite");
    });
    tests(testEnv);
    after(async () => {
      await evmRevert(TEST_SNAPSHOT_ID);
    });
  });
}

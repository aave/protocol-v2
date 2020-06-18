import {evmRevert, evmSnapshot, BRE} from "../../helpers/misc-utils";
import {Signer} from "ethers";
import {
  getEthersSigners,
  getLendingPool,
  getLendingPoolCore,
  getLendingPoolAddressesProvider,
  getAaveProtocolTestHelpers,
  getAToken,
  getMintableErc20,
  getLendingPoolConfiguratorProxy, getPriceOracle,
} from '../../helpers/contracts-helpers';
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
import { PriceOracle } from '../../types/PriceOracle';
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
  oracle: PriceOracle;
  helpersContract: AaveProtocolTestHelpers;
  dai: MintableErc20;
  aDai: AToken;
  usdc: MintableErc20;
}

let buidlerevmSnapshotId: string = "0x1";
const setBuidlerevmSnapshotId = (id: string) => {
  if (BRE.network.name === "buidlerevm") {
    buidlerevmSnapshotId = id;
  }
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  pool: {} as LendingPool,
  core: {} as LendingPoolCore,
  configurator: {} as LendingPoolConfigurator,
  addressesProvider: {} as LendingPoolAddressesProvider,
  helpersContract: {} as AaveProtocolTestHelpers,
  oracle: {} as PriceOracle,
  dai: {} as MintableErc20,
  aDai: {} as AToken,
  usdc: {} as MintableErc20,
} as TestEnv;

export async function initializeMakeSuite() {
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
  testEnv.oracle = await getPriceOracle();
  testEnv.addressesProvider = await getLendingPoolAddressesProvider();
  testEnv.helpersContract = await getAaveProtocolTestHelpers();
  const aDaiAddress = (await testEnv.helpersContract.getAllATokens()).find(
    (aToken) => aToken.symbol === "aDAI"
  )?.tokenAddress;

  const reservesTokens = await testEnv.helpersContract.getAllReservesTokens();
  const daiAddress = reservesTokens.find(token => token.symbol === "DAI")?.tokenAddress;
  const usdcAddress = reservesTokens.find(token => token.symbol === "USDC")?.tokenAddress;
  if (!aDaiAddress) {
    console.log(`atoken-modifiers.spec: aDAI not correctly initialized`);
    process.exit(1);
  }
  if (!daiAddress || !usdcAddress) {
    console.log(`atoken-modifiers.spec: USDC or DAI not correctly initialized`);
    process.exit(1);
  }

  testEnv.aDai = await getAToken(aDaiAddress);
  testEnv.dai = await getMintableErc20(daiAddress);
  testEnv.usdc = await getMintableErc20(usdcAddress);
}

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      setBuidlerevmSnapshotId(await evmSnapshot());
    });
    tests(testEnv);
    after(async () => {
      await evmRevert(buidlerevmSnapshotId);
    });
  });
}

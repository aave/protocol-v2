import {MockProvider} from "ethereum-waffle";
import {evmRevert, BRE} from "../helpers/misc-utils";
import {
  TEST_SNAPSHOT_ID,
  APPROVAL_AMOUNT_LENDING_POOL_CORE,
} from "../helpers/constants";
import {AToken} from "../types/AToken";
import {MintableErc20} from "../types/MintableErc20";
import {LendingPool} from "../types/LendingPool";
import {LendingPoolCore} from "../types/LendingPoolCore";
import {
  getAaveProtocolTestHelpers,
  getMintableErc20,
  getAToken,
  convertToCurrencyDecimals,
  getEthersSigners,
  getLendingPoolCore,
  getLendingPool,
} from "../helpers/contracts-helpers";
import {expect} from "chai";
import {ethers, Wallet, Signer} from "ethers";
// @ts-ignore
import {accounts} from "../test-wallets.js";

describe("AToken: Transfer", () => {
  let wallets: Signer[];
  let deployer: Signer;
  let users: Signer[];
  let _aDai: AToken;
  let _dai: MintableErc20;
  let _lendingPool: LendingPool;
  let _lendingPoolCore: LendingPoolCore;
  const NOT_LENDING_POOL_MSG =
    "The caller of this function must be a lending pool";

  before(async () => {
    await evmRevert(TEST_SNAPSHOT_ID);

    const [_deployer, ..._users] = await getEthersSigners();
    deployer = _deployer;
    users = _users;

    _lendingPool = await getLendingPool();
    _lendingPoolCore = await getLendingPoolCore();

    const testHelpers = await getAaveProtocolTestHelpers();

    const aDaiAddress = (await testHelpers.getAllATokens()).find(
      (aToken) => aToken.symbol === "aDAI"
    )?.tokenAddress;

    const daiAddress = (await testHelpers.getAllReservesTokens()).find(
      (token) => token.symbol === "DAI"
    )?.tokenAddress;
    if (!aDaiAddress) {
      console.log(`atoken-modifiers.spec: aDAI not correctly initialized`);
      process.exit(1);
    }
    if (!daiAddress) {
      console.log(`atoken-modifiers.spec: DAI not correctly initialized`);
      process.exit(1);
    }

    _aDai = await getAToken(aDaiAddress);
    _dai = await getMintableErc20(daiAddress);
  });

  it("User 0 deposits 1000 DAI, transfers to user 1", async () => {
    await _dai
      .connect(users[0])
      .mint(await convertToCurrencyDecimals(_dai.address, "1000"));

    console.log(_lendingPoolCore.address);

    console.time("approve");
    await _dai
      .connect(users[0])
      .approve(_lendingPoolCore.address, APPROVAL_AMOUNT_LENDING_POOL_CORE);
    console.timeEnd("approve");

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(
      _dai.address,
      "1000"
    );

    console.time("getaddress");
    await _lendingPool
      .connect(users[0])
      .deposit(_dai.address, amountDAItoDeposit, "0");
    console.timeEnd("getaddress");

    await _aDai
      .connect(users[0])
      .transfer(await users[1].getAddress(), amountDAItoDeposit);

    const fromBalance = await _aDai.balanceOf(await users[0].getAddress());
    const toBalance = await _aDai.balanceOf(await users[1].getAddress());

    expect(fromBalance.toString()).to.be.equal(
      "0",
      "Invalid from balance after transfer"
    );
    expect(toBalance.toString()).to.be.equal(
      amountDAItoDeposit.toString(),
      "Invalid to balance after transfer"
    );
  });

  // it('User 1 redirects interest to user 2, transfers 500 DAI back to user 0', async () => {

  //   await _aDai.redirectInterestStream(await users[2].getAddress());

  //   const aDAIRedirected = await convertToCurrencyDecimals(_DAI.address, '1000');

  //   const aDAItoTransfer = await convertToCurrencyDecimals(_DAI.address, '500');

  //   const user2RedirectedBalanceBefore = await _aDAI.getRedirectedBalance(users[2])
  //   expect(user2RedirectedBalanceBefore.toString()).to.be.equal(aDAIRedirected, "Invalid redirected balance for user 2 before transfer")

  //   await _aDAI.transfer(users[0], aDAItoTransfer, {from: users[1]})

  //   const user2RedirectedBalanceAfter = await _aDAI.getRedirectedBalance(users[2])
  //   const user1RedirectionAddress = await _aDAI.getInterestRedirectionAddress(users[1])

  //   expect(user2RedirectedBalanceAfter.toString()).to.be.equal(aDAItoTransfer, "Invalid redirected balance for user 2 after transfer")
  //   expect(user1RedirectionAddress.toString()).to.be.equal(users[2], "Invalid redirection address for user 1")

  // });

  //   it('User 0 transfers back to user 1', async () => {

  //     const aDAItoTransfer = await convertToCurrencyDecimals(_DAI.address, '500');

  //     await _aDAI.transfer(users[1], aDAItoTransfer, {from: users[0]})

  //     const user2RedirectedBalanceAfter = await _aDAI.getRedirectedBalance(users[2])

  //     const user1BalanceAfter = await _aDAI.balanceOf(users[1])

  //     expect(user2RedirectedBalanceAfter.toString()).to.be.equal(user1BalanceAfter.toString(), "Invalid redirected balance for user 2 after transfer")

  //   });

  //   it('User 0 deposits 1 ETH and user tries to borrow, but the aTokens received as a transfer are not available as collateral (revert expected)', async () => {

  //     await _lendingPoolInstance.deposit(ETHEREUM_ADDRESS, oneEther, '0', {
  //       from: users[0],
  //       value: oneEther.toFixed(0)
  //     });

  //     await expectRevert(_lendingPoolInstance.borrow(ETHEREUM_ADDRESS, await convertToCurrencyDecimals(ETHEREUM_ADDRESS,"0.1"), RateMode.Stable, "0", {from: users[1]}), "The collateral balance is 0")

  //   });

  //   it('User 1 sets the DAI as collateral and borrows, tries to transfer everything back to user 0 (revert expected)', async () => {

  //     await _lendingPoolInstance.setUserUseReserveAsCollateral(_DAI.address, true, {from: users[1]})

  //     const aDAItoTransfer = await convertToCurrencyDecimals(_DAI.address, '1000');

  //     await _lendingPoolInstance.borrow(ETHEREUM_ADDRESS, await convertToCurrencyDecimals(ETHEREUM_ADDRESS,"0.1"), RateMode.Stable, "0", {from: users[1]})

  //     await expectRevert(_aDAI.transfer(users[0], aDAItoTransfer, {from: users[1]}), "Transfer cannot be allowed.")
  //   });

  //   it('User 0 tries to transfer 0 balance (revert expected)', async () => {
  //     await expectRevert(_aDAI.transfer(users[1], "0", {from: users[0]}), "Transferred amount needs to be greater than zero")
  //   });

  //   it('User 1 repays the borrow, transfers aDAI back to user 0', async () => {

  //     await _lendingPoolInstance.repay(ETHEREUM_ADDRESS, MAX_UINT_AMOUNT, users[1], {from: users[1], value: oneEther.toFixed(0)})

  //     const aDAItoTransfer = await convertToCurrencyDecimals(_DAI.address, '1000');

  //     await _aDAI.transfer(users[0], aDAItoTransfer, {from: users[1]})

  //     const user2RedirectedBalanceAfter = await _aDAI.getRedirectedBalance(users[2])

  //     const user1RedirectionAddress = await _aDAI.getInterestRedirectionAddress(users[1])

  //     expect(user2RedirectedBalanceAfter.toString()).to.be.equal("0", "Invalid redirected balance for user 2 after transfer")

  //     expect(user1RedirectionAddress.toString()).to.be.equal(NIL_ADDRESS, "Invalid redirected address for user 1")

  //   });

  //   it('User 0 redirects interest to user 2, transfers 500 aDAI to user 1. User 1 redirects to user 3. User 0 transfers another 100 aDAI', async () => {

  //     let aDAItoTransfer = await convertToCurrencyDecimals(_DAI.address, '500');

  //     await _aDAI.redirectInterestStream(users[2], {from: users[0]})

  //     await _aDAI.transfer(users[1], aDAItoTransfer, {from: users[0]})

  //     await _aDAI.redirectInterestStream(users[3], {from: users[1]})

  //     aDAItoTransfer = await convertToCurrencyDecimals(_DAI.address, '100');

  //     await _aDAI.transfer(users[1], aDAItoTransfer, {from: users[0]})

  //     const user2RedirectedBalanceAfter = await _aDAI.getRedirectedBalance(users[2])
  //     const user3RedirectedBalanceAfter = await _aDAI.getRedirectedBalance(users[3])

  //     const expectedUser2Redirected = await convertToCurrencyDecimals(_DAI.address, "400")
  //     const expectedUser3Redirected = await convertToCurrencyDecimals(_DAI.address, "600")

  //     expect(user2RedirectedBalanceAfter.toString()).to.be.equal(expectedUser2Redirected, "Invalid redirected balance for user 2 after transfer")
  //     expect(user3RedirectedBalanceAfter.toString()).to.be.equal(expectedUser3Redirected, "Invalid redirected balance for user 3 after transfer")

  //   });
});

// // contract('AToken: Transfer', async ([deployer, ...users]) => {
// //   let _testEnvProvider: ITestEnvWithoutInstances;
// //   let _aDAI: ATokenInstance;
// //   let _DAI: MintableERC20Instance;
// //   let _lendingPoolInstance: LendingPoolInstance;
// //   let _lendingPoolCoreInstance: LendingPoolCoreInstance;

// //   before('Initializing test variables', async () => {
// //     console.time('setup-test');
// //     _testEnvProvider = await testEnvProviderWithoutInstances(
// //       artifacts,
// //       [deployer, ...users]
// //     );

// //     const {
// //       getLendingPoolInstance,
// //       getLendingPoolCoreInstance,
// //       getAllAssetsInstances,
// //       getATokenInstances
// //     } = _testEnvProvider;
// //     const instances = await Promise.all([
// //       getATokenInstances(), getAllAssetsInstances(), getLendingPoolInstance(), getLendingPoolCoreInstance()
// //     ])

// //     _aDAI = instances[0].aDAI
// //     _DAI = instances[1].DAI
// //     _lendingPoolInstance = instances[2];
// //     _lendingPoolCoreInstance = instances[3]

// //     console.timeEnd('setup-test');
// //   });

// // });

import {
  APPROVAL_AMOUNT_LENDING_POOL_CORE,
  MOCK_ETH_ADDRESS,
  AAVE_REFERRAL,
  MAX_UINT_AMOUNT,
  ZERO_ADDRESS,
} from "../helpers/constants";
import {convertToCurrencyDecimals} from "../helpers/contracts-helpers";
import {expect} from "chai";
import {ethers} from "ethers";
import {RateMode} from "../helpers/types";
import {makeSuite, TestEnv} from "./helpers/make-suite";

makeSuite("AToken: Transfer", (testEnv: TestEnv) => {
  it("User 0 deposits 1000 DAI, transfers to user 1", async () => {
    const {users, pool, core, _dai, _aDai} = testEnv;

    await _dai
      .connect(users[0].signer)
      .mint(await convertToCurrencyDecimals(_dai.address, "1000"));

    await _dai
      .connect(users[0].signer)
      .approve(core.address, APPROVAL_AMOUNT_LENDING_POOL_CORE);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(
      _dai.address,
      "1000"
    );

    await pool
      .connect(users[0].signer)
      .deposit(_dai.address, amountDAItoDeposit, "0");

    await _aDai
      .connect(users[0].signer)
      .transfer(users[1].address, amountDAItoDeposit);

    const fromBalance = await _aDai.balanceOf(users[0].address);
    const toBalance = await _aDai.balanceOf(users[1].address);

    expect(fromBalance.toString()).to.be.equal(
      "0",
      "Invalid from balance after transfer"
    );
    expect(toBalance.toString()).to.be.equal(
      amountDAItoDeposit.toString(),
      "Invalid to balance after transfer"
    );
  });

  it("User 1 redirects interest to user 2, transfers 500 DAI back to user 0", async () => {
    const {users, _aDai, _dai} = testEnv;
    await _aDai
      .connect(users[1].signer)
      .redirectInterestStream(users[2].address);

    const aDAIRedirected = await convertToCurrencyDecimals(
      _dai.address,
      "1000"
    );

    const aDAItoTransfer = await convertToCurrencyDecimals(_dai.address, "500");

    const user2RedirectedBalanceBefore = await _aDai.getRedirectedBalance(
      users[2].address
    );
    expect(user2RedirectedBalanceBefore.toString()).to.be.equal(
      aDAIRedirected,
      "Invalid redirected balance for user 2 before transfer"
    );

    await _aDai
      .connect(users[1].signer)
      .transfer(users[0].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await _aDai.getRedirectedBalance(
      users[2].address
    );
    const user1RedirectionAddress = await _aDai.getInterestRedirectionAddress(
      users[1].address
    );

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      aDAItoTransfer,
      "Invalid redirected balance for user 2 after transfer"
    );
    expect(user1RedirectionAddress.toString()).to.be.equal(
      users[2].address,
      "Invalid redirection address for user 1"
    );
  });

  it("User 0 transfers back to user 1", async () => {
    const {users, _aDai, _dai} = testEnv;
    const aDAItoTransfer = await convertToCurrencyDecimals(_dai.address, "500");

    await _aDai
      .connect(users[0].signer)
      .transfer(users[1].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await _aDai.getRedirectedBalance(
      users[2].address
    );

    const user1BalanceAfter = await _aDai.balanceOf(users[1].address);

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      user1BalanceAfter.toString(),
      "Invalid redirected balance for user 2 after transfer"
    );
  });

  it("User 0 deposits 1 ETH and user tries to borrow, but the aTokens received as a transfer are not available as collateral (revert expected)", async () => {
    const {users, pool} = testEnv;

    await pool
      .connect(users[0].signer)
      .deposit(MOCK_ETH_ADDRESS, ethers.utils.parseEther("1.0"), "0", {
        value: ethers.utils.parseEther("1.0"),
      });
    await expect(
      pool
        .connect(users[1].signer)
        .borrow(
          MOCK_ETH_ADDRESS,
          ethers.utils.parseEther("0.1"),
          RateMode.Stable,
          AAVE_REFERRAL
        ),
      "The collateral balance is 0"
    ).to.be.revertedWith("The collateral balance is 0");
  });

  it("User 1 sets the DAI as collateral and borrows, tries to transfer everything back to user 0 (revert expected)", async () => {
    const {users, pool, _aDai, _dai} = testEnv;
    await pool
      .connect(users[1].signer)
      .setUserUseReserveAsCollateral(_dai.address, true);

    const aDAItoTransfer = await convertToCurrencyDecimals(
      _dai.address,
      "1000"
    );

    await pool
      .connect(users[1].signer)
      .borrow(
        MOCK_ETH_ADDRESS,
        ethers.utils.parseEther("0.1"),
        RateMode.Stable,
        AAVE_REFERRAL
      );

    await expect(
      _aDai.connect(users[1].signer).transfer(users[0].address, aDAItoTransfer),
      "Transfer cannot be allowed."
    ).to.be.revertedWith("Transfer cannot be allowed.");
  });

  it("User 0 tries to transfer 0 balance (revert expected)", async () => {
    const {users, pool, _aDai, _dai} = testEnv;
    await expect(
      _aDai.connect(users[0].signer).transfer(users[1].address, "0"),
      "Transferred amount needs to be greater than zero"
    ).to.be.revertedWith("Transferred amount needs to be greater than zero");
  });

  it("User 1 repays the borrow, transfers aDAI back to user 0", async () => {
    const {users, pool, _aDai, _dai} = testEnv;
    await pool
      .connect(users[1].signer)
      .repay(MOCK_ETH_ADDRESS, MAX_UINT_AMOUNT, users[1].address, {
        value: ethers.utils.parseEther("1"),
      });

    const aDAItoTransfer = await convertToCurrencyDecimals(
      _aDai.address,
      "1000"
    );

    await _aDai
      .connect(users[1].signer)
      .transfer(users[0].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await _aDai.getRedirectedBalance(
      users[2].address
    );

    const user1RedirectionAddress = await _aDai.getInterestRedirectionAddress(
      users[1].address
    );

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      "0",
      "Invalid redirected balance for user 2 after transfer"
    );

    expect(user1RedirectionAddress.toString()).to.be.equal(
      ZERO_ADDRESS,
      "Invalid redirected address for user 1"
    );
  });

  it("User 0 redirects interest to user 2, transfers 500 aDAI to user 1. User 1 redirects to user 3. User 0 transfers another 100 aDAI", async () => {
    const {users, pool, _aDai, _dai} = testEnv;

    let aDAItoTransfer = await convertToCurrencyDecimals(_aDai.address, "500");

    await _aDai
      .connect(users[0].signer)
      .redirectInterestStream(users[2].address);

    await _aDai
      .connect(users[0].signer)
      .transfer(users[1].address, aDAItoTransfer);

    await _aDai
      .connect(users[1].signer)
      .redirectInterestStream(users[3].address);

    aDAItoTransfer = await convertToCurrencyDecimals(_aDai.address, "100");

    await _aDai
      .connect(users[0].signer)
      .transfer(users[1].address, aDAItoTransfer);

    const user2RedirectedBalanceAfter = await _aDai.getRedirectedBalance(
      users[2].address
    );
    const user3RedirectedBalanceAfter = await _aDai.getRedirectedBalance(
      users[3].address
    );

    const expectedUser2Redirected = await convertToCurrencyDecimals(
      _aDai.address,
      "400"
    );
    const expectedUser3Redirected = await convertToCurrencyDecimals(
      _aDai.address,
      "600"
    );

    expect(user2RedirectedBalanceAfter.toString()).to.be.equal(
      expectedUser2Redirected,
      "Invalid redirected balance for user 2 after transfer"
    );
    expect(user3RedirectedBalanceAfter.toString()).to.be.equal(
      expectedUser3Redirected,
      "Invalid redirected balance for user 3 after transfer"
    );
  });
});

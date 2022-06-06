/* 10 stETH, 50ETH, and 100 USDC
 * After you run this script make sure to clear your localfork cache
 * Metamask > Settings > Advanced > Reset
 */ 

// Deposit 10 stETH tokens to your local wallet
const hardhat = require("hardhat");
const impersonateAddress = "0xeb9ab260eda599502e536181aaa3a5097406e498"; // for stETH
await hardhat.network.provider.send("hardhat_stopImpersonatingAccount", [
  impersonateAddress,
]);
await hardhat.network.provider.send("hardhat_impersonateAccount", [
  impersonateAddress,
]);
signer = await hardhat.ethers.provider.getSigner(impersonateAddress)
(await signer.getBalance()).toString();

const stETHAddress = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84";
const yourWalletAddress = "0xFBa103A04239ED280116828D4652f74DF6117434";
const stETHAmount = "10"; // 10 tokens

const stEthAbi = [
  // Some details about the token
  "function name() view returns (string)",
  "function symbol() view returns (string)",

  // Get the account balance
  "function balanceOf(address) view returns (uint)",

  // Send some of your tokens to someone else
  "function transfer(address to, uint amount)",

  // An event triggered whenever anyone transfers to someone else
  "event Transfer(address indexed from, address indexed to, uint amount)",
];

const stETHContract = new ethers.Contract(stETHAddress, stEthAbi, signer);
(await stETHContract.connect(signer)).transfer(yourWalletAddress, ethers.utils.parseEther(stETHAmount));

//const hardhat = require("hardhat")
await hardhat.network.provider.send('hardhat_stopImpersonatingAccount', ['0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503'])
await hardhat.network.provider.send('hardhat_impersonateAccount', ['0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503'])
signer = await hardhat.ethers.provider.getSigner('0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503')
(await signer.getBalance()).toString()

const usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"

const usdcAbi = [
  // Some details about the token
  "function name() view returns (string)",
  "function symbol() view returns (string)",

  // Get the account balance
  "function balanceOf(address) view returns (uint)",

  // Send some of your tokens to someone else
  "function transfer(address to, uint amount)",

  // An event triggered whenever anyone transfers to someone else
  "event Transfer(address indexed from, address indexed to, uint amount)"
]

const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, signer);
(await usdcContract.connect(signer)).transfer(yourWalletAddress, "100000000")

//const hardhat = require("hardhat")
await hardhat.network.provider.send('hardhat_impersonateAccount', ['0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2'])
signer = await hardhat.ethers.provider.getSigner('0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2')
await signer.sendTransaction({
  to: yourWalletAddress,
  value: ethers.utils.parseEther("50") 
})
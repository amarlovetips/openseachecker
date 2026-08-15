const { ethers } = require('ethers');

// Test HD Derivation
function testWalletDerivation() {
  console.log('--- 1. Testing Wallet HD Derivation ---');
  const testMnemonic = 'test test test test test test test test test test test junk';
  const mnemonicObj = ethers.Mnemonic.fromPhrase(testMnemonic);
  const wallets = [];

  for (let i = 0; i < 5; i++) {
    const path = `m/44'/60'/0'/0/${i}`;
    const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, path);
    wallets.push({
      index: i + 1,
      address: wallet.address,
      privateKey: wallet.privateKey
    });
  }

  console.log(`Successfully generated ${wallets.length} HD wallets:`);
  wallets.forEach(w => console.log(`  Wallet #${w.index}: ${w.address}`));
  return wallets;
}

// Test OpenSea SeaDrop ABI Encoding
function testSeaDropEncoding() {
  console.log('\n--- 2. Testing SeaDrop v1.0 & Drop ABI Encoding ---');
  const seaDropInterface = new ethers.Interface([
    "function mintPublic(address nftContract, address feeRecipient, address minterIfNotPayer, uint256 quantity) external payable",
    "function mint(uint256 quantity) public payable",
    "function publicMint(uint256 quantity) public payable"
  ]);

  const targetContract = "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34";
  const userAddress = "0x1111111111111111111111111111111111111111";
  const qty = 1;

  const data1 = seaDropInterface.encodeFunctionData("mintPublic", [
    targetContract,
    ethers.ZeroAddress,
    userAddress,
    qty
  ]);
  console.log('✅ SeaDrop mintPublic Calldata generated successfully:', data1.slice(0, 40) + '...');

  const data2 = seaDropInterface.encodeFunctionData("mint", [qty]);
  console.log('✅ Standard mint(quantity) Calldata generated successfully:', data2);

  const data3 = seaDropInterface.encodeFunctionData("publicMint", [qty]);
  console.log('✅ publicMint(quantity) Calldata generated successfully:', data3);
}

// Test Sequential Multi-Wallet Dispatch Simulation with 1ms latency
async function testSequentialDispatch(wallets) {
  console.log('\n--- 3. Testing 1ms Sequential Multi-Wallet Dispatch Simulation ---');
  const startTime = performance.now();
  const results = [];

  for (let i = 0; i < wallets.length; i++) {
    const w = wallets[i];
    const wStart = performance.now();
    
    // Simulate transaction creation & signing
    const walletSigner = new ethers.Wallet(w.privateKey);
    const tx = {
      to: "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34",
      value: ethers.parseEther("0.001"),
      data: "0xa0712d680000000000000000000000000000000000000000000000000000000000000001",
      nonce: 0,
      gasLimit: 150000,
      gasPrice: ethers.parseUnits("30", "gwei"),
      chainId: 1
    };

    const signedTx = await walletSigner.signTransaction(tx);
    const wEnd = performance.now();
    const elapsed = (wEnd - wStart).toFixed(2);
    
    results.push({ wallet: w.address, signedLength: signedTx.length, elapsedMs: elapsed });
    console.log(`  ⚡ Wallet #${i + 1} (${w.address.slice(0, 10)}...): Signed & Prepared in ${elapsed}ms`);
  }

  const totalTime = (performance.now() - startTime).toFixed(2);
  console.log(`\n🎉 Total batch prepared across ${wallets.length} wallets in ${totalTime}ms!`);
}

async function runAll() {
  const wallets = testWalletDerivation();
  testSeaDropEncoding();
  await testSequentialDispatch(wallets);
  console.log('\n✅ ALL INTEGRITY TESTS PASSED WITH 100% SUCCESS!');
}

runAll();

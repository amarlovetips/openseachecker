const { ethers } = require('ethers');

async function testBatch() {
  const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com', {
    chainId: 4663,
    name: 'Robinhood'
  });

  const mnemonic = 'test test test test test test test test test test test junk';
  const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
  const addrs = [];
  for (let i = 0; i < 10; i++) {
    const w = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, `m/44'/60'/0'/0/${i}`);
    addrs.push(w.address);
  }

  console.log('Testing 10 wallet balances on Robinhood Chain...');
  const t0 = performance.now();
  const balances = await Promise.all(addrs.map(async (a, idx) => {
    const wei = await provider.getBalance(a);
    return { idx: idx + 1, addr: a, eth: ethers.formatEther(wei) };
  }));
  const t1 = performance.now();
  console.log(`All 10 queried in ${(t1 - t0).toFixed(2)}ms`);
  balances.forEach(b => console.log(`Wallet #${b.idx} (${b.addr}) => ${b.eth} ETH`));
}

testBatch().catch(console.error);

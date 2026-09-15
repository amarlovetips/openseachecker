const { ethers } = require('ethers');

// Test RPC endpoints of newly added or specific chains
const chainsToTest = [
  { id: 'robinhood', name: 'Robinhood', rpc: 'https://rpc.mainnet.chain.robinhood.com', chainId: 4663 },
  { id: 'berachain', name: 'Berachain', rpc: 'https://rpc.berachain.com', chainId: 80094 },
  { id: 'soneium', name: 'Soneium', rpc: 'https://rpc.soneium.org/', chainId: 1868 },
  { id: 'unichain', name: 'Unichain', rpc: 'https://mainnet.unichain.org', chainId: 130 },
  { id: 'abstract', name: 'Abstract', rpc: 'https://api.mainnet.abs.xyz', chainId: 2741 },
  { id: 'shape', name: 'Shape', rpc: 'https://mainnet.shape.network', chainId: 360 },
  { id: 'b3', name: 'B3', rpc: 'https://mainnet-rpc.b3.fun/http', chainId: 8333 },
  { id: 'ronin', name: 'Ronin', rpc: 'https://api.roninchain.com/rpc', chainId: 2020 },
  { id: 'flow', name: 'Flow', rpc: 'https://mainnet.evm.nodes.onflow.org', chainId: 747 },
];

async function testAllChains() {
  for (const c of chainsToTest) {
    try {
      const provider = new ethers.JsonRpcProvider(c.rpc);
      const [net, block] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber()
      ]);
      console.log(`✅ [${c.name}] RPC ONLINE! chainId: ${Number(net.chainId)} (expected: ${c.chainId}), block: ${block}`);
    } catch (err) {
      console.log(`❌ [${c.name}] RPC FAILED: ${err.message}`);
    }
  }
}

testAllChains();

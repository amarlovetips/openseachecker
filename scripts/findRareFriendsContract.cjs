const { ethers } = require('ethers');

async function findRareFriendsContract() {
  const url = `https://opensea.io/collection/rare-friends-genesis/overview`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });

  const html = await res.text();
  console.log('HTML length:', html.length);

  // Search for collection object in Relay Store
  // Find where "slug":"rare-friends-genesis" is
  const slugIdx = html.indexOf('"rare-friends-genesis"');
  console.log('slug index:', slugIdx);
  if (slugIdx !== -1) {
    const snippet = html.substring(Math.max(0, slugIdx - 500), Math.min(html.length, slugIdx + 1000));
    console.log('Snippet around slug:\n', snippet);
  }

  // Find all occurrences of "contract": or "address": or "assetContract":
  const contractMatches = [...html.matchAll(/"(0x[a-fA-F0-9]{40})"/g)].map(m => m[1]);
  const uniqueAddresses = [...new Set(contractMatches)];
  console.log('\nAll unique hex addresses in HTML:', uniqueAddresses);

  // Check each address on Robinhood Chain using RPC
  const provider = new ethers.JsonRpcProvider('https://rpc.mainnet.chain.robinhood.com', {
    chainId: 4663,
    name: 'Robinhood'
  });

  const abi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)"
  ];

  console.log('\nChecking contracts on Robinhood Chain...');
  for (const rawAddr of uniqueAddresses) {
    const addr = ethers.getAddress(rawAddr.toLowerCase());
    if (addr === ethers.ZeroAddress) continue;
    try {
      const c = new ethers.Contract(addr, abi, provider);
      const name = await c.name().catch(() => null);
      const sym = await c.symbol().catch(() => null);
      if (name) {
        console.log(`🎯 FOUND CONTRACT: ${addr} => Name: "${name}", Symbol: "${sym}"`);
      }
    } catch (e) {}
  }
}

findRareFriendsContract().catch(console.error);
